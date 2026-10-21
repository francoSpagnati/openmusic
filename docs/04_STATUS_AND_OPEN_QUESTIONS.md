# 04 · Stato del progetto e questioni aperte

> **Ultimo aggiornamento:** 2026-10-21, branch `ccr-8d035389-g64pel`.
> Questo documento dice cosa **funziona davvero**, cosa è parziale e cosa manca. Le versioni
> precedenti segnavano come "completate" milestone che erano solo componenti su dati mock: qui
> una voce è "reale" solo se è collegata all'API, persiste su database ed è coperta da test o
> verificata a mano.

## 1. Verifiche (stato del branch)

| Controllo                                             | Esito locale                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| `npm ci` (copia pulita dei manifest + lockfile)       | passa, lockfile allineato                                     |
| `npm run lint`                                        | passa (api, db, shared, web + e2e)                            |
| `npm run typecheck`                                   | passa su 5/5 pacchetti, mobile incluso                        |
| `npm test` (dopo `db:test:prepare`)                   | shared 41/41, api 130/130 (catalogo su fixture), mobile 58/58 |
| Build web (`next build`)                              | passa                                                         |
| `npm run e2e` (Playwright, 10 test, DB nuovo + seed)  | passa in locale                                               |
| `expo export` iOS + Android (`EXPO_OFFLINE=1`)        | passa (bundle Hermes ~5 MB per piattaforma)                   |
| CI GitHub (`ci.yml`, job `verify` + `mobile` + `e2e`) | round 1 verde su GitHub; questo round non ancora eseguito     |

### 1.1 Verificato dal vivo o solo con fixture?

L'ambiente in cui è stato sviluppato questo round blocca la rete verso i servizi musicali (il
proxy risponde 403 a `CONNECT`). Quindi:

| Area                                                       | Come è verificato                                                      | Live?                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| Parsing delle risposte Deezer/iTunes/MusicBrainz/CAA       | test su fixture JSON scritte sulla forma **documentata** delle API     | **no**                               |
| Import, deduplica, import concorrenti, `resolve`           | test di integrazione su Postgres reale + fixture                       | **no** (DB sì, provider no)          |
| Cache, rate limiter, retry/`Retry-After`, circuit breaker  | test unitari con orologio e `fetch` finti                              | **no**                               |
| `CATALOG_EXTERNAL_ENABLED=false` = zero chiamate in uscita | test che conta le chiamate                                             | n/a                                  |
| Colore dominante                                           | test su immagini PNG/JPEG locali (`test/fixtures/images`)              | **no** (mai su cover reali dei CDN)  |
| Copertine e anteprime reali in web e mobile                | nessuno                                                                | **no**                               |
| `npm run catalog:smoke`                                    | eseguito: **6/6 falliti** per rete bloccata (nessun mock nello script) | **da rifare con rete**               |
| Durata dei token delle anteprime Deezer (`hdnea=exp=…`)    | nessuno                                                                | **no**                               |
| App mobile                                                 | typecheck, Jest (58), `expo export` iOS/Android                        | **no** (mai su device/simulatore/Go) |
| OAuth Spotify/Last.fm, Google Fonts nella build via turbo  | nessuno                                                                | **no**                               |

Le fixture sono plausibili ma non registrate da risposte reali: se un servizio restituisce un
campo con forma diversa dalla documentazione, lo schema Zod del provider scarta la risposta e la
ricerca ricade sui risultati locali. Il primo passo con la rete è `npm run catalog:smoke`, poi
`npm run catalog:import -- --file curated-albums.json --dry-run --limit 5`.

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
- Catalogo da database esterni (`06` §8): provider Deezer (primario), iTunes (fallback),
  MusicBrainz (arricchimento, 1 req/s con User-Agent), Cover Art Archive (cover di riserva), con
  cache Redis, retry/backoff, rate limit e circuit breaker per provider. Import con UUID interni e
  id esterni, deduplica per id/UPC/ISRC/titolo + artista, tracklist completa all'apertura,
  `GET /api/catalog/resolve`, colore dominante calcolato dalla cover senza dipendenze, script
  `catalog:import` (46 album curati) e `catalog:smoke`. **Testato solo con fixture**: nell'ambiente
  di sviluppo usato le API esterne sono bloccate; la verifica live è `npm run catalog:smoke`.
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

