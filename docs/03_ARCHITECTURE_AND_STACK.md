# 03 · Architettura, stack e algoritmi

> Descrive il sistema **com'è oggi** nel codice. Il riferimento endpoint-per-endpoint (auth, codici
> di errore, eventi socket) è [`06_API_AND_AUTH.md`](./06_API_AND_AUTH.md); qui c'è la mappa. Unifica
> il precedente `architettura_tecnica_algoritmi_e_schema_db.md` (il suo schema Prisma copiato a
> mano era superato: lo schema vero è `packages/db/prisma/schema.prisma`).

## 1. Stack

| Livello        | Tecnologia (versione nel repo)                                                            | Note                                                   |
| -------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Monorepo       | Turborepo 2 + npm workspaces, TypeScript 5 strict                                         | `tsconfig.base.json`, ESLint 8 flat config, Prettier 3 |
| API            | Fastify 4, Socket.io 4, ioredis, `@fastify/jwt`, `cookie`, `cors`, `helmet`, `rate-limit` | `apps/api`, avvio con `tsx`                            |
| Database       | PostgreSQL 16 + Prisma 5 (migrazioni versionate)                                          | `packages/db`                                          |
| Cache/presenza | Redis 7                                                                                   | Stato "Now Playing" con TTL, cache heavy rotation      |
| Web            | Next.js 14.2 App Router, React 18, Tailwind, Phosphor                                     | `apps/web`                                             |
| Mobile         | Expo SDK 51, React Native 0.74, Reanimated 3, FlashList                                   | `apps/mobile` (prototipo, vedi `04`)                   |
| Contratti      | Zod 3 in `packages/shared` (schemi, tipi, eventi WS, `THEME`)                             | Importati da api, web e mobile                         |
| Test           | Vitest 2 (unit + integrazione), Playwright 1.56 (e2e)                                     | CI: `.github/workflows/ci.yml`                         |

Non presenti, anche se citati in versioni precedenti dei documenti: NestJS, BullMQ, un pacchetto
`ui-tokens` separato (i token stanno in `THEME`), MusicBrainz, Skia.

## 2. Struttura

```text
apps/api/src
├── app.ts                 # buildApp(): plugin, decorator auth, error handler, rotte
├── server.ts              # avvio HTTP + Socket.io + Redis
├── config/                # env validato (JWT_SECRET obbligatorio in produzione)
├── lib/                   # auth, errors, error-handler, password, realtime, upstream, mappers, follows
└── modules/<dominio>/     # <dominio>.routes.ts (validazione + auth) + <dominio>.service.ts (logica)
apps/web/src
├── app/                   # pagine App Router (/, auth, explore, releases/[id], reels, chat, ...)
├── components/ui          # primitive del design system
├── components/…           # componenti di dominio (discovery, web-social, web-core)
└── lib/{api,auth,socket,url}  # client REST tipizzato, AuthProvider, hook socket, URL sicuri
packages/shared/src        # auth, social, review, catalog, critic-video, realtime, errors, theme...
packages/db                # prisma/schema.prisma, prisma/migrations, src/seed.ts
```

### Moduli API

