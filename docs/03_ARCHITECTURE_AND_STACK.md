# 🏗️ Architettura Tecnica, Componenti e Integrazioni

## 1. Stack Tecnologico Scelto
Per massimizzare la produttività, la velocità dell'app mobile e la manutenibilità open-source, l'intero ecosistema è basato su **TypeScript**:

| Livello | Tecnologia | Motivazione |
| :--- | :--- | :--- |
| **Monorepo** | **Turborepo** + npm/pnpm workspaces | Condivisione istantanea di codice, tipi e componenti tra Web, Mobile e Backend. |
| **App Mobile** | **React Native (Expo)** + Reanimated + Skia | Performance native a 60/120fps, supporto per notifiche custom/Live Activities e sviluppo rapido in React. |
| **Sito Web** | **Next.js (App Router)** + Tailwind CSS | Ottimizzazione SEO per far indicizzare recensioni, album e profili su Google. |
| **Backend API** | **Node.js (Fastify o NestJS)** + Socket.io | Alte prestazioni, bassa latenza per i WebSockets e architettura modulare pulita. |
| **Database & Cache** | **PostgreSQL (Prisma ORM)** + **Redis** | PostgreSQL per l'integrità di recensioni/social; Redis per lo stato volatile "Chi sta ascoltando cosa". |

---

## 2. Architettura del Sistema "Now Playing" (Come rileviamo la musica)
Per offrire un'esperienza al livello di Discord e supportare più account e app di ascolto possibili, adottiamo un **approccio ibrido a due livelli**:

1. **Livello 1: Integrazione API Cloud (Multi-piattaforma Web + iOS + Android)**
   - **Spotify Web API:** Collegamento OAuth2 (`/v1/me/player/currently-playing` e `/v1/me/player/recently-played`).
   - **Last.fm API:** Ottimo ponte universale (molti utenti collegano già decine di player a Last.fm; leggendo `user.getRecentTracks` supportiamo indirettamente decine di app).
   - **Apple Music (MusicKit):** Integrazione tramite token utente Apple Music.
2. **Livello 2: Rilevamento Media Session di Sistema Operativo (Mobile Native)**
   - **Su Android:** Modulo nativo tramite `NotificationListenerService` / `MediaSessionManager` che legge i metadati (Titolo, Artista, Album, Stato Play/Pause) di *qualsiasi* app musicale attiva sul telefono (YouTube Music, Tidal, SoundCloud, VLC, player locali) previo permesso esplicito dell'utente.
   - **Su iOS:** Utilizzo delle API `MPMusicPlayerController` / MusicKit e sincronizzazione Cloud API (poiché iOS limita per motivi di sandboxing la lettura delle notifiche di app terze non-Apple).

### Flusso Real-Time (Zero Carico sul Database)
1. L'utente A cambia canzone -> Il client (o il worker di sincronizzazione) invia l'evento `NOW_PLAYING_UPDATE` al server Backend.
2. Il Backend salva lo stato in **Redis** con un TTL (Time-To-Live) di 5 minuti: `presence:user:{id} -> { track, artist, cover, timestamp, provider }`.
3. Tramite **Redis Pub/Sub + WebSockets**, solo gli amici di A attualmente online ricevono il delta in tempo reale e vedono aggiornarsi la **Live Top Bar**.

---

## 3. Catalogo Musicale e Traduzione Link (ISRC)
- **Database di Riferimento:** **MusicBrainz** (open-source, senza limiti commerciali stringenti) combinato con i metadati e le copertine di **Spotify / Apple Music / Deezer**.
- **Risoluzione Universale:** Ogni traccia viene indicizzata tramite il suo codice **ISRC** (International Standard Recording Code). Quando l'utente A (Spotify) invia una canzone all'utente B (Apple Music), il backend risolve l'ISRC e fornisce a B il deep-link nativo per Apple Music.
- **Audio Preview (30s):** Per la modalità *Music Reels* e *Roulette*, vengono utilizzati gli URL di preview di 30 secondi forniti dalle API pubbliche (es. Deezer API / Spotify / Apple Music), garantendo riproduzione istantanea senza richiedere abbonamenti premium specifici.

