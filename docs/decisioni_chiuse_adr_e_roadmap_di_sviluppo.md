# Architecture Decision Records (ADR) e roadmap

> Le decisioni qui sotto sono **vincolanti**. Per cambiarne una si aggiunge un emendamento datato
> (o un nuovo ADR che la sostituisce) nella stessa PR che cambia il codice. Ogni ADR riporta lo
> **stato di implementazione** reale; il quadro completo è in
> [`04_STATUS_AND_OPEN_QUESTIONS.md`](./04_STATUS_AND_OPEN_QUESTIONS.md).

## Indice

| ADR | Titolo                                              | Stato decisione                | Implementazione      |
| --- | --------------------------------------------------- | ------------------------------ | -------------------- |
| 001 | Voto ibrido (stelle, media bayesiana, % gradimento) | Accettata                      | Parziale             |
| 002 | Moderazione "safe space" e Ascolto Verificato       | Accettata                      | Sì                   |
| 003 | Anteprime audio 30 s universali                     | Accettata, emendata da ADR-010 | Sì (Deezer → iTunes) |
| 004 | Rilevamento musicale universale e notifica OS       | Accettata                      | Solo cloud (Spotify) |
| 005 | Infrastruttura open source e hosting a costo zero   | Accettata                      | Solo locale          |
| 006 | Account locali e modello di sessione                | Accettata                      | Sì                   |
| 007 | Gestione centralizzata degli errori API             | Accettata                      | Sì                   |
| 008 | Tipografia e token di design                        | Accettata                      | Sì (web e mobile)    |
| 009 | Tipi di reazione alle recensioni                    | Accettata                      | Sì                   |
| 010 | Catalogo da database musicali esterni               | Accettata                      | Sì, solo su fixture  |
| 011 | App mobile: Expo SDK 58 ed expo-router              | Accettata                      | Mai su device        |
| 012 | Edizioni e release group (modello MusicBrainz)      | Accettata                      | Sì, solo su fixture  |

---

### ADR-001: Sistema di voto ibrido (stelle + media bayesiana + % gradimento)

- **Problema:** unire la precisione di RateYourMusic all'immediatezza di Rotten Tomatoes senza
  rendere scomodo il voto da smartphone.
- **Decisione:**
  1. Input a 5 stelle con mezze stelle (0.5…5.0), salvato come intero 10…100.
  2. Output duale: **media bayesiana** su 5.00 (es. `4.18 / 5`) e **percentuale di gradimento**
     (quota di voti >= 3.5 stelle, cioè >= 70).
  3. Critica: i campi del Critic Score esistono già e restano nascosti finché non ci sono critici
     accreditati.
- **Stato:** input, % gradimento e punteggio critica implementati. La media è **pesata ma non
  ancora bayesiana** (formula in [`03`](./03_ARCHITECTURE_AND_STACK.md) §5.1). I campi reali si
  chiamano `audienceAvg` / `audienceFreshPct`.

### ADR-002: Moderazione "safe space" e badge "Ascolto Verificato"

- **Problema:** evitare flame, review bombing e guerre tra fandom.
- **Decisione:**
  1. Niente thread di commenti pubblici sotto le recensioni: solo reazioni curate (ADR-009).
  2. Per discutere una recensione si apre una chat diretta.
  3. Una recensione con ascolto registrato in `ScrobbleLog` ottiene il badge _Ascolto Verificato_
     e pesa **1.5** contro **1.0** nella media e nella % di gradimento.
- **Stato:** implementato (`apps/api/src/modules/reviews/score.ts`, `release-scores.ts`). Regola di
  verifica: >= 3 brani distinti dell'album (tutti, se ne ha meno), oppure 1 scrobble del brano.
  Il pulsante "Discuti recensione" in chat non esiste ancora.

### ADR-003: Risoluzione universale delle anteprime audio da 30 s

- **Problema:** Spotify limita i `preview_url` per le nuove app; Reels e Roulette non devono restare
  muti.
- **Decisione originale:** `PreviewResolverService` via ISRC, in ordine iTunes → Deezer → Spotify,
  con salvataggio dell'URL nella tabella `Track`.