| Modulo          | Prefisso                    | Responsabilità                                                                       |
| --------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| `auth`          | `/api/auth`                 | Registrazione/login locali, profilo, password, OAuth Spotify e Last.fm collegati     |
| `users`         | `/api/users`                | Ricerca, suggerimenti, follow/unfollow, follower/seguiti, post di un utente          |
| `feed`          | `/api`                      | `/feed`, `/posts` (crea, elimina, like, salva)                                       |
| `catalog`       | `/api/catalog`              | Ricerca locale + import da Deezer/iTunes/MusicBrainz/CAA, resolve, generi, anteprime |
| `reviews`       | `/api/reviews`              | Recensioni (upsert), reazioni, ricalcolo punteggi pubblico/critica                   |
| `profile`       | `/api/profile`              | Profilo, statistiche, heavy rotation, diario                                         |
| `discovery`     | `/api/discovery`            | Reels e Roulette dei generi                                                          |
| `chat`          | `/api/chat`                 | Inbox, conversazioni, messaggi con brano, reazioni, "ascoltato"                      |
| `playlists`     | `/api/playlists`            | Playlist Lato A / Lato B                                                             |
| `notifications` | `/api/notifications`        | Notifiche persistenti, non lette, riepilogo presenza                                 |
| `now-playing`   | `/api/now-playing` + socket | Presenza live in Redis, Ghost Mode, gateway Socket.io                                |
| `critic`        | `/api/critic`               | Accredito critici (coda ADMIN), recensioni della critica, dual score                 |
| `videos`        | `/api/videos`               | Video-recensioni (pubblicazione riservata a CRITIC/MODERATOR/ADMIN)                  |
| `spotify`       | `/api/spotify`              | Currently playing, sync playback → scrobble, top artisti, export playlist            |

L'elenco completo degli endpoint con livello di autenticazione è in `06` §4.

## 3. Ciclo di vita di una richiesta

1. **Plugin globali:** `helmet`, CORS limitato a `CORS_ORIGIN` (con credenziali), cookie, JWT,
   `rate-limit` (non globale: solo su auth e catalogo, vedi `06` §1).
2. **Autenticazione** (ADR-006): `fastify.authenticate` legge `Authorization: Bearer` o il cookie
   `om_session`, verifica firma, scadenza e `sv` contro `User.sessionVersion`, e rilegge il ruolo
   dal DB. `optionalAuth` tratta un token non valido come anonimo. `requireRole(...)` per i ruoli.
3. **Validazione:** ogni rotta fa `Schema.parse(...)` con gli schemi di `@openmusic/shared`.
4. **Service:** logica di dominio, Prisma, Redis, `upstreamFetch` (timeout 5 s) verso i provider.
5. **Errori** (ADR-007): nessun `try/catch` nelle rotte; `registerErrorHandling` mappa
   `AppError`, `ZodError` ed errori Prisma (es. unique → 409, record mancante → 404) in
   `ApiErrorBody`. I 500 hanno messaggio generico; i dettagli vanno solo nei log.

## 4. Presenza live ("Now Playing")

1. Il client invia `now_playing:update_track` sul socket (oppure il web chiama
   `POST /api/spotify/sync-playback`, che legge Spotify e registra anche uno `ScrobbleLog`).
2. `NowPlayingService` scrive `presence:user:{id}` in Redis con `SETEX` 300 s.
3. Il server emette `now_playing:friend_presence_changed` **solo nelle stanze `user:<id>` dei
   follower**. Alla connessione ogni socket riceve `now_playing:initial_friends_state`.
4. Ghost Mode (`now_playing:toggle_ghost` o `PATCH /api/auth/me`) passa sempre da
   `NowPlayingService.setGhostMode`, che pubblica subito lo stato nascosto.

**Limite attuale:** Socket.io usa l'adapter **in memoria**: tutto funziona con una sola istanza
API. Per scalare orizzontalmente serve `@socket.io/redis-adapter` (Redis Pub/Sub), non ancora
presente. Il token del socket è verificato solo alla connessione.

## 5. Algoritmi

### 5.1 Voto del pubblico e della critica (ADR-001, ADR-002)

- Input 0.5–5.0 stelle, salvato come intero `rating ∈ [10, 100]`.
- Peso per recensione: **1.5** se _Ascolto Verificato_, **1.0** altrimenti
  (`VERIFIED_LISTEN_WEIGHT` / `UNVERIFIED_LISTEN_WEIGHT` in `packages/shared/src/review.ts`).
- Ascolto verificato: almeno 3 brani distinti dell'album nello storico `ScrobbleLog` (tutti, se
  l'album ne ha meno di 3), oppure 1 scrobble del brano per una recensione di brano.
- `audienceAvg` = media pesata su scala 0.5–5.0 (una cifra decimale);
  `audienceFreshPct` = quota pesata di voti >= 70.
