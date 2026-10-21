# 06 · API, autenticazione e client web

Riferimento per chi lavora su `apps/api` e su `apps/web`. I contratti (schemi Zod e tipi) stanno in
`packages/shared`; questo documento descrive le regole che li circondano.

## 1. Sessione e autenticazione

**Account locali (email + password)** sono il metodo di accesso principale. Spotify e Last.fm sono
account _collegati_ opzionali.

| Aspetto         | Scelta                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------- |
| Hash password   | `scrypt` di `node:crypto` (N=2^15, r=8, p=1, salt 16 byte), formato `scrypt$N$r$p$salt$hash` |
| Policy password | 10–128 caratteri, nessuna regola di composizione (NIST 800-63B)                              |
| Token           | JWT HS256, `sub` = id utente, scadenza `JWT_EXPIRES_IN_SECONDS` (default 7 giorni)           |
| Ruolo           | **Non** nel token: viene riletto dal DB a ogni richiesta (un ruolo revocato vale subito)     |
| `JWT_SECRET`    | Obbligatorio in produzione, minimo 32 caratteri. In dev, se assente, chiave effimera         |
| Rate limit      | `register`, `login`, `password`: `AUTH_RATE_LIMIT_MAX` richieste/minuto per IP (default 10)  |

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

| Metodo     | Path                                                | Auth                            | Note                                             |
| ---------- | --------------------------------------------------- | ------------------------------- | ------------------------------------------------ |
| GET        | `/health`                                           | —                               |                                                  |
| POST       | `/api/auth/register`                                | — (rate limit)                  | 201 `AuthSessionResponse` + cookie               |
| POST       | `/api/auth/login`                                   | — (rate limit)                  | `AuthSessionResponse` + cookie                   |
| POST       | `/api/auth/logout`                                  | —                               | 204, cancella il cookie                          |
| GET        | `/api/auth/me`                                      | auth                            | `MeResponse`                                     |
| PATCH      | `/api/auth/me`                                      | auth                            | `UpdateProfileSchema` (strict) → `MeResponse`    |
| POST       | `/api/auth/password`                                | auth (rate limit)               | 204                                              |
| GET        | `/api/auth/spotify/login`                           | —                               | `{ url }` + cookie di stato                      |
| GET        | `/api/auth/spotify/callback`                        | opt                             | collega o accede; 403 se `state` non valido      |
| GET        | `/api/auth/lastfm/login`                            | —                               | `{ url }`                                        |
| GET        | `/api/auth/lastfm/callback`                         | auth                            | collega Last.fm                                  |
| DELETE     | `/api/auth/providers/:provider`                     | auth                            | scollega SPOTIFY/LASTFM/APPLE_MUSIC              |
| GET        | `/api/users/search?q=`                              | opt                             | `UserSummaryPage`                                |
| GET        | `/api/users/:userId/followers`                      | opt                             | `UserSummaryPage`                                |
| GET        | `/api/users/:userId/following`                      | opt                             | `UserSummaryPage`                                |
| PUT        | `/api/users/:userId/follow`                         | auth                            | idempotente → `FollowState`, notifica FOLLOW     |
| DELETE     | `/api/users/:userId/follow`                         | auth                            | `FollowState`                                    |
| GET        | `/api/users/:userId/posts`                          | opt                             | `PostPage`                                       |
| GET        | `/api/feed?scope=following\|global`                 | opt                             | `PostPage` (anonimi: sempre global)              |
| POST       | `/api/posts`                                        | auth                            | 201 `Post`                                       |
| GET        | `/api/posts/saved`                                  | auth                            | `PostPage`                                       |
| GET        | `/api/posts/:id`                                    | opt                             | `Post`                                           |
| DELETE     | `/api/posts/:id`                                    | auth (autore, MODERATOR, ADMIN) | 204                                              |
| PUT/DELETE | `/api/posts/:id/like`                               | auth                            | `PostLikeState`, notifica POST_LIKE              |
| PUT/DELETE | `/api/posts/:id/save`                               | auth                            | `PostSaveState`                                  |
| GET        | `/api/notifications?unreadOnly=`                    | auth                            | `NotificationPage`                               |
| GET        | `/api/notifications/unread-count`                   | auth                            | `{ count }`                                      |
| POST       | `/api/notifications/read`                           | auth                            | `{ ids? }` → `{ updated }`                       |
| GET        | `/api/notifications/presence-summary`               | auth                            | ADR-004                                          |
| GET        | `/api/now-playing/friends`                          | auth                            | `FriendPresence[]`                               |
| GET        | `/api/chat/conversations`                           | auth                            | `ConversationSummary[]` (inbox)                  |
| GET        | `/api/chat/conversation/:otherUserId`               | auth                            | ultimi 50 messaggi, dal più vecchio              |
| POST       | `/api/chat/conversation/:otherUserId/read`          | auth                            | `{ updated }`                                    |
| POST       | `/api/chat/messages`                                | auth                            | 201 `ChatMessage`, push `chat:message`           |
| POST       | `/api/chat/reaction`                                | auth (solo destinatario)        | `ChatMessage`                                    |
| POST       | `/api/chat/listened`                                | auth (solo destinatario)        | `ChatMessage`, notifica TRACK_LISTENED           |
| GET        | `/api/catalog/search?q=`                            | —                               | `SearchResult`                                   |
| GET        | `/api/catalog/releases?genre=&sort=&cursor=&limit=` | —                               | `ReleasePage`                                    |
| GET        | `/api/catalog/genres`                               | —                               | `GenreList`                                      |
| GET        | `/api/catalog/releases/:id`                         | —                               | `CatalogRelease`                                 |
| GET        | `/api/catalog/preview?title=&artist=&isrc=`         | —                               | `AudioPreviewResult`                             |
| POST       | `/api/reviews`                                      | auth                            | crea/aggiorna, 201 `ReviewItem`                  |
| GET        | `/api/reviews/release/:releaseId`                   | opt                             | `ReviewItem[]`                                   |
| POST       | `/api/reviews/reaction`                             | auth                            | toggle, notifica REVIEW_REACTION                 |
| GET        | `/api/profile/me`                                   | auth                            | `UserProfileData`                                |
| GET        | `/api/profile/by-username/:username`                | opt                             | `UserProfileData` (senza email)                  |
| GET        | `/api/profile/:userId`                              | opt                             | `UserProfileData` (senza email)                  |
| GET        | `/api/discovery/reels`                              | opt                             |                                                  |
| GET        | `/api/discovery/roulette`                           | opt                             |                                                  |
| POST       | `/api/playlists`                                    | auth                            | 201 `PlaylistDetails`                            |
| POST       | `/api/playlists/track`                              | auth (proprietario)             | `PlaylistDetails`                                |
| GET        | `/api/playlists/user/:userId`                       | opt                             | solo pubbliche, salvo proprietario               |
| GET        | `/api/playlists/:id`                                | opt                             | 404 se privata e non tua                         |
| POST       | `/api/critic/accredit`                              | auth                            | richiesta in attesa (`PENDING`), ruolo invariato |
| GET        | `/api/critic/accreditation`                         | auth                            | stato della propria richiesta                    |
| GET        | `/api/critic/requests`                              | ADMIN                           | coda richieste                                   |
| POST       | `/api/critic/verify`                                | ADMIN                           | `{ userId, approve }`, notifica CRITIC_APPROVED  |
| POST       | `/api/critic/reviews`                               | auth + ruolo CRITIC             | 201 `CriticReviewItem`                           |
| GET        | `/api/critic/dual-score/:releaseId`                 | —                               |                                                  |
| GET        | `/api/critic/release/:releaseId`                    | —                               |                                                  |
| POST       | `/api/videos`                                       | CRITIC, MODERATOR, ADMIN        | 201                                              |
| GET        | `/api/videos/feed?category=`                        | —                               |                                                  |
| GET        | `/api/videos/release/:releaseId`                    | —                               |                                                  |
| GET/POST   | `/api/spotify/*`                                    | auth + Spotify collegato        | 409 se non collegato, 502 se Spotify fallisce    |

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
  `notification:new`, `chat:message`. Tipi in `packages/shared/src/realtime.ts`.

## 6. Client web (`apps/web/src/lib`)

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

Tutti gli utenti del seed accedono con password `openmusic-dev` (es.
`francospagnati@openmusic.test`; `admin@openmusic.test` ha ruolo ADMIN).
