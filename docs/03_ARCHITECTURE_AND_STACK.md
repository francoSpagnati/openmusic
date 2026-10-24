# 03 · Architettura, stack e algoritmi

> Descrive il sistema **com'è oggi** nel codice. Il riferimento endpoint-per-endpoint (auth, codici
> di errore, eventi socket) è [`06_API_AND_AUTH.md`](./06_API_AND_AUTH.md); qui c'è la mappa. Unifica
> il precedente `architettura_tecnica_algoritmi_e_schema_db.md` (il suo schema Prisma copiato a
> mano era superato: lo schema vero è `packages/db/prisma/schema.prisma`).

## 1. Stack

| Livello        | Tecnologia (versione nel repo)                                                            | Note                                                   |
| -------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Monorepo       | Turborepo 2 + npm workspaces, TypeScript 5 strict                                         | `tsconfig.base.json`, ESLint 8 flat config, Prettier 3 |
| API            | Fastify 5, Socket.io 4, ioredis, `@fastify/jwt`, `cookie`, `cors`, `helmet`, `rate-limit` | `apps/api`, avvio con `node --import tsx`              |
| Database       | PostgreSQL 16 + Prisma 5 (migrazioni versionate)                                          | `packages/db`                                          |
| Cache/presenza | Redis 7                                                                                   | Stato "Now Playing" con TTL, cache heavy rotation      |
| Web            | Next.js 16 App Router (Turbopack), React 19.3, Tailwind, Phosphor                         | `apps/web`                                             |
| Mobile         | Expo SDK 58, React Native 0.88, React 19.3, expo-router, expo-secure-store, expo-audio    | `apps/mobile` (ADR-011; mai provato su device, `04`)   |
| Catalogo       | Deezer, iTunes Search, MusicBrainz, Cover Art Archive via `fetch` globale (nessun SDK)    | §8 e ADR-010; testato solo con fixture                 |
| Contratti      | Zod 3 in `packages/shared` (schemi, tipi, eventi WS, `THEME`)                             | Importati da api, web e mobile                         |
| Test           | Vitest 2 (unit + integrazione), Playwright 1.56 (e2e)                                     | CI: `.github/workflows/ci.yml`                         |

Non presenti, anche se citati in versioni precedenti dei documenti: NestJS, BullMQ, un pacchetto
`ui-tokens` separato (i token stanno in `THEME`), Skia, un SDK Spotify per il catalogo.

Runtime: Node **>= 22.13** (`.nvmrc` = 22), richiesto da Expo SDK 58 / React Native 0.88.

## 2. Struttura