---

## 4. Elenco dei Componenti Frontend da Sviluppare

### Componenti Core Condivisi (Concettuali Web & Mobile)
1. **`<LiveFriendsBar />`:** Barra orizzontale fissata in alto che mostra gli amici online, la miniatura della copertina del disco che stanno ascoltando, lo stato di riproduzione animato e il toggle rapido per la propria *Ghost Mode*.
2. **`<NotificationPresenceWidget />` (Mobile OS):** Componente nativo per la barra delle notifiche di sistema (Ongoing Notification su Android / Live Activity su iOS) che mostra un resoconto rapido degli amici in ascolto.
3. **`<ReleaseHeaderCard />`:** Intestazione di un album o singolo con colore dinamico estratto dalla cover, **Audience Score** (stile Rotten Tomatoes / RYM) e in futuro **Critic Score**.
4. **`<ReviewComposer />`:** Editor con salvataggio automatico in bozza, selettore del voto, suggerimento rapido degli ultimi brani ascoltati e selettore di *Vibe Tags*.
5. **`<DiscoveryReelsFeed />`:** Scroller verticale a schermo intero a 60/120fps con pre-caricamento dell'audio di 30s del brano successivo, tasto rapido "Salva nella mia libreria" e "Annulla ultimo swipe".
6. **`<GenreRouletteWheel />`:** Interfaccia ludica ma minimale per pescare un genere sconosciuto e ascoltare subito 3 brani rappresentativi.
7. **`<MusicChatBubble />`:** Card messaggio specifica per le canzoni consigliate in chat, con player di anteprima integrato e pulsante "Apri nella tua app" + reazione rapida ("🔥", "❤️", "Non fa per me").

---

## 5. Mappa delle API e Contratti Realizzati

### Backend Fastify (`apps/api`)
- `GET /health`: Healthcheck, stato uptime e timestamp.
- **Modulo Autenticazione (`/api/auth`):**
  - `GET /api/auth/spotify/login`: Genera URL di autorizzazione OAuth2 con scope di scrobbling.
  - `GET /api/auth/spotify/callback`: Scambio codice, salvataggio token in `ConnectedAccount`, emissione JWT sessione.
  - `GET /api/auth/lastfm/login`: Genera URL di login Last.fm.
  - `GET /api/auth/lastfm/callback`: Recupero sessione con firma crittografica MD5 e associazione profilo.
  - `GET /api/auth/me`: Profilo utente autenticato e lista account collegati.
- **Modulo Catalogo (`/api/catalog`):**
  - `GET /api/catalog/search?q=...`: Ricerca album e brani nel DB locale con arricchimento ed indicizzazione on-the-fly.
  - `GET /api/catalog/releases/:id`: Recupero release con tracce e punteggi aggregati.
  - `GET /api/catalog/preview?title=...&artist=...&isrc=...`: Risoluzione a cascata dell'anteprima audio 30s (Deezer -> iTunes).
- **Modulo Recensioni (`/api/reviews`):**
  - `POST /api/reviews`: Creazione/aggiornamento recensione con verifica scrobble e ricalcolo Audience Score.
  - `GET /api/reviews/release/:releaseId`: Elenco recensioni della release con conteggi reazioni.
  - `POST /api/reviews/reaction`: Toggle reazione costruttiva (`AGREE`, `WELL_WRITTEN`, `DISCOVERED`, `HEART`).
- **Modulo Profilo (`/api/profile`):**
  - `GET /api/profile/me`: Profilo dell'utente corrente con statistiche e rotazione pesante.
  - `GET /api/profile/:userId`: Profilo pubblico con diario recensioni e top 5 brani più ascoltati.
- **Modulo Discovery (`/api/discovery`):**
  - `GET /api/discovery/reels`: Feed verticale di tracce/album con anteprima 30s e snippet della miglior recensione.
  - `GET /api/discovery/roulette`: Roulette Russa dei generi (algoritmo "Out-of-the-bubble" con starter pack di 3 brani).
