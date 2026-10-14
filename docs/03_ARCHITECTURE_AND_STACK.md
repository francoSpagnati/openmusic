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