```text
apps/api/src
├── app.ts                 # buildApp(): plugin, decorator auth, error handler, rotte
├── server.ts              # avvio HTTP + Socket.io + Redis
├── config/                # env validato (JWT_SECRET obbligatorio in produzione)
├── lib/                   # auth, errors, error-handler, password, realtime, upstream, keyed-mutex,
│                          # dominant-color, mappers, follows
├── modules/<dominio>/     # <dominio>.routes.ts (validazione + auth) + <dominio>.service.ts (logica)
└── modules/catalog/providers/  # un client per Deezer, iTunes, MusicBrainz, Cover Art Archive
apps/api/scripts           # catalog-import.ts, catalog-smoke.ts
apps/api/test/fixtures     # risposte registrate dei provider (catalog/) e immagini di test
apps/web/src
├── app/                   # pagine App Router (/, auth, explore, releases/[id], reels, chat, ...)
├── components/ui          # primitive del design system
├── components/…           # componenti di dominio (discovery, web-social, web-core)
└── lib/{api,auth,socket,url}  # client REST tipizzato, AuthProvider, hook socket, URL sicuri
apps/mobile
├── app/                   # route expo-router: (auth), (tabs), release/[id], profile/[id], chat/[userId]...
└── src/{lib,features,components,theme}  # client Bearer, AuthProvider, socket, schermate, primitive
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
| `now-playing`   | `/api/now-playing` + socket | Presenza live in Redis, Ghost Mode, gateway Socket.io, poller Spotify/Last.fm        |
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

1. Il client invia `now_playing:update_track` sul socket, oppure il **poller** dell'API legge da
   solo Spotify e Last.fm (§4.1), oppure il web chiama `POST /api/spotify/sync-playback`
   ("Sincronizza ora", fallback manuale che registra anche uno `ScrobbleLog`).
2. `NowPlayingService` scrive `presence:user:{id}` in Redis con `SETEX` 300 s.
3. Il server emette `now_playing:friend_presence_changed` **solo nelle stanze `user:<id>` dei
   follower**. Alla connessione ogni socket riceve `now_playing:initial_friends_state`.
4. Ghost Mode (`now_playing:toggle_ghost` o `PATCH /api/auth/me`) passa sempre da
   `NowPlayingService.setGhostMode`, che pubblica subito lo stato nascosto.

**Limite attuale:** Socket.io usa l'adapter **in memoria**: tutto funziona con una sola istanza
API (il poller di §4.1 invece è già pronto per più istanze: stato e lease in Redis). Per scalare orizzontalmente serve `@socket.io/redis-adapter` (Redis Pub/Sub), non ancora
presente. La sessione del socket è verificata alla connessione e ricontrollata sul DB agli eventi
(al massimo ogni 15 s per socket); il socket si
chiude alla scadenza del token, al logout (solo le connessioni di quella sessione) e al cambio
password (`06` §5).

### 4.1 Lettura automatica di Spotify e Last.fm (ADR-013)

```text
server.ts ── start() ──> NowPlayingPoller (ogni istanza, tick 1 s, concorrenza limitata)
                           │ ZRANGEBYSCORE np:poll:due  → utenti da leggere
                           │ SET np:poll:lease:<id> NX PX 60s  → una sola istanza per utente
                           ├─> SpotifySyncService.getValidAccessToken (refresh; 401 → refresh + 1 retry)
                           │     └─> SpotifyService.fetchCurrentlyPlaying   (RateLimiter + CircuitBreaker)
                           ├─> LastFmService.getRecentTracks (limit 1, extended; solo se Spotify non suona)
                           ├─> np:poll:state:<id>  confronto con l'ultima lettura
                           │     cambiato → NowPlayingThrottle (2 s, condiviso col gateway) → NowPlayingService
                           │     uguale   → solo rinnovo del TTL della presenza
                           ├─> ScrobbleRecorder.claim (SET NX EX 180) → BackgroundQueue:
                           │     catalogo locale (ISRC / id Spotify / titolo) → Deezer → riga minima
                           ├─> ProviderSyncStore (syncStatus, lastSyncedAt, syncError)
                           └─> ZADD np:poll:due <prossima lettura>  (25 s / 3 min / stop, ±20 %)
