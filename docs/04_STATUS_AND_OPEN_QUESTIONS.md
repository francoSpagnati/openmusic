# 04 · Stato del progetto e questioni aperte

> **Ultimo aggiornamento:** 2026-10-24, branch `ccr-8d035389-g64pel` (round: restyle "Carta e
> argilla", ADR-015, su web e mobile, più la review avversariale del restyle, §3 "Restyle").
> Round precedente: Fastify 5, fallback del catalogo, lettura automatica di Spotify/Last.fm
> (ADR-013) e relativa review del poller.
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
| `npm test` (dopo `db:test:prepare`)                   | shared 58/58, api 202/202 (catalogo su fixture), mobile 73/73 |
| Build web (`next build`, Next 16.4.2)                 | passa                                                         |
| `npm run e2e` (Playwright, 20 test)                   | passa (profilo locale)                                        |
| `E2E_PROFILE=cross-site npm run e2e`                  | passa, 20/20 (build di produzione, `next start`, due siti)    |
| `npx tsx scripts/check-contrast.ts`                   | tutte le coppie di token AA in chiaro e scuro                 |
| `expo export` iOS + Android (`EXPO_OFFLINE=1`)        | non rieseguito in questo round                                |
| CI GitHub (`ci.yml`, job `verify` + `mobile` + `e2e`) | questo round non ancora eseguito                              |

### 1.1 Verificato dal vivo o solo con fixture?

Nei round precedenti l'ambiente bloccava la rete verso i servizi musicali (il proxy rispondeva
403 a `CONNECT`). In questo round l'import curato è stato eseguito **dal vivo** contro
Deezer/iTunes/MusicBrainz: **45 album su 46** importati (da qui il fallback su query semplice
di Deezer e il throttling dei 403 di iTunes). Spotify e Last.fm invece non sono mai stati
chiamati dal vivo: mancano credenziali e account reali. Quindi:

| Area                                                       | Come è verificato                                                      | Live?                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| Parsing delle risposte Deezer/iTunes/MusicBrainz/CAA       | test su fixture JSON scritte sulla forma **documentata** delle API     | **no**                               |
| Import, deduplica, import concorrenti, `resolve`           | test di integrazione su Postgres reale + fixture                       | in parte: import curato 45/46 live   |
| Cache, rate limiter, retry/`Retry-After`, circuit breaker  | test unitari con orologio e `fetch` finti                              | **no**                               |
| `CATALOG_EXTERNAL_ENABLED=false` = zero chiamate in uscita | test che conta le chiamate                                             | n/a                                  |
| Colore dominante                                           | test su immagini PNG/JPEG locali (`test/fixtures/images`)              | **no** (mai su cover reali dei CDN)  |
| Copertine e anteprime reali in web e mobile                | nessuno                                                                | **no**                               |
| `npm run catalog:smoke`                                    | eseguito: **6/6 falliti** per rete bloccata (nessun mock nello script) | **da rifare con rete**               |
| Durata dei token delle anteprime Deezer (`hdnea=exp=…`)    | nessuno                                                                | **no**                               |
| App mobile                                                 | typecheck, Jest (66), `expo export` iOS/Android                        | **no** (mai su device/simulatore/Go) |
| OAuth Spotify/Last.fm, Google Fonts nella build via turbo  | nessuno                                                                | **no**                               |
| Poller Spotify/Last.fm (ADR-013)                           | test di integrazione con `fetch` e orologio finti, Redis e DB reali    | **no** (mai avviato con credenziali) |

Le fixture sono plausibili ma non registrate da risposte reali: se un servizio restituisce un
campo con forma diversa dalla documentazione, lo schema Zod del provider scarta la risposta e la
ricerca ricade sui risultati locali. Il primo passo con la rete è `npm run catalog:smoke`, poi
`npm run catalog:import -- --file curated-albums.json --dry-run --limit 5`.

## 2. Cosa è reale

### Piattaforma e API

- Monorepo Turborepo, Docker Compose (Postgres 16 + Redis 7), `.env.example` unico. API su
  **Fastify 5** (plugin `@fastify/*` alle major compatibili; CORS con i metodi di scrittura
  elencati esplicitamente, perché `@fastify/cors` 10+ ammette solo GET/HEAD/POST di default).
- Default locali su `127.0.0.1` (CORS, `WEB_APP_URL`, redirect OAuth): Spotify rifiuta i redirect
  `localhost` e web e API devono condividere l'host per il cookie. In produzione vanno comunque
  impostati `CORS_ORIGIN`, `WEB_APP_URL` e i redirect; `COOKIE_SECURE` resta `true` di default.
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
- Lettura automatica di Spotify e Last.fm (ADR-013): poller in background con intervallo
  adattivo, lease Redis per più istanze, pausa globale sui 429, stato per account
  (`GET /api/now-playing/sync-status`) mostrato in Impostazioni su web e mobile. **Testato solo
  con fixture.**

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
| `/settings`                     | Profilo, password, Ghost Mode, collegamento Spotify/Last.fm, stato della sincronizzazione automatica  |
| `/critics`                      | Richiesta di accredito, coda ADMIN                                                                    |
| `/videos`                       | Feed video, pubblicazione per ruoli abilitati                                                         |

