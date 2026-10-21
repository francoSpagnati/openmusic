# Architecture Decision Records (ADR) e roadmap

> Le decisioni qui sotto sono **vincolanti**. Per cambiarne una si aggiunge un emendamento datato
> (o un nuovo ADR che la sostituisce) nella stessa PR che cambia il codice. Ogni ADR riporta lo
> **stato di implementazione** reale; il quadro completo è in
> [`04_STATUS_AND_OPEN_QUESTIONS.md`](./04_STATUS_AND_OPEN_QUESTIONS.md).

## Indice

| ADR | Titolo                                              | Stato decisione                    | Implementazione      |
| --- | --------------------------------------------------- | ---------------------------------- | -------------------- |
| 001 | Voto ibrido (stelle, media bayesiana, % gradimento) | Accettata                          | Parziale             |
| 002 | Moderazione "safe space" e Ascolto Verificato       | Accettata                          | Sì                   |
| 003 | Anteprime audio 30 s universali                     | Accettata, in discussione l'ordine | Parziale             |
| 004 | Rilevamento musicale universale e notifica OS       | Accettata                          | Solo cloud (Spotify) |
| 005 | Infrastruttura open source e hosting a costo zero   | Accettata                          | Solo locale          |
| 006 | Account locali e modello di sessione                | Accettata                          | Sì                   |
| 007 | Gestione centralizzata degli errori API             | Accettata                          | Sì                   |
| 008 | Tipografia e token di design                        | Accettata                          | Web sì, mobile no    |
| 009 | Tipi di reazione alle recensioni                    | Accettata                          | Sì                   |
| 010 | Catalogo da database musicali aperti                | Accettata                          | Sì (testato offline) |

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
- **Stato:** `AudioPreviewResolverService` interroga **Deezer → iTunes**; Spotify non è usato. La
  discrepanza è una **questione aperta** (`04` §5): va deciso se emendare l'ADR o il codice.

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

### ADR-010: Catalogo da database musicali aperti

- **Data:** 2026-10.
- **Contesto:** il catalogo conteneva solo il seed con cover di Unsplash; la ricerca importava da
  Deezer con id `deezer-…` come chiave primaria, rifiutati da tutte le rotte che validano UUID.
- **Decisione:** Deezer è la fonte primaria (cover 1000 px, tracklist con ISRC, UPC, anteprime,
  nessuna chiave), iTunes Search il fallback, MusicBrainz la fonte canonica di arricchimento (MBID,
  generi votati, etichetta) e Cover Art Archive la cover di riserva. Tutto passa da un client
  upstream comune (cache Redis, rate limit per provider, retry, circuit breaker). Le entità hanno
  **sempre UUID interni**; gli id esterni sono colonne uniche opzionali e la deduplica usa id →
  UPC/ISRC → titolo + artista normalizzati. Nessuna dipendenza nuova: `fetch` globale e un
  decoder PNG/JPEG-DC minimale per il colore dominante. Dettagli: `06` §8.
- **Alternative scartate:** Spotify Web API (richiede app registrata e token, termini più
  restrittivi sull'uso dei metadati); Discogs (token obbligatorio, 60 req/min); una libreria di
  immagini (`sharp`) per il colore dominante, che aggiunge binari nativi.
- **Conseguenze:** MusicBrainz a 1 req/s impone l'arricchimento in background o via script; senza
  rete la ricerca restituisce solo risultati locali.

---

## Roadmap

Legenda: **[x]** reale (API + web, su DB, testato) · **[~]** parziale · **[ ]** da fare.

### Milestone 0: Fondamenta (completata)

- [x] Monorepo Turborepo, Docker Compose, `.env.example`, Prisma con migrazioni e seed.
- [x] Account locali, sessioni JWT con revoca, ruoli, error handler centrale (ADR-006, ADR-007).
- [x] ESLint, Prettier, Vitest (unit + integrazione), Playwright, CI GitHub Actions.
- [ ] Prima esecuzione verde della CI su GitHub.

### Milestone 1: Social e "Now Playing" — web

- [x] Follow, feed post, like, salvati, notifiche persistenti e live.
- [x] Presenza live via Socket.io autenticato, solo ai follower; Ghost Mode.
- [x] Collegamento Spotify e Last.fm.
- [~] Ritorno all'app dopo l'OAuth (oggi termina sul JSON dell'API).
- [ ] Socket revocato a logout / cambio password; adapter Redis per più istanze.

### Milestone 2: Catalogo, recensioni e profilo — web

- [x] Ricerca e import on-the-fly (Deezer/iTunes), browse per genere, scheda release SSR.
- [x] Recensioni con Ascolto Verificato (1.5×), reazioni, bozza locale, punteggi pubblico/critica.
- [x] Profilo con statistiche e heavy rotation.
- [~] Media bayesiana (ADR-001) non applicata.
- [ ] Recensione di brani importati da Deezer (id non UUID); eliminazione recensione.

### Milestone 3: Discovery — web

- [x] Reels con anteprime pre-caricate; Roulette dei generi.
- [~] Ordine del resolver anteprime da allineare (ADR-003).
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

### Milestone 6: Mobile (prossima)

- [ ] Client API e login con token in secure store.
- [ ] Socket con `auth: { token }`.
- [ ] Sostituzione dei dati mock, navigazione, font del design system.
- [ ] Moduli nativi (ADR-004).

### Milestone 7: Beta pubblica

- [ ] File `LICENSE`, hosting (ADR-005), reset password, moderazione e limiti anti-abuso.
