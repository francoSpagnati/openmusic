# 🏛️ Architecture Decision Records (ADR) & Roadmap di Sviluppo

> **Stato:** Tutte le Open Questions iniziali sono state risolte e formalizzate negli ADR qui sotto. Il progetto è pronto per l'implementazione del codice (Milestone 1).

---

## 1. Registro delle Decisioni Architetturali (ADR)

### ADR-001: Sistema di Voto Ibrido (Stelle + Media Bayesiana + % Gradimento)
- **Problema:** Come bilanciare la precisione dei siti come *RateYourMusic* con l'immediatezza visiva di *Rotten Tomatoes* senza rendere frustrante l'inserimento del voto su smartphone.
- **Decisione:**
  1. **Input Utente:** Selettore a **5 stelle con mezze stelle** ($0.5 \dots 5.0$), memorizzato a database come intero $10 \dots 100$.
  2. **Output Pubblico Duale:** Sulla scheda di ogni album/brano mostriamo sia la **Media Bayesiana** su $5.00$ (es. `4.18 / 5`) sia la **Percentuale di Gradimento** (es. `89% Consigliato`, calcolata sui voti $\ge 3.5$ stelle).
  3. **Fase Critica:** Il database include già i campi `criticBayesian` e `criticAcclaim`, che rimarranno nascosti nella UI finché non verranno accreditati i primi recensori con ruolo `CRITIC`.

### ADR-002: Moderazione "Safe Space" e Badge "Ascolto Verificato"
- **Problema:** Come mantenere il social un luogo sereno dove tutti possano esprimere i propri gusti senza subire flame, review-bombing o guerre tra fandom.
- **Decisione:**
  1. **Niente commenti pubblici caotici:** Sotto le recensioni non ci sono thread pubblici aperti a sconosciuti, ma **4 Reazioni Curate costruttive** (`AGREE`, `WELL_WRITTEN`, `DISCOVERED`, `HEART`).
     - *Aggiornamento 2026-10:* il codice (enum Prisma `ReactionType`, `ReactionTypeSchema`) è la fonte di verità; i nomi originari `INSIGHTFUL / CONVINCED / VIBE` sono stati abbandonati per non migrare dati esistenti.
  2. **Discussioni tra Amici:** Se vuoi discutere una recensione con un amico, il tasto *"Discuti recensione"* apre una conversazione diretta allegando la card della recensione.
  3. **Badge "Ascolto Verificato":** Se l'utente ha ascoltato il brano/album (verificato tramite `ScrobbleLog`), la recensione riceve il badge *Ascolto Verificato* e pesa $1.5\times$ nella media rispetto ai voti inseriti senza ascolto registrato, neutralizzando il review-bombing.
     - *Implementazione:* `apps/api/src/modules/reviews/score.ts` (peso 1.5 verificato / 1.0 non verificato su media e % Fresh). Verifica: ≥ 3 brani distinti dell'album nello storico scrobble (tutti, se l'album ne ha meno), oppure 1 scrobble per la recensione di un brano. La media bayesiana (ADR-001) non è ancora applicata: oggi è una media pesata semplice.

### ADR-003: Risoluzione Universale delle Anteprime Audio da 30s
- **Problema:** Le API di Spotify limitano spesso i `preview_url` per le nuove app, rischiando di lasciare muti i *Music Reels* e la *Roulette*.
- **Decisione:** Creazione del modulo backend `PreviewResolverService` basato sul codice universale **ISRC** che interroga in ordine **Apple iTunes Search API** (AAC $256\text{ kbps}$ gratuito), **Deezer API** (MP3 $128\text{ kbps}$ gratuito) e **Spotify API**, salvando l'URL della clip da $30\text{ s}$ direttamente nella tabella `Track`.
- *Stato implementazione:* `AudioPreviewResolverService` interroga oggi **Deezer → iTunes** (Spotify non è usato perché le preview sono limitate per le nuove app). Allineare l'ordine all'ADR è un'attività aperta.

