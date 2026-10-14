# 🚦 Stato del Progetto, Roadmap e Questioni Aperte (TBD)

> **Ultimo aggiornamento:** Fase di Setup Iniziale & Architettura (Milestone 0).

## 1. Stato Attuale del Progetto
- [x] Creazione repository GitHub (`francoSpagnati/openmusic`) con licenza MIT.
- [x] Definizione Visione, Personas, Euristiche di Nielsen e Architettura Monorepo.
- [x] Definizione Schema Database iniziale (`Prisma` con supporto per User, Release, Track, Review, Audience/Critic Score, ConnectedAccount).
- [ ] Inizializzazione Monorepo (Turborepo, Docker Compose per Postgres + Redis).
- [ ] Setup `apps/api` (Backend Node.js/TypeScript).
- [ ] Setup `apps/mobile` (Expo React Native) e `apps/web` (Next.js).

---

## 2. Roadmap di Sviluppo (Milestones)

### 🏁 Milestone 1: Core Infrastructure & "Now Playing" (MVP Parte 1)
- Setup completo del Monorepo e del database PostgreSQL + Redis in Docker.
- Autenticazione utenti e collegamento OAuth con **Spotify** e **Last.fm**.
- Implementazione del motore WebSockets per la **`<LiveFriendsBar />`** (vedere chi è online e cosa ascolta).

### 🏁 Milestone 2: Catalogo, Recensioni & Profilo (MVP Parte 2)
- Ricerca brani/album (integrazione API Spotify/MusicBrainz).
- Sistema di recensioni e calcolo del **Voto del Pubblico** (Audience Score).
- Pagina Profilo con *"Cosa sto ascoltando"*, *"Cosa mi sta piacendo ultimamente"* e diario recensioni.

### 🏁 Milestone 3: Discovery (Music Reels & Roulette)
- Sviluppo del feed verticale `<DiscoveryReelsFeed />` con pre-buffer delle clip audio da 30 secondi.
- Algoritmo della **Roulette Russa dei generi** (selezione di generi fuori dallo storico dell'utente).

### 🏁 Milestone 4: Chat Musicale, Playlist & Notifica OS
- Chat diretta per consigliarsi canzoni con traduzione universale dei link (ISRC).
- Creazione e condivisione di playlist tematiche.
- Implementazione della notifica persistente / Live Activity nello spazio notifiche del cellulare.

### 🏁 Milestone 5: Voto della Critica & Spazio Video (Espansione Futura)
- Portale di verifica per giornalisti/webzine musicali e attivazione del **Critic Score**.
- Sezione secondaria per la condivisione di video-contenuti a tema musicale.

---

## 3. Open Questions / Cose da Definire (TBD)

Queste sono le decisioni di prodotto e tecniche ancora aperte che andranno sciolte man mano che procediamo con le Milestone:

1. **Scala esatta del Voto del Pubblico nella UI:**
   - Nel database salviamo un intero `1-100` per massima flessibilità matematica.
   - *Da decidere:* Nell'interfaccia utente l'utente inserisce un voto da **0.5 a 5.0 stelle** (stile RYM/Letterboxd) oppure da **1 a 10 / 1 a 100**? E l'aggregato finale stile Rotten Tomatoes avrà una soglia di "Freschezza" (es. percentuale di utenti che hanno dato almeno 3.5/5)?
2. **Design e Limiti della Notifica Persistente su Mobile:**
   - Su **Android**, una *Ongoing Notification* può restare sempre visibile nella tendina notifiche mostrando "3 amici stanno ascoltando musica ora" ed espandersi con i titoli.
   - Su **iOS**, le *Live Activities* hanno un limite di durata imposto da Apple (fino a 8-12 ore) oppure possono essere affiancate da un **Widget per la Schermata Home / Lock Screen**. *Da decidere:* Su iOS puntiamo su Widget Lock Screen + Live Activity durante le sessioni di ascolto?
3. **Sorgente Primaria delle Anteprime Audio da 30s (Reels & Roulette):**
   - Spotify ha recentemente ristretto l'accesso agli URL `preview_url` per alcune nuove app in modalità sviluppo, mentre **Deezer API** e **Apple Music / iTunes Search API** forniscono anteprime MP3/AAC da 30 secondi gratuite e affidabili. *Proposta tecnica:* Usare un *Preview Resolver* nel backend che cerca l'anteprima su Spotify e fa fallback automatico su Deezer/iTunes tramite codice ISRC.
4. **Regole della Moderazione per "Vivere Sereni":**
   - Per evitare guerre tra fandom o commenti tossici sotto gli album: vogliamo permettere i commenti liberi sotto le recensioni altrui, oppure limitare le interazioni pubbliche a reazioni positive/apprezzamento della recensione, lasciando le discussioni alle chat tra amici?
5. **Strategia di Hosting Iniziale:**
   - Finché siamo in sviluppo usiamo Docker in locale. Per la prima beta pubblica: *Vercel* (per Next.js Web), *Railway / Fly.io / Render* (per Backend Node.js + Postgres + Redis) e *Expo Application Services (EAS)* per distribuire le build di test su iOS/Android.