sweep ogni 60 s (lease np:poll:sweep): PAUSED dopo N giorni senza visite, ripresa, ZADD NX dei collegati
ListeningActivity: np:online (socket, heartbeat 60 s) e User.lastSeenAt (socket, GET /api/auth/me)
```

- **Dove:** `apps/api/src/modules/now-playing/` (`now-playing.poller.ts`, `poll-scheduler.ts`,
  `listening-activity.ts`, `provider-sync.store.ts`, `scrobble-recorder.ts`,
  `now-playing.throttle.ts`). Il poller è costruito in `buildApp` (i test lo pilotano con
  `runOnce()`, orologio e `fetch` finti) ma **avviato solo da `server.ts`** se
  `NOW_PLAYING_POLLER_ENABLED` è vero (default; `false` in test, CI e Playwright).
- **Intervalli:** veloce se l'utente o un suo follower ha un socket aperto o se ha ascoltato
  qualcosa negli ultimi 10 min; lento altrimenti; nessuna lettura dopo N giorni senza visite
  (account `PAUSED`, ripresi alla visita successiva). Collegare o ricollegare un account e aprire
  l'app anticipano la lettura.
- **Stato in Redis**, quindi riavvii e più istanze non perdono né duplicano letture; i 429
  mettono in pausa il provider per tutte le istanze (`np:poll:backoff:<provider>`).
- **Errori:** token revocato, accesso negato (Spotify 403), profilo Last.fm privato o inesistente
  → account `ERROR`, nessuna lettura finché non viene ricollegato; errori temporanei → stato
  `ACTIVE` con `syncError`.
- **Ghost Mode:** nessuna presenza scritta o trasmessa dal poller; lo scrobble privato sì.
- **Arresto:** SIGTERM/SIGINT → `poller.stop()` (attende le letture in corso), poi socket, HTTP,
  Redis, Prisma.
- `GET /api/now-playing/sync-status` espone lo stato a web e mobile (`06` §4). Variabili: `06` §7.

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

- **Utenti e social:** `User` (ruolo, `passwordHash`, `sessionVersion`, `isGhostMode`,
  `lastSeenAt`), `ConnectedAccount` (Spotify/Last.fm/Apple Music, con `syncStatus`,
  `lastSyncedAt`, `syncError` per la lettura automatica), `Follows`, `Notification`.
- **Catalogo (ADR-012):** `ReleaseGroup` (l'album come opera: MBID del release group, titolo
  senza marcatori, `primaryType`, `firstReleaseYear`, `editionsSyncedAt`) e `Release` = una
  **edizione** (punteggi pubblico/critica, `dominantColor`, id esterni `deezerId`/`itunesId`/
  `musicbrainzId`/`upc`, `editionLabel`, `disambiguation`, `country`, `format`, `releaseStatus`,
  `releaseGroupId`, `coverSource`, `matchKey`, `metadataSyncedAt`, `enrichedAt`), `Track` (ISRC,
  `previewUrl`, numeri traccia, id esterni), `Artist` (id esterni). Import e deduplica: `06` §8.
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

## 8. Catalogo esterno: livello dei provider

Scelta dei servizi e alternative: ADR-010. Riferimento operativo (endpoint, opzioni degli script,
variabili): `06` §8. Qui la struttura.

```text
catalog.routes.ts ──> CatalogService ──> CatalogImportService ──> Prisma (Release/Track/Artist)
                          │                    │  KeyedMutex per chiave di match
                          │                    └─> CatalogEnrichmentService (coda in-process, 2 alla volta)
                          │                           MusicBrainz → Cover Art Archive → colore dominante
                          ├─> AudioPreviewResolverService (Deezer → iTunes)
                          └─> CatalogProviders (providers/index.ts)
                                 deezer · itunes · musicbrainz · coverArtArchive
                                 └─> UpstreamClient (lib/upstream.ts), uno per provider
