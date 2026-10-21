# 06 · API, autenticazione e client web

Riferimento per chi lavora su `apps/api` e su `apps/web`. I contratti (schemi Zod e tipi) stanno in
`packages/shared`; questo documento descrive le regole che li circondano.

## 1. Sessione e autenticazione

**Account locali (email + password)** sono il metodo di accesso principale. Spotify e Last.fm sono
account _collegati_ opzionali.

| Aspetto         | Scelta                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hash password   | `scrypt` di `node:crypto` (N=2^15, r=8, p=1, salt 16 byte), formato `scrypt$N$r$p$salt$hash`                                                      |
| Policy password | 10–128 caratteri, nessuna regola di composizione (NIST 800-63B)                                                                                   |
| Token           | JWT HS256, `sub` = id utente, scadenza `JWT_EXPIRES_IN_SECONDS` (default 7 giorni)                                                                |
| Revoca          | `sv` nel token = `User.sessionVersion`; il cambio password lo incrementa e invalida le altre sessioni (questo dispositivo riceve un cookie nuovo) |
| Ruolo           | **Non** nel token: viene riletto dal DB a ogni richiesta (un ruolo revocato vale subito)                                                          |
| `JWT_SECRET`    | Obbligatorio in produzione, minimo 32 caratteri. In dev, se assente, chiave effimera                                                              |
| Rate limit      | `register`, `login`, `password`: `AUTH_RATE_LIMIT_MAX` richieste/minuto per IP (default 10); `catalog/search` e `catalog/preview`: 60/minuto      |
| Link utente     | Avatar, portfolio, link articolo e video: solo `http(s)` (`HttpUrlSchema`), mai `javascript:`/`data:`                                             |

### Browser: cookie httpOnly

Il web usa **solo il cookie** `om_session` (`HttpOnly`, `SameSite=Lax`, `Secure` in produzione).
Il JavaScript della pagina non vede mai il token: `apiRequest` usa `credentials: 'include'` e il
socket usa `withCredentials: true`.

- In sviluppo web (`localhost:3000`) e API (`localhost:4000`) sono lo stesso _site_, quindi il
  cookie viaggia.
- In produzione web e API devono stare su sottodomini dello stesso dominio
  (`app.openmusic.social` / `api.openmusic.social`) con `COOKIE_DOMAIN=.openmusic.social`.
- CSRF: `SameSite=Lax` blocca il cookie sulle richieste cross-site non-GET; CORS accetta solo
  `CORS_ORIGIN`; le mutazioni usano JSON (preflight obbligatorio).

### App native e script: Bearer

Le stesse rotte accettano `Authorization: Bearer <token>`; il token è nel body di `register`/`login`
(`AuthSessionResponse.token`). Se sono presenti sia header sia cookie vince l'header.

### OAuth collegati

`GET /api/auth/spotify/login` imposta un cookie `om_oauth_state` (10 minuti) e restituisce l'URL di
consenso; il callback rifiuta (403) uno `state` diverso. Un account Spotify nuovo **non** viene mai
collegato in automatico a un account locale con la stessa email (409: accedi e collega dalle
impostazioni).

`GET /api/auth/lastfm/login` usa lo stesso cookie di stato: lo `state` è aggiunto all'URL di callback
e Last.fm lo rimanda insieme al `token`. Un account Last.fm già collegato a un altro utente dà 409
(non viene mai spostato). Le chiamate a Last.fm usano HTTPS.

I callback (`/spotify/callback`, `/lastfm/callback`) sono aperti dal **browser**, quindi non
rispondono mai con JSON: reindirizzano (302) a `WEB_APP_URL` con l'esito in query string.