- **Modulo Chat Musicale (`/api/chat`):**
  - `POST /api/chat/messages`: Invio brano consigliato con traduzione universale deep-link ISRC.
  - `GET /api/chat/conversation/:otherUserId`: Conversazione 1-to-1 con storico brani e stato "Ascoltato".
  - `POST /api/chat/reaction`: Reazione rapida (`FIRE`, `HEART`, `NOT_FOR_ME`) a un brano.
  - `POST /api/chat/listened`: Segna il brano come ascoltato.
- **Modulo Playlist (`/api/playlists`):**
  - `POST /api/playlists`: Creazione playlist tematica.
  - `POST /api/playlists/track`: Aggiunta traccia sul Lato A o Lato B (vinile analogico).
  - `GET /api/playlists/:id`: Dettaglio playlist con tracce divise per lato e durata totale.
  - `GET /api/playlists/user/:userId`: Elenco playlist create dall'utente.
- **Modulo Notifiche OS (`/api/notifications`):**
  - `GET /api/notifications/presence-summary`: Riassunto amici attivi in ascolto per Ongoing Notification (Android) e Live Activity (iOS).
- **Modulo Critica & Dual Score (`/api/critic`):**
  - `POST /api/critic/apply`: Candidatura per accreditamento giornalista / testata musicale.
  - `POST /api/critic/verify`: Approvazione badge critico accreditato con data di verifica.
  - `POST /api/critic/reviews`: Pubblicazione recensione della critica con testata (`outletName`) e link articolo originale (`originalReviewUrl`).
  - `GET /api/critic/dual-score/:releaseId`: Calcolo parallelo di Voto del Pubblico (Audience Score) e Voto della Critica (Critic Score) stile Rotten Tomatoes.
- **Modulo Spazio Video Musicale (`/api/videos`):**
  - `GET /api/videos/feed`: Feed video-contenuti ed editoriali musicali con paginazione.
  - `POST /api/videos`: Pubblicazione di video-recensioni, video-saggi o interviste collegate ad album/tracce.
  - `GET /api/videos/release/:releaseId`: Video correlati a uno specifico album/EP.
- **Modulo Spotify & Sync Engine (`/api/spotify`):**
  - `GET /api/spotify/currently-playing`: Recupera il brano in riproduzione attiva su Spotify e aggiorna lo stato real-time.
  - `POST /api/spotify/sync-playback`: Sincronizza Now Playing con Redis, Socket.io e registra `ScrobbleLog` (badge Ascolto Verificato con deduplicazione).
  - `GET /api/spotify/heavy-rotation`: Top 5 brani dell'ultimo mese per il profilo utente con cache Redis (TTL 3600s).
  - `GET /api/spotify/recently-played`: Cronologia recente degli ascolti con codici ISRC.
  - `GET /api/spotify/top-artists`: Top artisti del profilo per affinità musicale.
  - `POST /api/spotify/export-playlist`: Esporta una playlist vinilica creata su OpenMusic (Lato A / Lato B) direttamente sull'account Spotify dell'utente tramite risoluzione ISRC.
- **WebSocket Gateway (`now-playing.gateway.ts`):**
  - Evento `CLIENT_UPDATE_TRACK`: Aggiorna presenza in Redis (`setex` con TTL 300s) e broadcast ad amici.
  - Evento `CLIENT_TOGGLE_GHOST`: Attiva/disattiva Ghost Mode e rimuove broadcast.
  - Evento `SERVER_INITIAL_FRIENDS_STATE`: Invio immediato lista amici tramite Redis `MGET` O(N).