- Il voto della critica usa la stessa funzione con peso 1 per recensione.
- Implementazione: `apps/api/src/modules/reviews/score.ts` (puro, testato) e
  `release-scores.ts` (ricalcola **entrambi** i punteggi da qualunque percorso di scrittura).

**Non ancora implementato:** il termine bayesiano previsto dall'ADR-001,

$$S = \frac{C \cdot m + \sum w_i r_i}{C + \sum w_i}, \quad m = 3.25,\ C = 10$$

Oggi `audienceAvg` è una media pesata semplice, quindi una release con una sola recensione può
mostrare 5.0. Il salvataggio di una recensione e il ricalcolo non sono nella stessa transazione.

### 5.2 Anteprime audio da 30 s (ADR-003)

`AudioPreviewResolverService` (`apps/api/src/modules/catalog/audio-preview-resolver.service.ts`):

1. **Deezer** (`/track/isrc:{ISRC}` o ricerca `artist + track`) → MP3 30 s;
2. **iTunes Search API** come fallback → AAC 30 s.

Usa gli stessi provider del catalogo (cache Redis, rate limiting, retry): vedi `06` §8.

Spotify non è interrogato. L'ADR-003 prevedeva iTunes → Deezer → Spotify: la discrepanza è aperta
(vedi `04`). Il client web pre-carica le anteprime nei Reels; il buffer circolare a 3 player è
previsto solo per mobile.

### 5.3 Link universali in chat

`ChatService` allega a ogni messaggio con brano `universalLinks`: Spotify e Deezer se l'id è
noto, Apple Music via ISRC (o ricerca per metadati), più un link OpenMusic. YouTube Music e i
deep-link nativi (`spotify://`, `music://`) non sono ancora generati.

### 5.4 Notifica persistente mobile (ADR-004)

`GET /api/notifications/presence-summary` restituisce il riepilogo "chi sta ascoltando". Il widget
Android (ongoing notification) e iOS (Lock Screen widget + Live Activity) non esistono ancora: in
`apps/mobile` c'è solo un componente React Native che li simula.

## 6. Modello dati

Schema: `packages/db/prisma/schema.prisma`. Migrazioni: `packages/db/prisma/migrations`.

- **Utenti e social:** `User` (ruolo, `passwordHash`, `sessionVersion`, `isGhostMode`),
  `ConnectedAccount` (Spotify/Last.fm/Apple Music), `Follows`, `Notification`.
- **Catalogo:** `Release` (punteggi pubblico/critica, `dominantColor`, id esterni `deezerId`/
  `itunesId`/`musicbrainzId`/`upc`, `coverSource`, `matchKey`, `metadataSyncedAt`, `enrichedAt`),
  `Track` (ISRC, `previewUrl`, numeri traccia, id esterni), `Artist` (id esterni). Import e
  deduplica: `06` §8.
- **Recensioni:** `Review` (una per utente e release, una per utente e brano), `ReviewReaction`
  (enum `ReactionType`), `ScrobbleLog`.
- **Contenuti:** `Post`, `PostLike`, `PostSave`, `Playlist`, `PlaylistTrack` (lato A/B),
  `ChatMessage`, `MusicVideoContent`.

## 7. Web: come i dati arrivano alle pagine

- `apps/web/src/lib/api`: un oggetto `api` per dominio (`api.feed.list`, `api.reviews.upsert`...);
  ogni risposta è validata con lo schema condiviso, gli errori diventano `ApiError`.
- `AuthProvider` in `app/layout.tsx`; pagine protette con `RequireAuth`.
- `lib/socket`: una connessione Socket.io con cookie, `useFriendsPresence`, `useSocketEvent`.
- Dati pubblici caricati lato server: `/releases/[id]` (con metadati OpenGraph e JSON-LD),
  `/explore` (prima pagina e generi) e `/videos`. Le pagine legate alla sessione (home, chat,
  notifiche, profilo, impostazioni, Reels, critici) caricano i dati lato client con il cookie.
