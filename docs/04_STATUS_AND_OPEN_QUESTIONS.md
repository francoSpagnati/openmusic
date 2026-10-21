# 04 · Stato del progetto e questioni aperte

> **Ultimo aggiornamento:** 2026-10-21, branch `ccr-8d035389-g64pel`.
> Questo documento dice cosa **funziona davvero**, cosa è parziale e cosa manca. Le versioni
> precedenti segnavano come "completate" milestone che erano solo componenti su dati mock: qui
> una voce è "reale" solo se è collegata all'API, persiste su database ed è coperta da test o
> verificata a mano.

## 1. Verifiche (stato del branch)

| Controllo                                  | Esito locale                           |
| ------------------------------------------ | -------------------------------------- |
| `npm run lint`                             | passa (api, db, shared, web + e2e)     |
| `npm run typecheck`                        | passa su 5/5 pacchetti, mobile incluso |
| `npm test` (dopo `db:test:prepare`)        | shared 33/33, api 72/72                |
| Build web (`next build`)                   | passa                                  |
| `npm run e2e` (Playwright, 5 test)         | passa in locale                        |
| CI GitHub (`ci.yml`, job `verify` + `e2e`) | **non ancora eseguita su GitHub**      |

Non verificabili nell'ambiente di sviluppo usato (senza rete esterna): copertine reali, Google
Fonts, anteprime Deezer/iTunes, OAuth Spotify/Last.fm reali.

## 2. Cosa è reale

### Piattaforma e API

- Monorepo Turborepo, Docker Compose (Postgres 16 + Redis 7), `.env.example` unico.
- Prisma con **migrazioni versionate** (3) e seed con utenti, release, recensioni e post.
- **Account locali** email + password (scrypt), JWT in cookie httpOnly o Bearer, revoca delle
  sessioni al cambio password, ruoli `USER`/`CRITIC`/`MODERATOR`/`ADMIN` riletti dal DB.
- Error handler centrale con formato `ApiErrorBody`, nessun dettaglio interno nelle risposte.
- Helmet, CORS ristretto, rate limit su auth (10/min) e catalogo (60/min), timeout 5 s verso i
  provider, URL utente solo `http(s)`.
- Socket.io autenticato dal token; presenza inviata solo ai follower; Ghost Mode immediata.
- Social: follow, suggerimenti, feed post (following/global), like, salvati, notifiche persistenti
  e live, chat 1-a-1 con brani, reazioni e "ascoltato".
- Recensioni: upsert (una per utente e release/brano), reazioni `AGREE`/`WELL_WRITTEN`/
  `DISCOVERED`/`HEART`, **peso 1.5 per ascolto verificato**, ricalcolo coerente dei punteggi
  pubblico e critica.
- Critica: richiesta di accredito, coda e approvazione **solo ADMIN**, recensioni della critica,
  dual score. Video: pubblicazione per CRITIC/MODERATOR/ADMIN, feed e video per release.
- Catalogo: ricerca locale + import on-the-fly da Deezer/iTunes, elenco per genere, anteprime 30 s
  (Deezer → iTunes).
- Spotify collegato: currently playing, sync playback con scrobble, heavy rotation in cache, top
  artisti, export playlist.

### Web (`apps/web`) — tutte le pagine sull'API reale, nessun dato mock