- ESLint + Prettier configurati; CI (Node 22 da `.nvmrc`) con job `verify` (lint, typecheck,
  test con `CATALOG_EXTERNAL_ENABLED=false`, build), `mobile` (typecheck, Jest, export iOS/Android
  offline) ed `e2e`.
- Vitest: 41 test in `packages/shared`, 130 in `apps/api` (integrazione su Postgres/Redis reali,
  catalogo su fixture). Jest: 58 test in `apps/mobile`.
- Playwright (10 test): registrazione, login, feed, apertura release, recensione, messaggio in chat.

## 3. Cosa è parziale o manca

### Prodotto / API

- [ ] **Media bayesiana** (ADR-001): non applicata, `audienceAvg` è una media pesata semplice.
- [x] ~~Ordine del resolver anteprime diverso dall'ADR-003~~: ADR-003 emendato da ADR-010 (Deezer → iTunes).
- [x] ~~Id Deezer (`deezer-…`)~~: ora ogni risultato esterno è importato con UUID interno; i vecchi
      id sono stati convertiti dalla migrazione e `resolve` accetta ancora `deezer-alb/trk-<n>`.
- [x] ~~OAuth Spotify/Last.fm su JSON~~: i callback reindirizzano a `WEB_APP_URL`
      (`/settings?oauth=…&status=…`) e il web mostra l'esito (`OAuthReturnNotice`).
- [ ] Endpoint mancanti: reset password, eliminazione recensione, like/salvataggio di un reel,
      paginazione dei messaggi più vecchi e dei Reels.
- [ ] **Playlist:** API presenti, nessuna pagina web.
- [ ] Apple Music, YouTube Music e deep-link nativi nei link universali: non implementati.
- [x] ~~Colore dominante dal seed~~: calcolato all'import dalla cover (JPEG/PNG, `06` §8).
- [ ] Undo nei Reels e nella Roulette (euristica di Nielsen #3).
- [x] ~~Import concorrenti dello stesso album creavano righe duplicate~~: lock per chiave di match
      e fusione sulla riga esistente in caso di conflitto unique (`03` §8.3), con test.
- [x] ~~`/preview` chiamava Deezer/iTunes anche con `CATALOG_EXTERNAL_ENABLED=false`~~.
- [ ] **Catalogo, dalla review dell'import** (non ancora corretti):
  - album omonimi dello stesso artista (es. i vari "Weezer") con id Deezer diversi vengono uniti
    sulla stessa riga per `matchKey` e le tracklist si sommano. Serve una regola (id diverso dello
    stesso provider + anno diverso = release diversa) che non rompa l'unione explicit/clean;
  - `GET /api/catalog/resolve` è limitato a 60/min per IP, ma la pagina web
    `/releases/external/...` lo chiama in SSR dall'IP del server web: tutti gli utenti anonimi
    condividono lo stesso limite. Servono chiave per utente o un IP inoltrato e fidato;
  - gli URL delle anteprime Deezer sono firmati (`hdnea=exp=…`) e scadono, ma `Track.previewUrl`
    non viene mai aggiornato e la ricerca Deezer resta in cache per 1 h. Il web riprova con
    `/preview`, il mobile no. La durata reale dei token va verificata dal vivo;
  - i limiti di frequenza (MusicBrainz 1 req/s) valgono per processo: con più istanze API, o con
    `catalog:import` lanciato insieme al server, lo stesso IP li supera;
  - i termini d'uso di Deezer e Apple (salvataggio permanente dei metadati, attribuzione e link
    allo store per le anteprime) vanno verificati prima della produzione.

### Realtime

- [ ] Un messaggio in chat arriva live solo al destinatario: le altre schede del mittente e le
      reazioni non si aggiornano.
- [ ] Il badge "non lette" non scende dopo "segna tutte come lette".
- [x] ~~Socket autenticato dopo logout/cambio password~~: `session:revoked` + chiusura su logout,
      cambio password, scadenza del token e sessione non più valida agli eventi; now-playing con
      throttling (2 s per utente). Vedi `06` §5.