| Caso                                   | Redirect                                                   |
| -------------------------------------- | ---------------------------------------------------------- |
| Spotify collegato da utente loggato    | `/settings?oauth=spotify&status=success`                   |
| Accesso con Spotify (nessuna sessione) | `/?oauth=spotify&status=success` (+ cookie di sessione)    |
| Errore Spotify, utente loggato         | `/settings?oauth=spotify&status=error&code=<ApiErrorCode>` |
| Errore Spotify, anonimo                | `/auth?oauth=spotify&status=error&code=<ApiErrorCode>`     |
| Last.fm                                | `/settings?oauth=lastfm&status=success\|error[&code=...]`  |

`code` è uno degli `ApiErrorCode` (`FORBIDDEN` = `state` non valido, `BAD_REQUEST` = consenso
negato, `CONFLICT` = account già collegato ad altri, `UNAUTHORIZED` = sessione assente per
Last.fm, `UPSTREAM_ERROR` = provider irraggiungibile). Il percorso è sempre fisso: nessun open
redirect.

## 2. Formato degli errori

Ogni risposta non-2xx ha il corpo `ApiErrorBody` (`packages/shared/src/errors.ts`):

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Dati non validi",
  "fieldErrors": { "password": ["La password deve avere almeno 10 caratteri"] }
}
```

| Status | `code`                                 | Quando                                                    |
| ------ | -------------------------------------- | --------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`                     | Body/query/params non rispettano lo schema Zod condiviso  |
| 400    | `BAD_REQUEST`                          | Regola di dominio violata (es. seguire se stessi)         |
| 401    | `UNAUTHORIZED` / `INVALID_CREDENTIALS` | Sessione assente/scaduta · login errato                   |
| 403    | `FORBIDDEN`                            | Ruolo o proprietà insufficienti                           |
| 404    | `NOT_FOUND`                            | Risorsa inesistente (anche playlist private altrui)       |
| 409    | `CONFLICT`                             | Email/username già usati, Spotify non collegato           |
| 429    | `RATE_LIMITED`                         | Troppi tentativi di accesso                               |
| 502    | `UPSTREAM_ERROR`                       | Spotify/Last.fm non raggiungibili (dettagli solo nei log) |
| 500    | `INTERNAL_ERROR`                       | Bug: messaggio generico, stack solo nei log               |

Le rotte non hanno `try/catch`: lanciano `AppError` (`apps/api/src/lib/errors.ts`) o lasciano
propagare `ZodError`/errori Prisma, e `registerErrorHandling` li traduce.

## 3. Autorizzazione nelle rotte

```ts
fastify.get('/me', { preHandler: fastify.authenticate }, async (request) => {
  const { userId } = requireAuth(request); // AuthContext { userId, role }
});
fastify.get('/public', { preHandler: fastify.optionalAuth }, async (request) => {
  request.auth?.userId; // null se anonimo (token scaduto = anonimo, non 401)
});
fastify.post('/verify', { preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')] }, h);
```

Ruoli: `USER`, `CRITIC`, `MODERATOR`, `ADMIN`. Gli account `ADMIN` si creano solo da DB/seed.

## 4. Endpoint

Legenda auth: **—** pubblico · **opt** sessione facoltativa (personalizza la risposta) · **auth**
sessione obbligatoria · **ROLE** ruolo richiesto.