| Pagina                          | Cosa fa                                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/auth`                         | Registrazione e login, redirect sicuro a `?next=`                                                         |
| `/`                             | Feed (seguiti/globale), composizione post, amici in ascolto, suggerimenti                                 |
| `/explore`                      | Ricerca, filtri per genere/ordinamento, griglia release, Roulette dei generi                              |
| `/releases/[id]`                | Scheda SSR con SEO, tracklist, anteprime, dual score, recensioni e reazioni, compositore con bozza locale |
| `/reels`                        | Feed verticale con anteprime pre-caricate                                                                 |
| `/chat`                         | Inbox, conversazione, invio brano, reazioni, "ascoltato", aggiornamenti live                              |
| `/notifications`                | Elenco, segna come lette, arrivo live                                                                     |
| `/profile`, `/profile/[handle]` | Profilo, statistiche, heavy rotation, follow                                                              |
| `/settings`                     | Profilo, password, Ghost Mode, collegamento Spotify/Last.fm                                               |
| `/critics`                      | Richiesta di accredito, coda ADMIN                                                                        |
| `/videos`                       | Feed video, pubblicazione per ruoli abilitati                                                             |

L'unico dato statico rimasto è l'elenco di generi di riserva in `GenrePicker`, usato solo se il
catalogo non risponde. Le immagini di avatar e copertine del seed puntano a Unsplash.

### Test e strumenti

- ESLint + Prettier configurati; CI con job `verify` (lint, typecheck, test, build) ed `e2e`.
- 105 test Vitest (unit su `packages/shared`, integrazione su Postgres/Redis reali in `apps/api`).
- Playwright smoke: registrazione, login, feed, apertura release, recensione, messaggio in chat.

## 3. Cosa è parziale o manca

### Prodotto / API

- [ ] **Media bayesiana** (ADR-001): non applicata, `audienceAvg` è una media pesata semplice.
- [ ] **Ordine del resolver anteprime** diverso dall'ADR-003 (vedi §5).
- [ ] **Id Deezer** (`deezer-…`): accettati solo in chat; post, recensioni, playlist e pagine
      release richiedono UUID, quindi un brano importato al volo da Deezer non è recensibile finché
      non è nel catalogo.
- [ ] **OAuth Spotify/Last.fm:** dopo il consenso l'utente atterra sul JSON dell'API invece di
      tornare all'app.
- [ ] Endpoint mancanti: reset password, eliminazione recensione, like/salvataggio di un reel,
      paginazione dei messaggi più vecchi e dei Reels.
- [ ] **Playlist:** API presenti, nessuna pagina web.
- [ ] Apple Music, YouTube Music e deep-link nativi nei link universali: non implementati.
- [ ] Estrazione automatica del colore dominante dalle copertine (oggi viene dal seed).
- [ ] Undo nei Reels e nella Roulette (euristica di Nielsen #3).

### Realtime

- [ ] Un messaggio in chat arriva live solo al destinatario: le altre schede del mittente e le
      reazioni non si aggiornano.
- [ ] Il badge "non lette" non scende dopo "segna tutte come lette".
- [ ] Il socket resta autenticato dopo logout o cambio password (il token si verifica solo alla
      connessione); gli aggiornamenti now-playing non hanno throttling.
- [ ] Adapter Socket.io in memoria: una sola istanza API (serve l'adapter Redis per scalare).

### Sicurezza e privacy (decisioni da prendere)

- [ ] Chiunque può scrivere in chat a chiunque: nessun requisito di follow, blocco o rate limit.
- [ ] Follow senza approvazione: chi ti segue vede l'ascolto live se Ghost Mode è spenta; la heavy
      rotation è pubblica anche con Ghost Mode attiva.
- [ ] `next.config.mjs` permette a `next/image` qualunque host https (proxy di immagini aperto).
- [ ] Salvataggio recensione e ricalcolo punteggi non sono in un'unica transazione.

### Repository

- [ ] File `LICENSE` (MIT) assente.
- [ ] Prima esecuzione della CI su GitHub.
- [ ] Alcuni file preesistenti (mobile, 3 file API) non sono formattati con Prettier.

### Minori

- [ ] Una release inesistente mostra la pagina "non trovato" ma in dev risponde 200 (non
      ricontrollato sulla build di produzione).
- [ ] Titoli troncati in "Dischi del momento" a 1280 px.

## 4. Mobile (`apps/mobile`): stato e prossimi passi

**Stato:** prototipo. I componenti (`LiveFriendsBar`, `ReleaseHeaderCard`, `ReviewComposer`,
`DiscoveryReelsFeed`, `GenreRouletteWheel`, `MusicChatBubble`, `ThemedPlaylistView`,
`NotificationPresenceWidget`, `DualScoreCard`...) esistono e compilano, ma `App.tsx` usa dati mock
(`MOCK_SOCIAL_POSTS`, un `userId` fisso) e non c'è login. `useNowPlayingSocket` usa ancora
`auth: { userId }`, che **l'API ora rifiuta**: il mobile oggi non riceve presenza.
`NotificationPresenceWidget` è un componente React Native, non un widget di sistema.

Prossimi passi, in ordine:

1. Client API condiviso o portato da `apps/web/src/lib/api` (stessi schemi Zod), con token Bearer
   in `expo-secure-store`.
2. Schermate login/registrazione; gestione del 401 (sessione revocata dopo cambio password).
3. Socket con `auth: { token }` al posto di `auth: { userId }`.
4. Navigazione (Expo Router) e sostituzione dei mock con feed, release, recensioni, chat.
5. Font Fraunces / Plus Jakarta Sans / JetBrains Mono con `expo-font` (oggi non caricati).
6. Solo dopo: modulo Android (ongoing notification, `NotificationListenerService`) e widget iOS /
   Live Activity (ADR-004).

## 5. Questioni aperte

1. **Ordine del resolver anteprime (ADR-003):** il codice usa Deezer → iTunes, l'ADR dice
   iTunes → Deezer → Spotify. Decidere se aggiornare l'ADR (Spotify è comunque inaffidabile per le
   nuove app) o il codice.
2. **Media bayesiana:** attivarla ora (con `m` e `C` dell'ADR-001) o quando il catalogo ha abbastanza
   recensioni?
3. **Chi può scrivere in chat e vedere l'ascolto live:** solo mutual? follow con approvazione?
4. **Hosting (ADR-005):** confermare Vercel (web) + Railway/Fly (API con WebSocket) + Neon/Supabase
   - Upstash; richiede web e API sullo stesso dominio registrabile per il cookie
     (`COOKIE_DOMAIN`, vedi `06` §1).
5. **Licenza:** aggiungere `LICENSE` MIT con il titolare corretto.