- [ ] Adapter Socket.io in memoria: una sola istanza API (serve l'adapter Redis per scalare).

### Sicurezza e privacy (decisioni da prendere)

- [ ] Chiunque può scrivere in chat a chiunque: nessun requisito di follow, blocco o rate limit.
- [ ] Follow senza approvazione: chi ti segue vede l'ascolto live se Ghost Mode è spenta; la heavy
      rotation è pubblica anche con Ghost Mode attiva.
- [x] ~~Proxy di immagini aperto~~: `next/image` accetta solo gli host di `apps/web/image-hosts.mjs`.
- [ ] Salvataggio recensione e ricalcolo punteggi non sono in un'unica transazione.

### Repository

- [ ] File `LICENSE` (MIT) assente.
- [ ] Alcuni file preesistenti (mobile, 3 file API) non sono formattati con Prettier.

### Minori

- [ ] Una release inesistente mostra la pagina "non trovato" ma risponde 200 anche nella build di
      produzione (lo streaming del `loading` parte prima del 404).
- [ ] Titoli troncati in "Dischi del momento" a 1280 px.

## 4. Mobile (`apps/mobile`): stato e prossimi passi

**Stato:** Expo SDK 58 (React Native 0.88, React 19.3), Expo Router, client API tipizzato con
Bearer in `expo-secure-store`, socket autenticato con `auth: { token }`, font e tema del design
system. Home, Esplora, Reels (anteprime da 30 s con `expo-audio`), release (recensioni,
reazioni, punteggi), chat, notifiche, profili e impostazioni usano l'API reale; nessun dato mock.
Verificato con typecheck, Jest (58 test, anche sull'albero di route reale con API finta) ed
`expo export`; **mai provato su dispositivo, simulatore o Expo Go**, né contro un'API live.
Richiede Node >= 22.13. Dettagli in `apps/mobile/README.md`.

Mancano / da decidere:

- [ ] Collegamento Spotify/Last.fm dall'app (lo `state` OAuth vive in un cookie).
- [ ] Rimozione di un brano da una playlist (il "Salva" dei Reels non si può annullare).
- [ ] Paginazione dei Reels (`/api/discovery/reels` restituisce sempre `nextCursor: null`) e
      segnale "Non fa per me" lato server.
- [ ] Anteprima audio in chat (oggi "Apri" apre il link universale).
- [ ] Componenti vecchi in `src/components/` non più usati (`LiveFriendsBar`, `MusicChatBubble`,
      `UserProfileView`, `DiscoveryReelsFeed`, `GenreRouletteWheel`, `ReleaseHeaderCard`,
      `DualScoreCard`, `ReviewComposer`, `CriticReviewCard`, `MusicVideoPlayerCard`): da eliminare.
- [ ] Il typecheck carica sia i tipi di React 18 (web, root) sia di React 19 (mobile).
- [ ] Solo dopo: modulo Android (ongoing notification, `NotificationListenerService`) e widget iOS /
      Live Activity (ADR-004).

## 5. Questioni aperte

1. **Next.js:** `14.2.15` → l'ultima patch `14.2.35` ha le stesse dipendenze e peer
   (React 18.2); va aggiornata insieme a `eslint-config-next` in una PR dedicata (cambia il
   lockfile).
2. ~~Ordine del resolver anteprime (ADR-003)~~: risolto emendando l'ADR (Deezer → iTunes, Spotify
   escluso; vedi ADR-010). Resta da verificare dal vivo la durata degli URL Deezer firmati.
3. **Media bayesiana:** attivarla ora (con `m` e `C` dell'ADR-001) o quando il catalogo ha abbastanza
   recensioni?
4. **Chi può scrivere in chat e vedere l'ascolto live:** solo mutual? follow con approvazione?
5. **Hosting (ADR-005):** confermare Vercel (web) + Railway/Fly (API con WebSocket) +
   Neon/Supabase e Upstash; richiede web e API sullo stesso dominio registrabile per il cookie
   (`COOKIE_DOMAIN`, vedi `06` §1).
6. **Licenza:** aggiungere `LICENSE` MIT con il titolare corretto.