| Metodo     | Path                                                  | Auth                            | Note                                                                                                      |
| ---------- | ----------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| GET        | `/health`                                             | —                               |                                                                                                           |
| POST       | `/api/auth/register`                                  | — (rate limit)                  | 201 `AuthSessionResponse` + cookie                                                                        |
| POST       | `/api/auth/login`                                     | — (rate limit)                  | `AuthSessionResponse` + cookie                                                                            |
| POST       | `/api/auth/logout`                                    | —                               | 204, cancella il cookie                                                                                   |
| GET        | `/api/auth/me`                                        | auth                            | `MeResponse`                                                                                              |
| PATCH      | `/api/auth/me`                                        | auth                            | `UpdateProfileSchema` (strict) → `MeResponse`                                                             |
| POST       | `/api/auth/password`                                  | auth (rate limit)               | 200 `{ token, expiresAt }` + cookie nuovo; revoca le altre sessioni (il client nativo usa il nuovo token) |
| GET        | `/api/auth/spotify/login`                             | —                               | `{ url }` + cookie di stato                                                                               |
| GET        | `/api/auth/spotify/callback`                          | opt                             | 302 verso il web (vedi §1 "OAuth collegati")                                                              |
| GET        | `/api/auth/lastfm/login`                              | —                               | `{ url }` + cookie di stato                                                                               |
| GET        | `/api/auth/lastfm/callback`                           | opt                             | 302 verso il web; serve una sessione                                                                      |
| DELETE     | `/api/auth/providers/:provider`                       | auth                            | scollega SPOTIFY/LASTFM/APPLE_MUSIC                                                                       |
| GET        | `/api/users/search?q=`                                | opt                             | `UserSummaryPage`                                                                                         |
| GET        | `/api/users/suggestions?limit=`                       | opt                             | utenti da seguire                                                                                         |
| GET        | `/api/users/:userId/followers`                        | opt                             | `UserSummaryPage`                                                                                         |
| GET        | `/api/users/:userId/following`                        | opt                             | `UserSummaryPage`                                                                                         |
| PUT        | `/api/users/:userId/follow`                           | auth                            | idempotente → `FollowState`, notifica FOLLOW                                                              |
| DELETE     | `/api/users/:userId/follow`                           | auth                            | `FollowState`                                                                                             |
| GET        | `/api/users/:userId/posts`                            | opt                             | `PostPage`                                                                                                |
| GET        | `/api/feed?scope=following\|global`                   | opt                             | `PostPage` (anonimi: sempre global)                                                                       |
| POST       | `/api/posts`                                          | auth                            | 201 `Post`                                                                                                |
| GET        | `/api/posts/saved`                                    | auth                            | `PostPage`                                                                                                |
| GET        | `/api/posts/:id`                                      | opt                             | `Post`                                                                                                    |
| DELETE     | `/api/posts/:id`                                      | auth (autore, MODERATOR, ADMIN) | 204                                                                                                       |
| PUT/DELETE | `/api/posts/:id/like`                                 | auth                            | `PostLikeState`, notifica POST_LIKE                                                                       |
| PUT/DELETE | `/api/posts/:id/save`                                 | auth                            | `PostSaveState`                                                                                           |
| GET        | `/api/notifications?unreadOnly=`                      | auth                            | `NotificationPage`                                                                                        |
| GET        | `/api/notifications/unread-count`                     | auth                            | `{ count }`                                                                                               |
| POST       | `/api/notifications/read`                             | auth                            | `{ ids? }` → `{ updated }`                                                                                |
| GET        | `/api/notifications/presence-summary`                 | auth                            | ADR-004                                                                                                   |
| GET        | `/api/now-playing/friends`                            | auth                            | `FriendPresence[]`                                                                                        |
| GET        | `/api/chat/conversations`                             | auth                            | `ConversationSummary[]` (inbox)                                                                           |
| GET        | `/api/chat/conversation/:otherUserId`                 | auth                            | ultimi 50 messaggi, dal più vecchio                                                                       |
| POST       | `/api/chat/conversation/:otherUserId/read`            | auth                            | `{ updated }`                                                                                             |
| POST       | `/api/chat/messages`                                  | auth                            | 201 `ChatMessage`, push `chat:message`                                                                    |
| POST       | `/api/chat/reaction`                                  | auth (solo destinatario)        | `ChatMessage`                                                                                             |
| POST       | `/api/chat/listened`                                  | auth (solo destinatario)        | `ChatMessage`, notifica TRACK_LISTENED                                                                    |
| GET        | `/api/catalog/search?q=&type=&page=&limit=&external=` | — (rate limit)                  | `SearchResult` (vedi §8)                                                                                  |
| GET        | `/api/catalog/resolve?provider=&type=&id=`            | — (rate limit)                  | `CatalogResolveResult` (vedi §8)                                                                          |
| GET        | `/api/catalog/releases?genre=&sort=&cursor=&limit=`   | —                               | `ReleasePage`                                                                                             |
| GET        | `/api/catalog/genres`                                 | —                               | `GenreList`                                                                                               |
| GET        | `/api/catalog/releases/:id`                           | —                               | `CatalogRelease` + tracce (import completo 1ª volta)                                                      |
| GET        | `/api/catalog/preview?title=&artist=&isrc=`           | — (rate limit)                  | `AudioPreviewResult` (Deezer → iTunes, vedi §8)                                                           |
| POST       | `/api/reviews`                                        | auth                            | crea/aggiorna, 201 `ReviewItem`                                                                           |
| GET        | `/api/reviews/release/:releaseId`                     | opt                             | `ReviewItem[]`                                                                                            |
| POST       | `/api/reviews/reaction`                               | auth                            | toggle, notifica REVIEW_REACTION                                                                          |
| GET        | `/api/profile/me`                                     | auth                            | `UserProfileData`                                                                                         |
| GET        | `/api/profile/by-username/:username`                  | opt                             | `UserProfileData` (senza email)                                                                           |
| GET        | `/api/profile/:userId`                                | opt                             | `UserProfileData` (senza email)                                                                           |
| GET        | `/api/discovery/reels`                                | opt                             |                                                                                                           |
| GET        | `/api/discovery/roulette`                             | opt                             |                                                                                                           |
| POST       | `/api/playlists`                                      | auth                            | 201 `PlaylistDetails`                                                                                     |
| POST       | `/api/playlists/track`                                | auth (proprietario)             | `PlaylistDetails`                                                                                         |
| GET        | `/api/playlists/user/:userId`                         | opt                             | solo pubbliche, salvo proprietario                                                                        |
| GET        | `/api/playlists/:id`                                  | opt                             | 404 se privata e non tua                                                                                  |
| POST       | `/api/critic/accredit`                                | auth                            | richiesta in attesa (`PENDING`), ruolo invariato                                                          |
| GET        | `/api/critic/accreditation`                           | auth                            | stato della propria richiesta                                                                             |
| GET        | `/api/critic/requests`                                | ADMIN                           | coda richieste                                                                                            |
| POST       | `/api/critic/verify`                                  | ADMIN                           | `{ userId, approve }`, notifica CRITIC_APPROVED                                                           |
| POST       | `/api/critic/reviews`                                 | auth + ruolo CRITIC             | 201 `CriticReviewItem`                                                                                    |
| GET        | `/api/critic/dual-score/:releaseId`                   | —                               |                                                                                                           |
| GET        | `/api/critic/release/:releaseId`                      | —                               |                                                                                                           |
| POST       | `/api/videos`                                         | CRITIC, MODERATOR, ADMIN        | 201                                                                                                       |
| GET        | `/api/videos/feed?category=`                          | —                               |                                                                                                           |
| GET        | `/api/videos/release/:releaseId`                      | —                               |                                                                                                           |
| GET/POST   | `/api/spotify/*`                                      | auth + Spotify collegato        | 409 se non collegato, 502 se Spotify fallisce                                                             |

