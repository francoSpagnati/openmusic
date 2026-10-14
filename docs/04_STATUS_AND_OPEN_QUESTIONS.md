# 🚦 Stato del Progetto, Roadmap e Questioni Aperte (TBD)

> **Ultimo aggiornamento:** Milestone 5 Completata (Critic Score, Accredito Testate Giornalistiche & Spazio Video-Contenuti).

## 1. Stato Attuale del Progetto
- [x] Creazione repository GitHub (`francoSpagnati/openmusic`) con licenza MIT.
- [x] Definizione Visione, Personas, Euristiche di Nielsen e Architettura Monorepo.
- [x] Definizione Schema Database iniziale (`Prisma` con supporto per User, Release, Track, Review, Audience/Critic Score, ConnectedAccount).
- [x] Inizializzazione Monorepo (Turborepo, Docker Compose per Postgres + Redis, configurazione .env e packaging).
- [x] Setup `apps/api` (Backend Fastify Node.js/TypeScript con Socket.io e Redis).
- [x] Setup `apps/mobile` (Expo React Native con Reanimated v3, Phosphor Icons, Haptics).
- [x] Setup `apps/web` (Next.js App Router con Server-Side Rendering e SEO).

---

## 2. Roadmap di Sviluppo (Milestones)

### 🏁 Milestone 1: Core Infrastructure & "Now Playing" (MVP Parte 1)
- [x] Setup completo del Monorepo e del database PostgreSQL + Redis in Docker (`docker-compose.yml`, `.env.example`, `.env`).
- [x] Autenticazione utenti e collegamento OAuth con **Spotify** e **Last.fm** (`AuthService`, `SpotifyService`, `LastFmService`, contratti in `@openmusic/shared/src/auth.ts`).
- [x] Implementazione del motore WebSockets per la **`<LiveFriendsBar />`** (`NowPlayingService` in Redis con TTL 300s, `NowPlayingGateway` Socket.io, hook `useNowPlayingSocket`, `LiveFriendsBar` con Phosphor Icons e Haptics, test su `apps/mobile/App.tsx`).

### 🏁 Milestone 2: Catalogo, Recensioni & Profilo (MVP Parte 2)
- [x] Ricerca brani/album e indicizzazione on-the-fly (`CatalogService`, `AudioPreviewResolverService` a cascata Deezer $\rightarrow$ iTunes tramite ISRC, rotte `/api/catalog/search`, `/api/catalog/releases/:id`, `/api/catalog/preview`).
- [x] Sistema di recensioni e calcolo del **Voto del Pubblico** (`ReviewsService`, scala 10..100 nel DB, ricalcolo `audienceAvg` 0.5-5.0 e % `audienceFreshPct` $\ge 70\%$, badge `isVerifiedListen` tramite `ScrobbleLog`, reazioni costruttive `AGREE`, `WELL_WRITTEN`, `DISCOVERED`, `HEART`).
- [x] Componenti Mobile (`<ReleaseHeaderCard />` con Audience Score Rotten Tomatoes e Dynamic Tint, `<ReviewComposer />` con step 0.5 stelle, vibe tags e auto-save, `<UserProfileView />` con Rotazione Pesante e Diario Recensioni).
- [x] Pagina Profilo Utente (`ProfileService`, rotte `/api/profile/me` e `/api/profile/:userId`).