### Mobile Components & Hooks (`apps/mobile`)
- `useNowPlayingSocket`: Hook per connessione automatica Socket.io, gestione riconnessioni, sync `FriendPresence[]` e trigger per cambio traccia e Ghost Mode a 1-tap.
- `<ReleaseHeaderCard />`: Card testata album con colore dinamico estratto dalla cover, Audience Score stile Rotten Tomatoes e play anteprima.
- `<ReviewComposer />`: Modale editoriale per recensioni con rating a 0.5 stelle (salvato 10..100), vibe tags, badge ascolto verificato e auto-save.
- `<UserProfileView />`: Vista profilo completa con statistiche tabular-nums, classifica "In Rotazione Pesante" e diario recensioni.
- `<DiscoveryReelsFeed />`: Feed verticale snap a schermo intero con pre-buffering (Soglia di Doherty), pulsante Undo Swipe (Euristica #3) e Thumb Zone (Legge di Fitts).
- `<GenreRouletteWheel />`: Disco vinile analogico rotante a 60/120fps con Reanimated v3, feedback tattile e starter pack con 3 anteprime audio.
- `<MusicChatBubble />`: Card messaggio specifica per consigli musicali con mini-player 30s, pulsante "Apri nella tua app" via ISRC e reazioni rapide (`Fire`, `Heart`, `ThumbsDown`).
- `<ThemedPlaylistView />`: Playlist a vinile con switcher a molla per Lato A / Lato B, contatore durata ed export ISRC.
- `<NotificationPresenceWidget />`: Widget nativo per Lock Screen / barra notifiche con amici attivi e preview in tempo reale.
- `<DualScoreCard />`: Doppio indicatore stile Rotten Tomatoes (Critic Score vs Audience Score) con percentuali freschezza/marciume, conteggio recensioni e tipografia monospazio tabulare.
- `<CriticReviewCard />`: Scheda editoriale per recensioni dei critici con badge testata verificata, estratto citazione, data formattata e link esterno all'articolo originale.
- `<MusicVideoPlayerCard />`: Scheda multimediale per video saggi e recensioni musicali con thumbnail, badge durata in overlay, indicatore piattaforma (YouTube/Vimeo) e tag di genere.

### Web Components & Pages (`apps/web` - Next.js 14 App Router)
- **Architettura & Styling:** Next.js 14 (App Router) + Tailwind CSS con token analogici `THEME` (`#121214`, `#1C1C1F`, `#F3F0E6`, `#D97736`, `#4E9F6E`, `#C85A4B`) e Google Fonts editoriali (`Fraunces`, `Plus Jakarta Sans`, `JetBrains Mono`).
- **`AudioPlayerContext` & `<AudioPlayerBar />`:** Dock audio fisso per l'ascolto delle anteprime 30s senza barriere, con progress bar analogica e cifre tabulari.
- **`<LiveFriendsTicker />`:** Barra real-time orizzontale web con indicatore pulsante di ascolto condiviso e supporto per Ghost Mode.
- **`<DualScoreBadge />`:** Tachimetro reattivo Rotten Tomatoes per il confronto visivo immediato tra Voto della Critica e Voto del Pubblico.
- **`<ReleaseCard />`:** Card album con hover dinamico, ambient tint color e trigger audio anteprima 30s.
- **`<SpotifyConnectCard />`:** Widget interattivo per la sincronizzazione real-time della riproduzione Spotify, status ascolto verificato e visualizzazione della rotazione pesante.
- **`<GenreRouletteInteractive />`:** Roulette dei generi interattiva con disco vinile rotante animato e starter pack di 3 brani fuori dalla propria bolla.
- **Pagine & Piattaforma:**
  - `src/app/page.tsx` (`/`): Landing page editoriale con ticker amici, classifiche release, roulette e manifesto anti-AI-slop.
  - `src/app/releases/[id]/page.tsx` (`/releases/[id]`): Scheda release con Server-Side Rendering (SSR), metadati OpenGraph/SEO, tracklist a doppio lato (Lato A / Lato B in `ReleaseTracklistClient.tsx`), e recensioni della critica affiancate a quelle del pubblico.
  - `src/app/critics/page.tsx` (`/critics`): Portale dedicato a giornalisti e webzine per la richiesta di accredito ufficiale e vetrina delle testate verificate.
  - `src/app/videos/page.tsx` (`/videos`): Galleria multimediale di video saggi musicali, analisi armoniche e recensioni con filtri per categoria.