### ADR-004: Rilevamento Musicale Universale e Notifica OS
- **Problema:** Supportare utenti su diverse app di musica e offrire il riepilogo rapido degli amici nello spazio notifiche del telefono.
- **Decisione:**
  1. **Sorgenti di ascolto:** Integrazione Cloud OAuth per **Spotify**, **Last.fm** e **Apple Music**, più modulo nativo Android (`NotificationListenerService` / `MediaSession`) per rilevare qualsiasi player locale o app di streaming (es. YouTube Music, Tidal).
  2. **Spazio Notifiche Mobile:** Su Android usiamo una *Ongoing Notification* silenziosa ed espandibile; su iOS usiamo un *Lock Screen Widget* abbinato alle *Live Activities*.

### ADR-005: Infrastruttura Open Source e Hosting a Costo Zero per il Lancio
- **Problema:** Mantenere il progetto facilmente eseguibile in locale da chiunque cloni la repo GitHub e ospitabile gratuitamente per la prima beta.
- **Decisione:**
  - **Locale:** `docker-compose.yml` con PostgreSQL 16 e Redis 7.
  - **Cloud Beta:** Frontend Web su *Vercel*, Backend Node.js + WebSockets su *Railway* / *Fly.io*, Database su *Supabase/Neon* + *Upstash Redis*, build mobile su *Expo EAS*.

---

## 2. Roadmap Operativa e Checklist di Sviluppo

### 🏁 Milestone 1: Fondamenta Monorepo, DB & Motore "Now Playing" (IN CORSO)
- [x] Creazione repo GitHub `francoSpagnati/openmusic` (MIT License).
- [x] Documentazione architetturale completa (`AI_CONTEXT.md` + `docs/01..04`).
- [ ] **Step 1.1:** Setup file di configurazione root (`package.json`, `turbo.json`, `tsconfig.base.json`, `.gitignore`) e `packages/db` con Prisma + `packages/shared`.
- [ ] **Step 1.2:** Creazione `apps/api` (Fastify + Socket.io + Redis Presence Service) con endpoint per aggiornare e ricevere lo stato *Now Playing* degli amici in tempo reale.
- [ ] **Step 1.3:** Inizializzazione `apps/mobile` (Expo) e `apps/web` (Next.js) con il tema *Warm Editorial Vinyl* e il primo componente funzionante: `<LiveFriendsBar />`.

### 🏁 Milestone 2: Catalogo Musicale, Recensioni & "Heavy Rotation"
- [ ] Integrazione ricerca universale (Spotify + MusicBrainz + iTunes/Deezer per ISRC e preview 30s).
- [ ] Pagina Album/Brano (`<ReleaseHeaderCard />`) con estrazione colore dominante, Media Bayesiana e Percentuale di Gradimento.
- [ ] Compositore Recensioni (`<ReviewComposer />`) con auto-save bozze, verifica automatica dell'*Ascolto Verificato* e *Vibe Tags*.
- [ ] Profilo Utente con sezione *"Cosa mi sta piacendo ultimamente"* (calcolata su `ScrobbleLog`).

### 🏁 Milestone 3: Discovery Out-of-the-Bubble (Music Reels & Roulette)
- [ ] Sviluppo di `<DiscoveryReelsFeed />` con pre-buffering audio a bassa latenza e tasto *Undo*.
- [ ] Sviluppo della **Roulette Russa dei Generi** (`<GenreRouletteWheel />`) con filtro dei generi mai ascoltati dall'utente.

### 🏁 Milestone 4: Chat Musicale, Playlist & Widget/Notifiche OS
- [ ] Chat diretta con `<MusicChatBubble />`, stato *"Ascoltato"* e traduzione universale del link verso l'app preferita del destinatario.
- [ ] Creazione ed esportazione di Playlist Tematiche.
- [ ] Modulo nativo per la notifica persistente Android e il Widget iOS.

### 🏁 Milestone 5: Voto della Critica & Spazio Video (Espansione)
- [ ] Dashboard di verifica per critici/webzine e attivazione pubblica del *Critic Score*.
- [ ] Feed secondario opzionale per video-contenuti e approfondimenti musicali.