- **Emendamento (2026-10, ADR-010):** l'ordine è **Deezer → iTunes**. Deezer è già la fonte
  primaria del catalogo, quindi ISRC e anteprima arrivano spesso con l'import; iTunes copre i buchi.
  Spotify è escluso dalle anteprime (i `preview_url` non sono garantiti per le nuove app). L'URL
  viene salvato in `Track.previewUrl`, ma quelli Deezer sono firmati e scadono: il client richiama
  `/api/catalog/preview` se la riproduzione fallisce.
- **Stato:** implementato in `AudioPreviewResolverService`.

### ADR-004: Rilevamento musicale universale e notifica OS

- **Decisione:**
  1. Sorgenti: OAuth cloud per Spotify, Last.fm e Apple Music, più modulo nativo Android
     (`NotificationListenerService` / `MediaSession`) per qualsiasi player.
  2. Spazio notifiche: ongoing notification silenziosa su Android; Lock Screen widget + Live
     Activity su iOS.
- **Stato:** Spotify (currently playing, sync, scrobble) e collegamento Last.fm implementati; Apple
  Music e i moduli nativi no. L'endpoint `GET /api/notifications/presence-summary` esiste, i widget
  di sistema no.

### ADR-005: Infrastruttura open source e hosting a costo zero

- **Decisione:** in locale `docker-compose.yml` con PostgreSQL 16 e Redis 7; in beta web su
  Vercel, API + WebSocket su Railway/Fly.io, database su Neon/Supabase, Redis su Upstash, mobile
  su Expo EAS.
- **Stato:** solo l'ambiente locale e la CI esistono. Vincolo emerso dall'ADR-006: web e API devono
  condividere il dominio registrabile per il cookie di sessione.

### ADR-006: Account locali email + password e modello di sessione

- **Data:** 2026-10.
- **Contesto:** il login esisteva solo via OAuth Spotify/Last.fm e il web usava un token finto
  (`jwt_mock`). Il gateway socket si fidava di un `userId` inviato dal client.
- **Decisione:**
  1. L'accesso principale è un **account locale email + password**. Hash con `scrypt` di
     `node:crypto` (N=2^15, r=8, p=1, salt 16 byte), nessuna dipendenza nativa; policy 10–128
     caratteri senza regole di composizione (NIST 800-63B).
  2. Sessione = **JWT HS256** con `sub` (id utente) e `sv` (`User.sessionVersion`). Il cambio
     password incrementa `sessionVersion` e revoca le altre sessioni. Il ruolo non sta nel token:
     si rilegge dal DB a ogni richiesta.
  3. Browser: solo cookie `om_session` httpOnly, `SameSite=Lax`, `Secure` in produzione. App native
     e script: `Authorization: Bearer`.
  4. Socket.io: identità solo dal token dell'handshake; presenza solo ai follower; CORS ristretto.
  5. Spotify e Last.fm sono **account collegati** facoltativi, con cookie di stato OAuth; mai
     collegamento automatico per email, mai spostamento di un collegamento da un altro utente (409).
  6. `JWT_SECRET` obbligatorio in produzione (>= 32 caratteri), nessun valore di default nel codice.
- **Conseguenze:** niente tabella sessioni (revoca per utente, non per dispositivo); un socket già
  aperto resta valido fino alla disconnessione; reset password via email ancora da progettare.
- **Riferimenti:** [`06_API_AND_AUTH.md`](./06_API_AND_AUTH.md) §1, `apps/api/src/lib/auth.ts`,
  `apps/api/src/lib/password.ts`.

### ADR-007: Gestione centralizzata degli errori API

- **Data:** 2026-10.
- **Contesto:** ogni rotta aveva un `try/catch` che mappava qualsiasi errore a 401/403 e restituiva
  i dettagli interni (`err.message`).