L'unico dato statico rimasto è l'elenco di generi di riserva in `GenrePicker`, usato solo se il
catalogo non risponde. Le immagini di avatar e copertine del seed puntano a Unsplash.

### Test e strumenti

- ESLint + Prettier configurati; CI (Node 22 da `.nvmrc`) con job `verify` (lint, typecheck,
  test con `CATALOG_EXTERNAL_ENABLED=false`, build), `mobile` (typecheck, Jest, export iOS/Android
  offline) ed `e2e`.
- Vitest: 58 test in `packages/shared`, 186 in `apps/api` (integrazione su Postgres/Redis reali,
  catalogo e poller su fixture). Jest: 67 test in `apps/mobile`.
- Playwright (13 test): registrazione, login, feed, apertura release, recensione, messaggio in
  chat, ricerca che raggruppa le edizioni, pagina album, 404 reali di release e album, stato della
  sincronizzazione in Impostazioni.

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

- [ ] **Review avversariale del poller e di Fastify 5 (2026-10-23).** Corretto, con test:
  - [x] ~~Due refresh del token Spotify in parallelo~~ (poller + "Sincronizza ora" o un'altra
        rotta Spotify): se Spotify ruota il refresh token, il secondo riceveva `invalid_grant` e
        l'account finiva in `ERROR / TOKEN_REVOKED` senza motivo. Ora un lock Redis per account
        fa partire un solo refresh, gli altri aspettano il token salvato; un `invalid_grant` su un
        refresh token già sostituito non è una revoca; un 401 su un token già sostituito non
        provoca un altro refresh;
  - [x] ~~Un errore temporaneo poteva riportare in `ACTIVE` un account appena messo in `ERROR`
        (revoca dalla sync manuale) o `PAUSED` (sweep)~~: `markError` è un compare-and-set sullo
        stato letto all'inizio della lettura;
  - [x] ~~Lease scaduto durante una lettura lenta~~: un'altra istanza poteva leggere lo stesso
        utente e la prima pubblicava poi un brano vecchio sopra quello nuovo. Il lease si rinnova
        (compare-and-`PEXPIRE`) prima di scrivere; se è perso il risultato viene scartato;
  - [x] ~~Nessun test falliva se la precedenza Spotify > Last.fm si rompeva~~: `choosePlayback`
        esportata e testata su tutte le combinazioni, più un test di integrazione con Spotify in
        pausa;
  - [x] ~~Con Redis giù all'avvio il poller non partiva più~~: parte all'evento `ready`; durante
        un'interruzione il ciclo logga un avviso al minuto invece di uno al secondo;
  - [x] ~~Coda degli scrobble piena = ascolto verificato perso in silenzio~~: la claim viene
        restituita e la lettura successiva riprova;
  - [x] ~~La mappa del throttle cresceva con ogni utente pubblicato~~: potatura delle voci
        scadute oltre 10 000 utenti;
  - [x] ~~`linkRecordings` faceva scattare l'indice unique di `Track.musicbrainzId`~~ (e
        `Release.musicbrainzId`) a ogni import di un'edizione sorella: la stessa registrazione
        MusicBrainz è su più edizioni (ADR-012). L'errore era gestito, ma Prisma lo stampava
        (`prisma:error … Unique constraint failed`). Ora i proprietari sono cercati prima;
  - [x] ~~I test del catalogo dipendevano dalla shell~~ (`CATALOG_EXTERNAL_ENABLED=false`
        esportata li faceva fallire): l'helper dei test forza il valore voluto;
  - [x] ~~e2e "search folds editions" ambiguo su un DB con dati importati dal vivo~~
        (`getByText('Columbia')`): ora controlla il campo "Etichetta" dell'intestazione.
  - Verificato e **senza problemi**: `GET /api/now-playing/sync-status` richiede la sessione e
    legge solo l'utente autenticato; `lastError` è un messaggio fisso per codice (nessun testo dei
    provider, nessun token); i token non finiscono nei log; Ghost Mode è ricontrollata da
    `updateUserNowPlaying` anche per un aggiornamento differito; chiavi Redis del poller con TTL
    o rimosse (`np:poll:state` 24 h, lease e backoff in `PX`); spegnimento ordinato.
  - **Ancora aperti:**
    - il poller **non è mai stato eseguito con credenziali reali** Spotify/Last.fm: forma delle
      risposte, `Retry-After` reale e rotazione dei refresh token restano da verificare dal vivo
      (Development Mode: massimo 5 utenti in allowlist);
    - per scelta (ADR-013) i follower vedono l'ascolto anche quando l'utente non ha l'app aperta
      (`isOnline: true`); con il follow senza approvazione è una questione di privacy da
      decidere (§5.4);
    - un 403 di Spotify ferma l'account (`ACCESS_DENIED`) senza distinguere allowlist e scope
      mancanti; i rate limiter e i circuit breaker sono per processo;
    - `writeDroppingConflicts` (import) usa ancora l'errore unique per scartare gli id in
      conflitto: nei test con import concorrenti Prisma stampa ancora `Unique constraint failed`
      (atteso, ma rumoroso nei log);
    - l'import live ha lasciato 1 album curato su 46 non importato.

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

