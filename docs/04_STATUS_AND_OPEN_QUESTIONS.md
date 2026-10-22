# 04 · Stato del progetto e questioni aperte

> **Ultimo aggiornamento:** 2026-10-22, branch `ccr-8d035389-g64pel` (modifiche non ancora
> committate: Next.js 16, edizioni ADR-012, UI delle edizioni, correzioni della review).
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
| `npm test` (dopo `db:test:prepare`)                   | shared 54/54, api 149/149 (catalogo su fixture), mobile 66/66 |
| Build web (`next build`, Next 16.4.2)                 | passa                                                         |
| `npm run e2e` (Playwright, 12 test, DB + seed)        | passa in locale                                               |
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
| App mobile                                                 | typecheck, Jest (66), `expo export` iOS/Android                        | **no** (mai su device/simulatore/Go) |
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

| Pagina                          | Cosa fa                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/auth`                         | Registrazione e login, redirect sicuro a `?next=`                                                     |
| `/`                             | Feed (seguiti/globale), composizione post, amici in ascolto, suggerimenti                             |
| `/explore`                      | Ricerca (edizioni dello stesso album in una card, "N edizioni"), filtri, griglia, Roulette dei generi |
| `/releases/[id]`                | Scheda SSR con SEO, edizione e "Altre edizioni", tracklist, anteprime, dual score, recensioni, bozza  |
| `/albums/[groupId]`             | Album come opera (ADR-012): voto complessivo di tutte le edizioni ed elenco edizioni con i loro voti  |
| `/reels`                        | Feed verticale con anteprime pre-caricate                                                             |
| `/chat`                         | Inbox, conversazione, invio brano, reazioni, "ascoltato", aggiornamenti live                          |
| `/notifications`                | Elenco, segna come lette, arrivo live                                                                 |
| `/profile`, `/profile/[handle]` | Profilo, statistiche, heavy rotation, follow                                                          |
| `/settings`                     | Profilo, password, Ghost Mode, collegamento Spotify/Last.fm                                           |
| `/critics`                      | Richiesta di accredito, coda ADMIN                                                                    |
| `/videos`                       | Feed video, pubblicazione per ruoli abilitati                                                         |

L'unico dato statico rimasto è l'elenco di generi di riserva in `GenrePicker`, usato solo se il
catalogo non risponde. Le immagini di avatar e copertine del seed puntano a Unsplash.

### Test e strumenti

- ESLint + Prettier configurati; CI (Node 22 da `.nvmrc`) con job `verify` (lint, typecheck,
  test con `CATALOG_EXTERNAL_ENABLED=false`, build), `mobile` (typecheck, Jest, export iOS/Android
  offline) ed `e2e`.
- Vitest: 54 test in `packages/shared`, 149 in `apps/api` (integrazione su Postgres/Redis reali,
  catalogo su fixture). Jest: 66 test in `apps/mobile`.
- Playwright (12 test): registrazione, login, feed, apertura release, recensione, messaggio in
  chat, ricerca che raggruppa le edizioni, pagina album, 404 reali di release e album.

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
- [x] ~~Album omonimi dello stesso artista (i vari "Weezer") uniti sulla stessa riga~~: modello
      a edizioni + release group (ADR-012), regole di unione per edizione, autocorrezione degli id
      agganciati per errore e `npm run catalog:audit` per le righe già fuse. Su fixture.
- [ ] Edizioni (ADR-012): duplicati possibili della stessa edizione quando i provider non
      concordano su anno o titolo (si preferisce il duplicato alla fusione sbagliata).
- [ ] **Review avversariale delle edizioni e di Next 16 (2026-10-22).** Corretto, con test:
  - [x] ~~Un risultato di ricerca senza data restava per sempre nel gruppo sbagliato~~ (il
        "Weezer" del 2001 tra le edizioni di quello del 1994, con le sue recensioni nel voto
        complessivo): ora viene spostato quando l'import completo ne rivela l'anno;
  - [x] ~~Ri-registrazioni, live e "(with …)" nello stesso gruppo dell'originale~~ ("Fearless
        (Taylor's Version)", "X (Live)", "X (with the London Symphony Orchestra)"; quest'ultimo
        era trattato perfino come la stessa edizione): ora sono opere distinte, come in
        MusicBrainz;
  - [x] ~~Chiavi dei gruppi creati dalla migrazione~~ non confrontabili con quelle usate per
        agganciare le nuove edizioni (NULL sulle righe legacy, diverse per "Album - Deluxe
        Version"): la prossima edizione apriva un gruppo doppione. Riparazione con
        `npm run catalog:audit -- --repair-group-keys`, **da eseguire una volta** su ogni DB già
        migrato (sul DB di sviluppo locale, dopo il seed, segnala 0 chiavi da ricalcolare);
  - [x] ~~Ogni visita alla pagina album dopo una sincronizzazione MusicBrainz fallita accodava
        un'altra richiesta a MusicBrainz~~ (endpoint anonimo e senza rate limit): ora al massimo
        un tentativo ogni 10 minuti per gruppo e per processo.
  - Verificato e **senza problemi**: `params`/`searchParams` sempre attesi con `await`, nessun
    `cookies()`/`headers()` lato server, le pagine SSR chiamano l'API senza cookie (nessun dato
    per utente in cache condivisa), `fetch` non in cache in Next 16, `images.remotePatterns`
    invariato (nessun proxy aperto), `proxy.ts` equivalente al vecchio `middleware.ts`, 404 reali
    da `layout.tsx`; migrazione solo additiva (FK `ON DELETE SET NULL`, nessuna colonna tolta,
    test del backfill su uno schema temporaneo).
  - **Non corretto (scelta precedente, documentata in ADR-012):** la ricerca esterna nasconde
    nella stessa pagina due risultati dello stesso provider con titolo e numero di tracce uguali
    e senza data. Serve per i doppioni dei negozi (Deezer ha due "In Rainbows"), ma nasconde
    anche album omonimi con lo stesso numero di tracce. Da rivedere con dati reali.
  - **Rischio accettato:** un risultato senza data può ancora agganciarsi per errore alla riga
    di un altro album non ancora importata per intero (caso "seed Weezer"); l'import completo lo
    stacca (ADR-012 §4), ma fino ad allora la riga mostra dati misti.
- [x] ~~UI delle edizioni~~: chip dell'edizione, formato/paese/etichetta, "Altre edizioni" e
      pagina album (`/albums/[groupId]` sul web, `album/[id]` su mobile) con voto complessivo
      separato da quello della singola edizione; la ricerca raggruppa le edizioni; il compositore
      dice quale edizione si sta recensendo. Il seed offline ha Random Access Memories in due
      edizioni (2013 e 10th Anniversary Edition 2023) per e2e e sviluppo.
- [ ] **Catalogo, dalla review dell'import** (non ancora corretti):
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

- [x] ~~Una release inesistente rispondeva 200~~: il controllo è in `releases/[id]/layout.tsx`
      (prima del boundary `loading`), lo stesso per `/albums/[groupId]`; coperto da e2e.
- [ ] Titoli troncati in "Dischi del momento" a 1280 px.

## 4. Mobile (`apps/mobile`): stato e prossimi passi

**Stato:** Expo SDK 58 (React Native 0.88, React 19.3), Expo Router, client API tipizzato con
Bearer in `expo-secure-store`, socket autenticato con `auth: { token }`, font e tema del design
system. Home, Esplora, Reels (anteprime da 30 s con `expo-audio`), release (recensioni,
reazioni, punteggi, edizioni), album (edizioni e voto complessivo), chat, notifiche, profili e impostazioni usano l'API reale; nessun dato mock.
Verificato con typecheck, Jest (66 test, anche sull'albero di route reale con API finta) ed
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
- [x] Web e mobile usano la stessa React 19.3.0 (una sola copia in root, insieme a React Native
      0.88): il typecheck non carica più due versioni dei tipi di React.
- [ ] Web: le regole React Compiler di `eslint-plugin-react-hooks` 7 (`refs`,
      `set-state-in-effect`, `immutability`) sono spente in `apps/web/eslint.config.mjs` (~65 punti
      usano di proposito il pattern "ultimo valore in un ref"); riattivarle insieme al React
      Compiler.
- [ ] Mobile: `tooling/mobile-first.js` (e il paragrafo in `apps/mobile/README.md`) descrive ancora
      React 18 in root; ora non ci sono copie mobile da preferire e il resolver è un no-op.
- [ ] Solo dopo: modulo Android (ongoing notification, `NotificationListenerService`) e widget iOS /
      Live Activity (ADR-004).

## 5. Questioni aperte

1. ~~**Next.js 14**~~: aggiornato a Next.js 16.4 + React 19.3 (Next 14 è fuori supporto e
   `npm audit` segnalava advisory critiche, RCE nell'image optimizer inclusa). `params` /
   `searchParams` sono Promise, `middleware.ts` è diventato `proxy.ts`, `next lint` è sostituito
   dalla CLI di ESLint 9 (flat config), `npm run typecheck` del web esegue prima `next typegen`.
2. ~~Ordine del resolver anteprime (ADR-003)~~: risolto emendando l'ADR (Deezer → iTunes, Spotify
   escluso; vedi ADR-010). Resta da verificare dal vivo la durata degli URL Deezer firmati.
3. **Media bayesiana:** attivarla ora (con `m` e `C` dell'ADR-001) o quando il catalogo ha abbastanza
   recensioni?
4. **Chi può scrivere in chat e vedere l'ascolto live:** solo mutual? follow con approvazione?
5. **Hosting (ADR-005):** confermare Vercel (web) + Railway/Fly (API con WebSocket) +
   Neon/Supabase e Upstash; richiede web e API sullo stesso dominio registrabile per il cookie
   (`COOKIE_DOMAIN`, vedi `06` §1).
6. **Licenza:** aggiungere `LICENSE` MIT con il titolare corretto.