```

### 8.1 Provider

Ogni provider (`providers/<nome>.provider.ts`) conosce gli URL del servizio, valida la risposta con
uno schema Zod scritto sulla **forma documentata** dell'API e la converte nei tipi neutri di
`providers/types.ts` (album, brano, artista con `externalId`, ISRC, UPC, cover, anteprima). Il resto
dell'API non vede mai il JSON di Deezer o di Apple. Tutti usano il `fetch` globale di Node: nessun
SDK, nessuna dipendenza npm aggiunta. `createCatalogProviders()` accetta un `fetch` iniettabile: i
test lo sostituiscono con le fixture di `apps/api/test/fixtures/catalog`, e in modalità test
l'API rifiuta le chiamate reali.

| Provider          | Ruolo                                      | Limite (token bucket)    | Cache Redis                 |
| ----------------- | ------------------------------------------ | ------------------------ | --------------------------- |
| Deezer            | primario: ricerca, album, brani, ISRC, UPC | burst 10, poi 1 / 110 ms | ricerche 1 h, dettagli 24 h |
| iTunes Search     | fallback ricerca/anteprime, artwork        | burst 3, poi 1 / 3 s     | ricerche 6 h, lookup 24 h   |
| MusicBrainz       | arricchimento canonico (MBID, generi)      | 1 / 1,1 s, User-Agent    | 7 giorni                    |
| Cover Art Archive | cover di riserva per MBID                  | 1 / 250 ms               | 7 giorni (404: 24 h)        |

### 8.2 `UpstreamClient`

Un'istanza per provider, con:

- **cache** `upstream:<provider>:<sha1(url)>` in Redis (in memoria negli script), anche per i 404;
- **rate limiter** a token bucket in ordine FIFO con **coda limitata** (oltre la coda la chiamata
  fallisce subito invece di accumulare latenza);
- **timeout** 5 s per richiesta, **retry** con backoff esponenziale su 429/5xx/errori di rete, nel
  rispetto di `Retry-After`;
- **circuit breaker**: dopo 3 errori consecutivi il provider è saltato per 30 s;
- interruttore globale `CATALOG_EXTERNAL_ENABLED=false`: ricerca solo locale, `resolve` e
  `preview` senza alcuna chiamata in uscita (coperto da un test che conta le chiamate).

Limiti noti: rate limiter e circuit breaker sono **per processo** (con più istanze API, o con
`catalog:import` lanciato accanto al server, lo stesso IP può superare 1 req/s su MusicBrainz).

### 8.3 Identità: UUID interni, id esterni come attributi

- `Release`, `Track` e `Artist` hanno sempre un **UUID interno**: è l'unico id che i client vedono
  e che le rotte accettano (recensioni, chat, playlist). Gli id esterni sono colonne opzionali e
  uniche: `deezerId`, `itunesId`, `musicbrainzId` (+ release group / recording), `upc`, `isrc`.
- Ordine di match per non creare duplicati (ADR-012, una riga `Release` = una edizione): id dello
  stesso provider → UPC → MBID di release → titolo **con** marcatori di edizione + artista + anno +
  numero di tracce, senza id in conflitto (`compareEditions` / `editionMatchKey` in
  `packages/shared/src/catalog-edition.ts`). Per i brani: id → ISRC → `matchKey` dentro la
  release (`catalogMatchKey`). Così la stessa edizione da Deezer, iTunes, MusicBrainz o dal seed
  converge su una riga, le righe del seed vengono arricchite sul posto senza perdere recensioni e
  post collegati, e remaster, deluxe e album omonimi di anni diversi restano righe distinte
  collegate al loro `ReleaseGroup` (per MBID del release group, altrimenti titolo senza marcatori e
  artista, con controllo dell'anno).
- `coverSource` (`DEEZER | ITUNES | COVER_ART_ARCHIVE`), `metadataSyncedAt` ed `enrichedAt`
  registrano provenienza e freschezza.
- **Concorrenza:** "cerca la riga, altrimenti creala" è serializzato per chiave di match con
  `KeyedMutex` (`lib/keyed-mutex.ts`) dentro un processo; tra processi diversi decidono i vincoli
  unique, e su un conflitto l'importer rilegge la riga vincente e la aggiorna invece di inserirne
  un'altra. Testato con import paralleli su fixture.
- Album omonimi dello stesso artista (es. i vari "Weezer") restano distinti: anno, numero di
  tracce, UPC e MBID li separano; un id agganciato per errore da un risultato di ricerca senza
  data viene staccato al primo import completo. `npm run catalog:audit` trova le righe fuse dal
  vecchio dedupe (`06` §8).

### 8.4 Immagini e colore dominante

Le cover restano sui CDN dei provider (nessuna copia locale). Il web le ottimizza solo per gli
host di `apps/web/image-hosts.mjs`; l'API scarica soltanto una miniatura da 64 px, e solo da URL
restituiti da un provider con host esatto o sottodominio (`dzcdn.net`, `mzstatic.com`,
`coverartarchive.org`, `archive.org`), per calcolare `dominantColor` con un decoder PNG/JPEG-DC in
TypeScript (`lib/dominant-color.ts`, con limiti di dimensione contro le decompression bomb).