### Restyle "Carta e argilla" (ADR-015, `docs/05_DESIGN_SYSTEM.md`)

Fatto: token chiaro/scuro condivisi (`packages/shared/src/theme.ts`) con controllo di contrasto
(`scripts/check-contrast.ts`), font aperti (Newsreader, Instrument Sans, Spline Sans Mono),
primitive UI e tutte le pagine web e le schermate mobile ristilizzate, scelta del tema
Chiaro/Scuro/Sistema (web: `localStorage` + script prima del paint; mobile: `expo-secure-store`).
Nessun nome, logo o font di Anthropic/Claude nel codice o negli asset: l'ispirazione è citata
solo nei documenti, con i limiti.

Verificato in questo round (review avversariale):

- axe-core (WCAG 2.1 A/AA + best practice) su 14 pagine web, chiaro e scuro, 1280 e 390 px:
  **nessuna violazione di contrasto**; restano solo segnalazioni già presenti prima del restyle
  (vedi sotto). Coppie con trasparenza (badge, righe selezionate) calcolate a mano: tutte >= 4.5:1
  tranne testo `fg-subtle` su `accent` all'8% in chiaro (4.46:1), combinazione oggi non usata.
- Tema: nessun flash e nessun avviso di idratazione con scelta salvata, `localStorage`
  bloccato non rompe la pagina (nuovo `e2e/theme.spec.ts`). Corretto un `<meta name="color-scheme">`
  duplicato da React nella build di produzione.
- SSR: release e album con `<title>`, Open Graph e JSON-LD (release) invariati; id inesistenti
  rispondono ancora 404 vero. `render.yaml`, proxy `/api/*` e avvio `next start` non toccati dal
  restyle; e2e cross-site verde.
- Mobile: il tema salvato viene letto prima del primo frame (lo splash resta su fino ad allora,
  massimo 1,5 s), errori o eccezioni di SecureStore non bloccano l'app (test Jest), la roulette
  dei generi non gira più con "riduci movimento".
- Rifiniture: placeholder della ricerca in Esplora non più tagliato a 390 px, sezioni delle
  Impostazioni che vanno a capo invece di scorrere di lato, frecce dei Reels su desktop leggibili.

**Non verificato:** mai visto su dispositivi reali (iOS/Android, Safari), mai provato con screen
reader (VoiceOver, TalkBack, NVDA), zoom 200% e modalità ad alto contrasto solo nel CSS, non
provati; l'app mobile non è mai stata avviata dopo il restyle (solo typecheck e Jest).

Da fare:

- [ ] Prova con screen reader e su dispositivi reali (web mobile e app), anche con testo grande.
- [ ] `theme-color` (colore della barra del browser) segue il sistema, non la scelta manuale.
- [ ] Segnalazioni axe preesistenti: nome accessibile del logo e delle reazioni alle recensioni
      diverso dal testo visibile (WCAG 2.5.3), `role="status"`/`"alert"` su `<ol>` nei toast,
      nessun `<h1>` nei Reels, salto di livello dei titoli in profilo e video.
- [ ] Mobile: componenti di `src/components/` non più usati (vedi §4) da rimuovere, non ristilizzati.

### Minori

- [x] ~~Una release inesistente rispondeva 200~~: il controllo è in `releases/[id]/layout.tsx`
      (prima del boundary `loading`), lo stesso per `/albums/[groupId]`; coperto da e2e.
- [ ] Titoli troncati in "Dischi del momento" a 1280 px.

## 4. Mobile (`apps/mobile`): stato e prossimi passi

**Stato:** Expo SDK 58 (React Native 0.88, React 19.3), Expo Router, client API tipizzato con
Bearer in `expo-secure-store`, socket autenticato con `auth: { token }`, font e tema del design
system. Home, Esplora, Reels (anteprime da 30 s con `expo-audio`), release (recensioni,
reazioni, punteggi, edizioni), album (edizioni e voto complessivo), chat, notifiche, profili e impostazioni usano l'API reale; nessun dato mock.
Verificato con typecheck, Jest (73 test, anche sull'albero di route reale con API finta) ed
`expo export` (non rieseguito dopo il restyle); **mai provato su dispositivo, simulatore o Expo Go**, né contro un'API live.
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
5. ~~**Hosting (ADR-005)**~~: primo hosting su Render free con un Blueprint (`render.yaml`,
   ADR-014, `07_DEPLOY.md`). Il vincolo del dominio comune è caduto: il web fa da proxy per
   `/api/*`. Mai provato davvero su Render; da rivalutare se il piano free non basta (sleep,
   Postgres che scade dopo 30 giorni).
6. **Licenza:** aggiungere `LICENSE` MIT con il titolare corretto.