- **Decisione:**
  1. Le rotte **non** catturano errori. Lanciano sottoclassi di `AppError`
     (`apps/api/src/lib/errors.ts`) o lasciano propagare `ZodError` ed errori Prisma.
  2. Un solo handler (`registerErrorHandling`) produce `ApiErrorBody`
     (`packages/shared/src/errors.ts`): `{ statusCode, code, message, fieldErrors? }` con codici
     stabili (`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
     `RATE_LIMITED`, `UPSTREAM_ERROR`, `INTERNAL_ERROR`...).
  3. Messaggi in italiano per l'utente; stack, query e risposte dei provider solo nei log.
  4. Chiamate esterne con timeout (5 s) e conversione in `502 UPSTREAM_ERROR`.
  5. Il client web valida le risposte e lancia `ApiError` con gli stessi campi.
- **Conseguenze:** i codici di errore sono un contratto: cambiarli richiede di aggiornare
  `packages/shared`, il client web e `06` §2.

### ADR-008: Tipografia e token di design

- **Data:** 2026-10.
- **Contesto:** i documenti proponevano alternative incompatibili (Fraunces _o_ Cabinet Grotesk,
  Plus Jakarta _o_ Satoshi _o_ Inter/Geist) e due palette diverse; il web caricava altri font
  ancora.
- **Decisione:**
  1. **Fraunces** (variabile, editoriale) per titoli, album, citazioni; **Plus Jakarta Sans** per
     UI e testo; **JetBrains Mono** con `tabular-nums` per ogni numero.
  2. Fonte unica dei token: `THEME` in `packages/shared/src/theme.ts`, specchiato in
     `apps/web/src/app/globals.css` (variabili `--om-*`) e `tailwind.config.ts`. Tutti i ruoli di
     testo >= 4.5:1 (WCAG 2.2 AA).
  3. Il documento di riferimento è [`05_DESIGN_SYSTEM.md`](./05_DESIGN_SYSTEM.md); i valori di colore
     e font presenti in documenti più vecchi sono superati.
- **Stato:** web allineato (font via `next/font/google`). Mobile: `THEME` condiviso, ma i font non
  sono ancora caricati con `expo-font`.

### ADR-009: Tipi di reazione alle recensioni

- **Data:** 2026-10.
- **Contesto:** l'ADR-002 originale citava `INSIGHTFUL / CONVINCED / VIBE`, mentre lo schema e i
  dati usavano già un altro insieme.
- **Decisione:** le reazioni alle recensioni sono **`AGREE`** ("Condivido"), **`WELL_WRITTEN`**
  ("Scritta bene"), **`DISCOVERED`** ("Scoperto grazie a te"), **`HEART`**. Fonte di verità: enum
  Prisma `ReactionType` e `ReactionTypeSchema` in `packages/shared`. Ogni utente può dare ciascuna
  reazione una volta per recensione (toggle). Le reazioni in chat sono un insieme separato:
  `FIRE`, `HEART`, `NOT_FOR_ME`.
- **Motivo:** evitare una migrazione dei dati esistenti senza un guadagno di prodotto chiaro.

### ADR-010: Catalogo da database musicali esterni

- **Data:** 2026-10.
- **Contesto:** il catalogo conteneva solo il seed con cover di Unsplash; la ricerca importava da
  Deezer con id `deezer-…` come chiave primaria, rifiutati da tutte le rotte che validano UUID.
  Serviva un catalogo reale (copertine, tracklist, ISRC, anteprime) utilizzabile da un progetto
  open source senza costi, senza app registrate e senza segreti nel repository.
- **Decisione:**
  1. **Deezer** è la fonte **primaria**: ricerca di album/brani/artisti, dettaglio album con
     tracklist e ISRC, UPC, etichetta, generi, cover fino a 1000 px, anteprime MP3 da 30 s.
     Nessuna chiave API.
  2. **MusicBrainz** è la fonte canonica di **arricchimento** (MBID di release, release group e
     recording, etichetta, generi votati), interrogata per UPC, ISRC o titolo + artista, in
     background o da script, a 1 req/s con `User-Agent` identificativo. **Cover Art Archive** dà
     la copertina di riserva per MBID.
  3. **iTunes Search API** è il **fallback**: ricerca quando Deezer fallisce o non trova nulla,
     anteprime AAC quando Deezer non ne ha, artwork portato a 1000×1000.
  4. **Spotify è facoltativo** e resta fuori dal catalogo: serve solo a chi collega il proprio
     account (currently playing, scrobble, top artisti, export playlist). Senza credenziali Spotify
     catalogo, ricerca e anteprime funzionano uguale.
  5. Tutte le chiamate passano da un client comune per provider (`UpstreamClient`: cache Redis,
     rate limit a token bucket con coda limitata, timeout 5 s, retry con `Retry-After`, circuit
     breaker) e possono essere spente con `CATALOG_EXTERNAL_ENABLED=false`.
  6. Le entità hanno **sempre UUID interni**; gli id esterni (`deezerId`, `itunesId`,
     `musicbrainzId`, `upc`, `isrc`) sono colonne uniche opzionali. Deduplica: id → UPC/ISRC →
     titolo + artista normalizzati. Le cover restano sui CDN dei provider.
  7. Nessuna dipendenza nuova: `fetch` globale e un decoder PNG/JPEG-DC minimale per il colore
     dominante. I test usano fixture registrate e un `fetch` iniettato; `npm run catalog:smoke`
     verifica i servizi dal vivo.
- **Dettagli:** `03` §8 e `06` §8.
- **Alternative scartate:**
  - **Spotify Web API come fonte primaria:** richiede un'app registrata e token client
    credentials, i `preview_url` non sono più garantiti alle nuove app e i termini limitano il
    salvataggio dei metadati. Rimane solo per l'account collegato.
  - **Solo MusicBrainz:** dati aperti (CC0) e canonici, ma 1 req/s per IP, niente anteprime audio
    e copertine non sempre presenti: inadatto alla ricerca interattiva.
  - **Discogs:** token obbligatorio, 60 req/min, orientato alle edizioni fisiche.
  - **Last.fm:** chiave obbligatoria, metadati di album e tracklist meno affidabili.
  - **`sharp` o simili per il colore dominante:** binari nativi per un calcolo minimo.
- **Conseguenze:**
  - MusicBrainz a 1 req/s impone l'arricchimento in background; i limiti sono per processo.
  - Senza rete la ricerca restituisce solo risultati locali (il resto dell'app funziona).
  - Dipendiamo dai termini d'uso di Deezer e Apple (salvataggio dei metadati, attribuzione e link
    allo store per le anteprime iTunes): da verificare prima della produzione (`04` §3).
  - **Stato di verifica:** implementato e testato solo con fixture costruite sulla forma
    documentata delle API; nessuna chiamata live riuscita finora (`04` §1.1).

### ADR-011: App mobile su Expo SDK 58 con expo-router

- **Data:** 2026-10.
- **Contesto:** `apps/mobile` era un prototipo su Expo SDK 51 con dati mock e navigazione a stato
  locale. Expo Go dagli store esegue solo l'SDK più recente, quindi l'app non si apriva più per chi
  voleva provarla senza una build nativa. Il client doveva usare l'API reale con Bearer (ADR-006).
- **Decisione:**
  1. **Expo SDK 58** (React Native 0.88, React 19.3, New Architecture), managed workflow, versioni
     allineate a `expo/bundledNativeModules.json`. Si prova con **Expo Go**; build native (EAS)
     solo quando servono moduli propri (ADR-004).
  2. **expo-router** con route a file in `app/`: gruppi `(auth)` e `(tabs)` (tab JS di
     `expo-router/js-tabs`), `Stack.Protected` come guardia di autenticazione, deep link e URL
     tipizzati gratis, stessa struttura mentale delle route di Next.js nel web.
  3. JWT in **expo-secure-store** (logout se la lettura fallisce), `EXPO_PUBLIC_API_URL` come base
     URL (inserita da Metro a build time, mai segreti), client tipizzato che valida le risposte con
     gli schemi di `@openmusic/shared` come il web.
  4. `expo-image` per le cover, `expo-audio` per le anteprime, font del design system
     (`@expo-google-fonts/*`) inclusi nel bundle.
  5. Nel monorepo il web restava su React 18: React 19 viveva in `apps/mobile/node_modules` e un
     resolver (`tooling/mobile-first.js`) lo imponeva a Metro e Jest. Dall'aggiornamento del web a
     Next.js 16 entrambe le app usano React 19.3.0, installata una sola volta in root.
- **Alternative scartate:**
  - **Restare su SDK 51:** niente Expo Go dagli store, dipendenze ferme.
  - **React Navigation configurata a mano:** stessa libreria sotto expo-router, ma più codice di
    configurazione e niente route a file né deep link automatici.
  - **Bare React Native / prebuild subito:** costringe ogni contributore a toolchain Xcode/Android
    prima di vedere una schermata.
- **Conseguenze:**
  - Node **>= 22.13** in tutto il monorepo (`.nvmrc`, `engines`, CI).
  - Due versioni di React nel lockfile; il typecheck carica entrambi i tipi (`04` §4).
  - I moduli nativi di ADR-004 richiederanno un development build al posto di Expo Go.
  - **Stato di verifica:** typecheck, Jest ed `expo export` iOS/Android passano; l'app non è mai
    stata eseguita su dispositivo, simulatore o Expo Go.

### ADR-012: Edizioni e release group (modello MusicBrainz)

- **Data:** 2026-10.
- **Contesto:** il dedupe di ADR-010 univa le release per titolo + artista normalizzati togliendo
  i qualificatori di edizione: un remaster finiva nella riga dell'originale e due album omonimi
  dello stesso artista (i "Weezer" del 1994, 2001, 2008…) potevano fondersi in una riga con due
  tracklist. Il proprietario del prodotto ha deciso: si uniscono **solo le stesse edizioni**;
  ristampe e remaster sono album distinti; l'identità si basa su un database musicale reale,
  affidabile e aggiornato.
- **Decisione:**
  1. **Modello MusicBrainz come fonte di verità dell'identità.** `ReleaseGroup` = l'album come
     opera (MBID del release group, titolo senza marcatori, artista principale, anno della prima
     edizione, tipo `ALBUM | EP | SINGLE | LIVE | COMPILATION | OTHER`, dove Live e Compilation
     sono promossi dai tipi secondari di MusicBrainz). `Release` = **una edizione** (MBID di
     release, UPC/EAN, data, paese, formato, stato, disambiguation, `editionLabel`, numero di
     tracce). Deezer e iTunes restano fonti di media (cover, anteprime, ISRC) agganciate
     all'edizione a cui corrispondono davvero (Deezer ha id e UPC distinti per edizione).
  2. **Stessa riga solo per la stessa edizione:** stesso id di provider; oppure stesso UPC
     normalizzato; oppure stesso MBID di release; oppure, senza UPC/MBID/id dello stesso provider
     in conflitto, stesso titolo **con** i marcatori di edizione + stesso artista principale +
     stesso anno + stesso numero di tracce (`compareEditions` in `@openmusic/shared`). Con dati
     incompleti (risultato di ricerca senza data, riga del seed) si unisce solo a un candidato
     unico e mai a una riga già importata per intero da un altro provider. Marcatori: remaster,
     deluxe, super, expanded, anniversary, edition, version, mono, stereo, reissue, bonus
     (con anni e ordinali). **Emendamento (review avversariale, 2026-10-22):** live, unplugged,
     acoustic, instrumental, remix, sped up/slowed, demo, re-recorded, "Taylor's Version" e
     "(with …)" non sono marcatori di edizione ma **altre registrazioni**: restano nel titolo
     dell'opera e quindi in un release group a parte, come in MusicBrainz (prima "Fearless
     (Taylor's Version)" e "X (Live)" finivano nel gruppo dell'originale e nel suo voto
     complessivo). **Explicit e clean della stessa edizione possono unirsi:** stessa
     musica e stesso prodotto discografico per chi recensisce; restano separate se hanno UPC o id
     dello stesso provider diversi.
  3. **Edizioni diverse, stesso gruppo:** per MBID del release group quando noto; altrimenti
     titolo senza marcatori + artista, con controllo dell'anno (un'edizione senza marcatori con
     un anno diverso è un altro album) e, se ambiguo, un gruppo nuovo che MusicBrainz potrà
     correggere. **Emendamento (2026-10-22):** un'edizione senza data agganciata all'unico gruppo
     con quel titolo viene spostata quando l'import completo ne rivela un anno incompatibile con
     le edizioni non marcate del gruppo (prima restava per sempre nel gruppo sbagliato: il
     "Weezer" del 2001 tra le edizioni di quello del 1994).
  4. **Autocorrezione:** se l'import completo di un id di provider contraddice la riga a cui era
     agganciato (UPC diverso, anni distanti più di 1, tracce diverse, marcatori diversi), l'id
     viene staccato e l'edizione importata nella sua riga, portando con sé le sue tracce.
  5. **MusicBrainz canonico:** l'arricchimento risolve la release per barcode → ISRC → ricerca,
     accettando ISRC e ricerca solo se è la stessa edizione; salva paese, formato, stato e
     disambiguation; sposta l'edizione nel release group di MusicBrainz. Le edizioni sorelle si
     leggono in modo pigro (browse del release group all'apertura della pagina del gruppo, al
     massimo ogni 30 giorni, max 25 edizioni distinte; dopo un errore si riprova al massimo ogni
     10 minuti per gruppo). Rate limit, `User-Agent` e cache di ADR-010 invariati.
  6. **Voti:** le recensioni restano **per edizione**. Il gruppo espone voti aggregati calcolati
     sulle recensioni di tutte le edizioni con i pesi di ADR-001/002 e **un voto per utente** (la
     recensione più recente nel gruppo). Scostamento motivato dalla proposta iniziale "media delle
     medie pesata per numero di recensioni": è equivalente quando ogni utente recensisce una sola
     edizione, ma non conta due volte chi recensisce originale e remaster e conserva il peso
     dell'ascolto verificato.
  7. **Migrazione** `20261022090000_release_groups_editions`: un gruppo per ogni release esistente,
     unendo le release che condividono già un MBID di release group; titolo del gruppo ripulito
     dai marcatori in SQL. `npm run catalog:audit` segnala le righe probabilmente fuse per errore
     dal vecchio dedupe; `--split` le azzera a una sola edizione solo se nessun contenuto utente
     vi punta. **Emendamento (2026-10-22):** la migrazione copia in `ReleaseGroup.matchKey` la
     vecchia chiave della release, che non coincide sempre con `releaseGroupMatchKey()` (ed è
     NULL sulle righe legacy): `npm run catalog:audit -- --repair-group-keys` va eseguito una
     volta dopo la migrazione. La migrazione non è stata modificata perché è già applicata al DB
     di sviluppo; il suo `work_title` SQL toglie ancora "live" dal titolo mostrato del gruppo
     (solo testo, la chiave riparata è quella giusta).
- **Dettagli:** `06` §8 (regole, payload, endpoint), `03` §8.
- **Alternative scartate:**
  - **Una sola riga per opera (release group) con le edizioni come metadati:** le recensioni di
    un remaster o di una deluxe con tracce in più finirebbero sull'originale, contro la decisione
    del proprietario.
  - **Discogs come fonte di identità:** modello master/release equivalente, ma token obbligatorio,
    60 req/min e licenza dei dati meno aperta di MusicBrainz (CC0).
  - **Unire anche per titolo base + artista quando anno e tracce coincidono:** è il bug dei
    remaster con lo stesso numero di tracce.
- **Conseguenze:**
  - La ricerca esterna continua a nascondere, nella stessa pagina di risultati, due risultati
    dello stesso provider con stesso titolo, numero di tracce e nessuna data (scelta di ADR-010
    per i doppioni dei negozi, coperta da test). Effetto collaterale noto e non corretto: due
    album omonimi con lo stesso numero di tracce (alcuni "Peter Gabriel") mostrano solo il primo
    nella ricerca esterna.
  - Possibili **duplicati** della stessa edizione quando i provider non concordano (data
    digitale di un anno diversa, titolo con o senza "Remastered"): si preferisce un duplicato
    visibile tra le edizioni del gruppo a una fusione sbagliata. MusicBrainz (UPC/MBID) li
    riconcilia quando li conosce.
  - La ricerca restituisce edizioni: i client mostrano `editionLabel` e l'anno e linkano la
    pagina del gruppo.
  - **Stato di verifica:** come ADR-010, solo fixture costruite sulla forma documentata delle
    API (browse MusicBrainz incluso); nessuna chiamata live.

---

## Roadmap

Legenda: **[x]** reale (API + web, su DB, testato) · **[~]** parziale · **[ ]** da fare.

### Milestone 0: Fondamenta (completata)

- [x] Monorepo Turborepo, Docker Compose, `.env.example`, Prisma con migrazioni e seed.
- [x] Account locali, sessioni JWT con revoca, ruoli, error handler centrale (ADR-006, ADR-007).
- [x] ESLint, Prettier, Vitest (unit + integrazione), Playwright, CI GitHub Actions.
- [x] Prima esecuzione verde della CI su GitHub (round 1; il round catalogo/mobile non ancora).

### Milestone 1: Social e "Now Playing" — web

- [x] Follow, feed post, like, salvati, notifiche persistenti e live.
- [x] Presenza live via Socket.io autenticato, solo ai follower; Ghost Mode.
- [x] Collegamento Spotify e Last.fm.
- [x] Ritorno all'app dopo l'OAuth (redirect a `/settings?oauth=…`).
- [x] Socket revocato a logout / cambio password / scadenza.
- [ ] Adapter Redis per più istanze.

### Milestone 2: Catalogo, recensioni e profilo — web

- [x] Ricerca e import on-the-fly (Deezer/iTunes), browse per genere, scheda release SSR.
- [~] Catalogo esterno con UUID interni, arricchimento MusicBrainz/CAA, `resolve`, import curato
  (ADR-010): fatto, ma verificato solo su fixture; manca `catalog:smoke` con rete.
- [x] Recensioni con Ascolto Verificato (1.5×), reazioni, bozza locale, punteggi pubblico/critica.
- [x] Profilo con statistiche e heavy rotation.
- [~] Media bayesiana (ADR-001) non applicata.
- [x] Recensione di brani importati (ora con UUID interni).
- [ ] Eliminazione recensione.

### Milestone 3: Discovery — web

- [x] Reels con anteprime pre-caricate; Roulette dei generi.
- [x] Ordine del resolver anteprime: Deezer → iTunes (ADR-003 emendato).
- [ ] Undo nei Reels/Roulette, like/salvataggio reel, paginazione Reels.

### Milestone 4: Chat, playlist e notifica OS

- [x] Chat 1-a-1 con brani, link universali, reazioni, "ascoltato", inbox.
- [~] Aggiornamento live solo per il destinatario; badge non lette non sincronizzato.
- [~] Playlist: API pronte, nessuna UI web.
- [ ] Regole su chi può scrivere a chi (blocco, rate limit).
- [ ] Ongoing notification Android / widget iOS (ADR-004).

### Milestone 5: Critica e video

- [x] Accredito critici con approvazione ADMIN, recensioni della critica, dual score.
- [x] Video: pubblicazione per ruoli abilitati, feed, video per release.

### Milestone 6: Mobile (in corso, ADR-011)

- [x] Expo SDK 58, expo-router, client API e login con token in secure store.
- [x] Socket con `auth: { token }`.
- [x] Schermate su API reale (home, esplora, Reels, release, chat, notifiche, profili,
      impostazioni), font del design system.
- [ ] Prima esecuzione su dispositivo / Expo Go.
- [ ] Collegamento Spotify/Last.fm, rimozione dalla playlist, paginazione Reels.
- [ ] Moduli nativi (ADR-004).

### Milestone 7: Beta pubblica

- [ ] File `LICENSE`, hosting (ADR-005), reset password, moderazione e limiti anti-abuso.