Paginazione: `?cursor=<id>&limit=1..50` (default 20), risposta `{ items, nextCursor }`
(`nextCursor` è `null` all'ultima pagina).

## 5. Socket.io

- Handshake: cookie `om_session` (browser, `withCredentials: true`) o `auth: { token }` (nativo).
  Senza sessione valida la connessione è rifiutata con `connect_error` `UNAUTHORIZED`.
  **L'id utente arriva solo dal token**: un `userId` nel payload viene ignorato.
- CORS limitato a `CORS_ORIGIN`.
- Ogni socket entra nella stanza `user:<id>`. La presenza (`now_playing:friend_presence_changed`)
  viene inviata **solo ai follower** dell'utente; all'ultima disconnessione parte uno stato
  `isOnline: false`.
- Eventi client → server accettano un ack opzionale `WsAck` (`{ ok: true }` oppure
  `{ ok: false, code, message }`); payload non validi ricevono `VALIDATION_ERROR` senza
  disconnessione.
- Server → client: `now_playing:initial_friends_state`, `now_playing:friend_presence_changed`,
  `notification:new`, `chat:message`, `session:revoked`. Tipi in
  `packages/shared/src/realtime.ts`.
- **Fine sessione:** il server invia `session:revoked` `{ reason }` e chiude il socket quando
  - `POST /api/auth/logout` → solo i socket aperti con **quel** token (`LOGOUT`);
  - `POST /api/auth/password` → tutti i socket dell'utente (`PASSWORD_CHANGED`); il dispositivo
    che ha cambiato password ha già il cookie nuovo (web) o il token nuovo nella risposta (mobile)
    e può riconnettersi;
  - il token scade mentre il socket è aperto (`EXPIRED`);
  - un evento client trova la sessione non più valida (`INVALID`: `sessionVersion` cambiata o
    utente cancellato; ricontrollo sul DB al massimo ogni 15 s per socket). L'evento riceve prima
    l'ack `{ ok: false, code: 'UNAUTHORIZED' }`.
    Una disconnessione decisa dal server non viene ritentata da socket.io-client.
- **Throttling now-playing:** `now_playing:update_track` viene inoltrato ai follower al massimo
  una volta ogni 2 s per utente; gli aggiornamenti intermedi sono fusi e parte solo l'ultimo alla
  fine della finestra (l'ack è comunque `{ ok: true }`). Attivare Ghost Mode scarta l'eventuale
  aggiornamento in sospeso.

## 6. Client web (`apps/web/src/lib`)

`api.catalog.search(q | { q, type, page, limit, external })` e `api.catalog.resolve({ provider,
type, id })` rispecchiano il §8. La pagina `/releases/external/[provider]/[id]` chiama `resolve`
lato server e reindirizza a `/releases/<uuid>`.

Il client mobile (`apps/mobile/src/lib/api`) espone la stessa superficie (`api.catalog.search`,
`api.auth.changePassword`...) con `Authorization: Bearer`, `credentials: 'omit'`, timeout 15 s e
base URL da `EXPO_PUBLIC_API_URL` (vedi `apps/mobile/README.md`).

```ts
import { api, ApiError, isApiError } from '@/lib/api';
import { useAuth, RequireAuth, useRequireAuth, safeNextPath } from '@/lib/auth';
import { useSocket, useSocketEvent, useFriendsPresence } from '@/lib/socket';

const page = await api.feed.list({ scope: 'following', limit: 20 });
try {
  await login({ email, password });
} catch (err) {
  if (isApiError(err)) setError(err.fieldError('password') ?? err.message);
}
```

- Ogni funzione valida la risposta con lo schema condiviso e lancia `ApiError`
  (`status`, `code`, `message`, `fieldErrors`, `fieldError(name)`); `status` 0 = rete.
- `AuthProvider` è montato in `app/layout.tsx`; `useAuth()` espone `status`
  (`loading | authenticated | anonymous`), `user`, `connectedAccounts`, `login`, `register`,
  `logout`, `refresh`, `updateProfile`.
- `<RequireAuth roles={['ADMIN']} fallback={...}>` e `useRequireAuth()` reindirizzano a
  `/auth?next=<path>`; dopo il login usare `router.replace(safeNextPath(searchParams.get('next')))`.
- `useFriendsPresence()` → `{ friends, connected, error, updateTrack, setGhostMode }`.

## 7. Sviluppo locale

```bash
cp .env.example .env            # poi imposta JWT_SECRET
npm run db:migrate:deploy && npm run db:seed
npm run dev                     # API :4000 + web :3000 (mobile: npm run dev:mobile)
```

Per l'app mobile: `apps/mobile/.env` con `EXPO_PUBLIC_API_URL` raggiungibile dal telefono (IP LAN,
`http://10.0.2.2:4000` sull'emulatore Android); istruzioni complete nel README alla radice.

Tutti gli utenti del seed accedono con password `openmusic-dev` (es.
`francospagnati@openmusic.test`; `admin@openmusic.test` ha ruolo ADMIN).

## 8. Catalogo da database musicali esterni

Release, brani e artisti reali arrivano da database aperti, senza chiavi API:

| Provider          | Uso                                                                                                                                                                                      | Limite rispettato        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Deezer            | primario: ricerca album/brani/artisti, dettaglio album con tracklist e ISRC, cover 1000 px, anteprime, generi, data, etichetta, UPC                                                      | burst 10, poi 1 / 110 ms |
| iTunes Search     | fallback di ricerca, artwork portato a 1000×1000, anteprime                                                                                                                              | burst 3, poi 1 / 3 s     |
| MusicBrainz       | arricchimento canonico (MBID release / release group / recording, etichetta, generi votati) via UPC, ISRC o titolo + artista; `User-Agent: OpenMusic/<versione> ( MUSICBRAINZ_CONTACT )` | 1 richiesta / 1,1 s      |
| Cover Art Archive | cover di riserva per MBID                                                                                                                                                                | 1 richiesta / 250 ms     |

Codice: `apps/api/src/modules/catalog/providers/*` (un provider per servizio, risposte validate
con Zod sulla forma documentata) sopra `UpstreamClient` (`apps/api/src/lib/upstream.ts`): cache
Redis (`upstream:<provider>:<sha1(url)>`, TTL 1 h ricerche – 7 giorni MusicBrainz, anche i 404),
timeout 5 s, retry con backoff esponenziale su 429/5xx/rete (rispetta `Retry-After`), rate
limiter a token bucket per provider con coda limitata, circuit breaker (3 errori consecutivi → provider saltato
per 30 s).

**Import e id.** `CatalogImportService` trasforma i risultati in righe locali con **UUID interni**
e id esterni nelle colonne `deezerId`, `itunesId`, `musicbrainzId`, `upc`, `isrc` (+ tabella
`Artist`). Cerca la riga esistente per id del provider → UPC/ISRC → titolo + artista normalizzati
(`catalogMatchKey` in `@openmusic/shared`), quindi lo stesso album da Deezer, iTunes, MusicBrainz o
dal seed converge su **una** release e ripetere l'import non crea duplicati. Le righe del seed
(senza id esterni) vengono aggiornate sul posto: copertina, data, etichetta, tracklist e ISRC reali,
recensioni e post restano collegati. I client ricevono **sempre** UUID: gli id `deezer-…` non
esistono più (la migrazione `20261021180000_catalog_external_ids` ha convertito quelli vecchi).

**Ricerca** `GET /api/catalog/search` — query `q`, `type=all|releases|tracks`, `page>=1`,
`limit 1..25` (default 10), `external=true|false`. Risposta `SearchResult`:
`{ releases, tracks, page, hasMore, sources }`. Prima i risultati locali, poi quelli esterni
(Deezer; iTunes se Deezer fallisce o non trova nulla, solo a pagina 1) importati al volo e
deduplicati (UPC/ISRC/titolo + artista); ogni lista ha al massimo `limit` elementi. Le pagine
sono indipendenti: chi accoda pagine deduplica per `id`. Se i provider non rispondono la ricerca
restituisce comunque i risultati locali (`sources: ['LOCAL']`): la parte esterna ha un budget
totale di 3,5 s (le chiamate in ritardo continuano e riempiono la cache) e, aperti i circuit
breaker, non aggiunge latenza.

**Apertura** `GET /api/catalog/releases/:id` — una release nota solo come risultato di ricerca
viene completata dal provider la prima volta (tracklist con ISRC e numeri traccia, etichetta,
data, generi, UPC). Colore dominante della cover e arricchimento MusicBrainz/Cover Art Archive
partono in background (coda in-process, max 2 in parallelo).

**Risoluzione** `GET /api/catalog/resolve?provider=deezer|itunes|musicbrainz&type=release|track&id=`
→ `CatalogResolveResult` `{ release: CatalogRelease (con tracce), trackId: uuid | null }`.
Importa al primo uso; accetta anche i vecchi id `deezer-alb-<n>` / `deezer-trk-<n>`. 400 id non
valido, 404 non trovato dal provider, 502 `UPSTREAM_ERROR` provider irraggiungibile.

`CatalogRelease` ha in più `label`, `upc` (senza zeri iniziali), `trackCount`, `coverSource`
(`DEEZER | ITUNES | COVER_ART_ARCHIVE | null`) ed `externalIds`; `CatalogTrack` ha `trackNumber`,
`discNumber`, `externalIds`.

**Anteprime** `GET /api/catalog/preview?title=&artist=&isrc=` → `AudioPreviewResult`
`{ previewUrl, source: DEEZER | ITUNES | NONE, durationSeconds: 30 }`. Ordine: Deezer per ISRC,
poi ricerca Deezer `artist + track`, poi iTunes. `title`/`artist` 1..300 caratteri, `isrc` max 32
(oltre: 400). `SPOTIFY` esiste nell'enum ma il server non lo restituisce mai (ADR-003/ADR-010). Con
`CATALOG_EXTERNAL_ENABLED=false` risponde `NONE` senza chiamate in uscita. Gli URL Deezer sono
firmati e scadono: un client che riceve un errore di riproduzione deve richiamare `/preview`
(il web lo fa, il mobile non ancora).

**Rate limit e concorrenza.** `search`, `resolve` e `preview` sono limitati a 60 richieste/min per
IP. Attenzione: la pagina web `/releases/external/...` chiama `resolve` dal server Next.js, quindi
tutti i visitatori anonimi condividono il limite dell'IP del server web (aperto, `04` §3). Import
paralleli dello stesso album convergono su una sola riga (lock per chiave di match + rilettura su
conflitto unique, `03` §8.3).

**Verifica.** I test (`apps/api/test/catalog-*.test.ts`) usano risposte registrate in
`apps/api/test/fixtures/catalog` con un `fetch` iniettato; con `NODE_ENV=test` l'API non esegue
mai chiamate reali. **Nessuna chiamata live è stata ancora verificata**: farlo con
`npm run catalog:smoke` su una macchina con accesso ai domini elencati nel README.

**Colore dominante** senza dipendenze (`apps/api/src/lib/dominant-color.ts`): si scarica una
copia da 64 px della cover (Deezer e iTunes la generano su richiesta, CAA ha la miniatura 250 px)
e si decodifica in puro TypeScript: PNG completo (zlib di Node), JPEG baseline/progressive
leggendo solo i coefficienti DC dei blocchi 8×8 (la media del blocco). Istogramma pesato verso i
colori saturi.

**Script**

```bash
npm run catalog:smoke                                   # verifica live di ogni provider (exit 1 se uno fallisce)
npm run catalog:import -- --file curated-albums.json    # ~46 album reali (apps/api/data)
npm run catalog:import -- --file curated-albums.json --dry-run --limit 5
npm run db:seed          # seed offline + upgrade dei dischi del seed con dati reali se Deezer risponde
npm run db:seed:offline  # solo seed offline
```

Opzioni di `catalog:import`: `--dry-run`, `--no-enrich` (salta MusicBrainz, 1 req/s),
`--only-local` (solo album già nel DB), `--if-online` (esce con 0 se Deezer è irraggiungibile),
`--limit N`, `--seed-hook` (= `--only-local --if-online --no-enrich`, disattivato da
`CATALOG_SEED_IMPORT=false`).

Variabili: `CATALOG_EXTERNAL_ENABLED` (default `true`; `false` = solo catalogo locale),
`MUSICBRAINZ_CONTACT`, `ITUNES_COUNTRY` (default `IT`), `CATALOG_SEED_IMPORT`, `WEB_APP_URL`.