### 🏁 Milestone 3: Discovery (Music Reels & Roulette)
- [x] Sviluppo del feed verticale `<DiscoveryReelsFeed />` con pre-buffer delle clip audio da 30 secondi (Soglia di Doherty < 400ms), pulsante Undo swipe (Euristica #3) e Thumb Zone (Legge di Fitts).
- [x] Algoritmo della **Roulette Russa dei generi** (`DiscoveryService.spinGenreRoulette`, selezione generi fuori dallo storico dell'utente con starter pack di 3 brani con preview, componente `<GenreRouletteWheel />` con vinile rotante animato in Reanimated v3).

### 🏁 Milestone 4: Chat Musicale, Playlist & Notifica OS
- [x] Chat diretta per consigli musicali con traduzione universale dei link tramite ISRC (`ChatService`, rotte `/api/chat/*`, componente `<MusicChatBubble />` con audio preview e reazioni rapide).
- [x] Creazione e condivisione di playlist tematiche con concetto analogico a doppio lato **Lato A / Lato B** (`PlaylistsService`, rotte `/api/playlists/*`, componente `<ThemedPlaylistView />` con switcher Reanimated e contatore durata).
- [x] Implementazione della notifica persistente di sistema / Live Activity (`NotificationPresenceService`, rotta `/api/notifications/presence-summary`, componente `<NotificationPresenceWidget />`).

### 🏁 Milestone 5: Voto della Critica & Spazio Video (Espansione Futura)
- [x] Portale di verifica per giornalisti/webzine musicali e attivazione del **Critic Score** (`CriticService`, rotte `/api/critic/*`, calcolo dual-score e recensioni ufficiali con testata).
- [x] Sezione multimediale per la condivisione di video-contenuti a tema musicale (`VideosService`, rotte `/api/videos/*`, modello `MusicVideoContent`).
- [x] Componenti Mobile: `<DualScoreCard />` (Tomatometer stile Pitchfork/Rotten Tomatoes con badge Fresh/Rotten per Critica e Pubblico), `<CriticReviewCard />` (scheda editoriale con testata e link articolo esterno) e `<MusicVideoPlayerCard />` (video-saggi con durata e tag).

---

## 3. Open Questions / Cose da Definire (TBD)

1. **Scala esatta del Voto del Pubblico nella UI:**
   - Nel database salviamo un intero `10-100` per massima flessibilità matematica (ADR-001).
   - Nell'interfaccia utente: input da **0.5 a 5.0 stelle** (passo 0.5) con badge "Fresh" ($\ge 70\%$) verde o "Rotten" rosso stile Rotten Tomatoes.
2. **Design e Limiti della Notifica Persistente su Mobile (ADR-002):**
   - Su **Android**, una *Ongoing Notification* visibile nella tendina notifiche che riassume chi sta ascoltando musica ora.
   - Su **iOS**, Widget Schermata di Blocco + *Live Activity* durante le sessioni di ascolto.
3. **Sorgente Primaria delle Anteprime Audio da 30s (ADR-003):**
   - *Preview Resolver* a cascata implementato: Deezer API $\rightarrow$ iTunes Search API tramite ISRC o metadati brano.
4. **Regole della Moderazione per "Vivere Sereni" (ADR-004):**
   - Solo reazioni costruttive `ReactionType` (`AGREE`, `WELL_WRITTEN`, `DISCOVERED`, `HEART`) e badge `isVerifiedListen`.
5. **Strategia di Hosting Iniziale (ADR-005):**
   - Docker in locale; poi Vercel (Web), Railway/Render (API/DB/Redis) ed EAS (Mobile).

---

## 4. Next Session Handoff
- **Cosa è stato completato nella sessione attuale (Sviluppo Web Next.js & GitHub):**
  - Setup completo di `apps/web`: Next.js 14 App Router, TypeScript, Tailwind CSS, Phosphor Icons, Google Fonts (`Fraunces`, `Plus Jakarta Sans`, `JetBrains Mono`).
  - Architettura audio globale `AudioPlayerContext` e `<AudioPlayerBar />` dock fisso con riproduzione 30s preview.
  - Pagina iniziale `/`: Hero editoriale, `<LiveFriendsTicker />` con indicatori real-time e Ghost Mode, classifica release con `<DualScoreBadge />`, e `<GenreRouletteInteractive />` con vinile rotante animato.
  - Scheda release `/releases/[id]`: Server-Side Rendering (SSR) e generazione dinamica dei metadati OpenGraph/SEO, tracklist a doppio lato (Lato A / Lato B in `ReleaseTracklistClient`), recensioni accreditate affiancate a recensioni del pubblico con reazioni costruttive.
  - Portale accredito critica `/critics`: Modulo di candidatura per giornalisti/webzine, spiegazione del Critic Score e showcase testate accreditate.
  - Spazio video-contenuti `/videos`: Feed video saggi, analisi armoniche e documentari musicali collegati agli album.
  - Verifica typecheck ed esecuzione build:
    - `npm run typecheck` (`turbo run typecheck`): 5/5 package passati con 0 errori.
    - `next build`: build di produzione completato con successo (generazione statica e dinamica delle rotte).
  - Sincronizzazione GitHub: commit semantico e push sul repository remoto `francoSpagnati/openmusic`.
- **Prossimi Passi Consigliati:**
  - Setup pipeline CI/CD GitHub Actions per lint e typecheck automatico su PR.
  - Integrazione provider OAuth di produzione e deployment cloud su Vercel (Web), Render/Railway (API + DB + Redis) ed Expo EAS (Mobile).