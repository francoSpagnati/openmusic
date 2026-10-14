# 🏗️ Architettura Tecnica, Algoritmi e Schema Database

## 1. Struttura del Monorepo (Turborepo)
Il progetto divide nettamente il Backend dal Frontend ma condivide i contratti di rete e i tipi TypeScript per azzerare i bug di disallineamento:

```text
openmusic/
├── apps/
│   ├── api/                 # Backend Node.js + Fastify + Socket.io + BullMQ workers
│   ├── mobile/              # App iOS & Android (React Native + Expo + Reanimated)
│   └── web/                 # Web App & SEO Public Pages (Next.js App Router)
├── packages/
│   ├── db/                  # Schema Prisma, migrazioni SQL e client PostgreSQL
│   ├── shared/              # Tipi TypeScript, schemi Zod, costanti ed eventi WebSocket
│   └── ui-tokens/           # Palette colori "Warm Vinyl", spaziature e costanti tipografiche
├── docs/                    # Documentazione di progetto e ADR
├── docker-compose.yml       # PostgreSQL 16 + Redis 7 per sviluppo locale
└── turbo.json               # Pipeline di build, test e linting
```

---

## 2. Algoritmo del Sistema di Rating (RYM + Rotten Tomatoes)

Per evitare che un album con $1$ sola recensione da $5.0$ stelle risulti "migliore" di un capolavoro con $500$ recensioni e media $4.4$, OpenMusic utilizza due indicatori complementari calcolati ad ogni nuova recensione:

### A. Ponderazione "Ascolto Verificato"
Ogni recensione $i$ ha un peso $w_i$:
- Se l'utente ha almeno $\ge 3$ tracce dell'album (o la traccia specifica) registrate nel proprio storico di ascolto (*Scrobble History*) prima della recensione: **Ascolto Verificato** $\rightarrow w_i = 1.5$.
- Se l'utente vota manualmente dal catalogo senza storico di ascolto registrato: $w_i = 1.0$.

### B. Media Bayesiana Ponderata (Stile RateYourMusic)
Il punteggio medio mostrato su scala $0.50 - 5.00$ è calcolato con la formula bayesiana:

$$S_{\text{bayes}} = \frac{C \cdot m + \sum_{i=1}^{n} w_i \cdot r_i}{C + \sum_{i=1}^{n} w_i}$$

Dove:
- $r_i \in [0.5, 5.0]$ è il voto dell'utente $i$-esimo.
- $w_i$ è il peso della recensione.
- $m = 3.25$ è la media a priori globale del catalogo.
- $C = 10$ è la costante di confidenza (soglia di stabilizzazione).

### C. Percentuale di Gradimento / Acclaim Score (Stile Rotten Tomatoes)
Accanto alla media su $5.00$, viene mostrata la percentuale di utenti che consigliano l'opera (voto $\ge 3.5$ stelle, ovvero $\ge 70/100$):

$$P_{\text{acclaim}} = \left( \frac{\sum_{r_i \ge 3.5} w_i}{\sum_{i=1}^{n} w_i} \right) \times 100\%$$

---

## 3. Architettura del "Multi-Provider Preview Resolver" (Music Reels & Roulette)

Per garantire che lo scroll verticale dei *Music Reels* e la *Roulette dei Generi* riproducano istantaneamente anteprime di $30\text{ secondi}$ ad alta qualità senza blocchi di licenza:

1. Quando una traccia entra nel catalogo o viene richiesta nel feed Discovery, il servizio backend `PreviewResolverService` controlla se `Track.previewUrl` è già presente e valido.
2. Se manca, esegue una risoluzione a cascata (con caching su Redis):
   - **Step 1 (Apple iTunes Search API):** Cerca tramite codice `ISRC` (`https://itunes.apple.com/lookup?isrc={ISRC}`) o query `artist + title`. Restituisce un file `.m4a` (AAC $256\text{ kbps}$) di $30\text{ s}$ pubblico e velocissimo.
   - **Step 2 (Deezer Public API):** Se non trovato su iTunes, interroga `https://api.deezer.com/track/isrc:{ISRC}` ottenendo l'MP3 di anteprima da $30\text{ s}$.
   - **Step 3 (Spotify Web API):** Usa `preview_url` di Spotify se disponibile.
3. Sul client mobile (`apps/mobile`), il componente `<DiscoveryReelsFeed />` mantiene un buffer circolare di 3 player audio: mentre l'utente ascolta la traccia $k$, la traccia $k+1$ ha già scaricato i primi $5\text{ secondi}$ di buffer audio in background, garantendo avvio in $< 100\text{ ms}$ allo swipe.

---

## 4. Architettura Notifiche Persistenti & Stato Live (iOS vs Android)

Per realizzare il resoconto rapido nello spazio notifiche sempre presente che mostra chi degli amici è online e cosa sta ascoltando:

1. **In-App (Web + iOS + Android):**
   - Componente `<LiveFriendsBar />` ancorato nella parte superiore della Home. Si aggiorna in push tramite **Socket.io** collegato al canale Redis `presence:friends:{userId}`.
2. **Android (Ongoing Social Notification):**
   - Un servizio leggero aggiorna una notifica silenziosa a bassa priorità (senza suono né vibrazione) nella tendina di Android con layout compatto (*"3 amici in ascolto ora"*) ed espandibile fino a 4 righe (*"Marco: Pink Floyd - Time • Sofia: Charli XCX - 360"*). L'utente può disattivarla in qualsiasi momento dalle impostazioni.
3. **iOS (Lock Screen Widget + Live Activities):**
   - Poiché iOS non permette notifiche classiche permanenti non-removibili, usiamo un **Widget Lock Screen / Home Screen** nativo (tramite `expo-apple-targets` / WidgetKit) che mostra gli amici in ascolto, affiancato da una **Live Activity (Dynamic Island)** attivabile durante le sessioni attive dell'utente.

---

## 5. Schema Completo del Database (`packages/db/prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  USER
  CRITIC      // Giornalisti musicali e webzine (Fase 2)
  MODERATOR
}

enum ReleaseType {
  ALBUM
  SINGLE
  EP
}

enum ReactionType {
  INSIGHTFUL  // "Recensione illuminante 💡"
  CONVINCED   // "Mi hai convinto ad ascoltarlo 🎧"
  AGREE       // "Concordo al 100% 🤝"
  VIBE        // "Stessa atmosfera ✨"
}

model User {
  id                  String    @id @default(uuid())
  username            String    @unique
  displayName         String?
  email               String    @unique
  passwordHash        String?
  avatarUrl           String?
  bio                 String?
  role                Role      @default(USER)
  preferredProvider   String    @default("spotify") // "spotify", "apple_music", "youtube_music", "deezer"
  isGhostMode         Boolean   @default(false)     // Euristica 3: Ascolto privato a 1-tap
  osNotificationOptIn Boolean   @default(true)      // Mostra riepilogo amici nella tendina notifiche
  favoriteGenres      String[]                      // Usato per calcolare sia affinità sia la Roulette Russa
  createdAt           DateTime  @default(now())

  connectedAccounts   ConnectedAccount[]
  scrobbles           ScrobbleLog[]
  reviews             Review[]
  reviewReactions     ReviewReaction[]
  playlists           Playlist[]
  sentMessages        DirectMessage[] @relation("sentMessages")
  receivedMessages    DirectMessage[] @relation("receivedMessages")
  
  following           Follows[] @relation("following")
  followedBy          Follows[] @relation("followedBy")
}

model ConnectedAccount {
  id           String    @id @default(uuid())
  userId       String
  provider     String    // "spotify", "lastfm", "apple_music"
  providerId   String
  accessToken  String
  refreshToken String?
  expiresAt    DateTime?
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerId])
}

model Follows {
  followerId  String
  followingId String
  isMutual    Boolean  @default(false) // True se entrambi si seguono (abilita chat e risposte dirette)
  createdAt   DateTime @default(now())
  follower    User     @relation("following", fields: [followerId], references: [id], onDelete: Cascade)
  following   User     @relation("followedBy", fields: [followingId], references: [id], onDelete: Cascade)

  @@id([followerId, followingId])
}

model Release {
  id              String      @id @default(uuid())
  musicbrainzId   String?     @unique
  spotifyId       String?     @unique
  appleMusicId    String?     @unique
  title           String
  artistName      String
  releaseType     ReleaseType @default(ALBUM)
  genres          String[]
  coverUrl        String?
  dominantColor   String?     // Hex color estratto per UI dinamica Warm Vinyl
  releaseDate     DateTime?
  
  // Metriche Pubblico (RYM Bayesian Average + Rotten Tomatoes Acclaim %)
  audienceBayesian Float?     // Scala 0.50 - 5.00
  audienceAcclaim  Int?       // Percentuale 0 - 100% (voti >= 3.5 stelle)
  audienceCount    Int        @default(0)

  // Metriche Critica (Predisposte per Fase futura)
  criticBayesian   Float?
  criticAcclaim    Int?
  criticCount      Int        @default(0)

  tracks          Track[]
  reviews         Review[]
}

model Track {
  id            String        @id @default(uuid())
  isrc          String?       @unique // Chiave universale per traduzione link e Audio Preview
  spotifyId     String?       @unique
  appleMusicId  String?       @unique
  deezerId      String?       @unique
  title         String
  artistName    String
  durationMs    Int
  previewUrl    String?       // URL clip 30s risolta tramite PreviewResolverService
  previewSource String?       // "itunes", "deezer", "spotify"
  genres        String[]
  releaseId     String
  release       Release       @relation(fields: [releaseId], references: [id], onDelete: Cascade)
  reviews       Review[]
  scrobbles     ScrobbleLog[]
}

model ScrobbleLog {
  id         String   @id @default(uuid())
  userId     String
  trackId    String
  playedAt   DateTime @default(now())
  sourceApp  String   // "spotify", "apple_music", "android_media_session", "lastfm"
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  track      Track    @relation(fields: [trackId], references: [id], onDelete: Cascade)

  @@index([userId, playedAt(sort: Desc)])
  @@index([userId, trackId])
}

model Review {
  id               String           @id @default(uuid())
  userId           String
  releaseId        String?
  trackId          String?
  rating           Int              // 10..100 (es. 70 = 3.5 stelle, 90 = 4.5 stelle)
  content          String?
  isCritic         Boolean          @default(false)
  isVerifiedListen Boolean          @default(false) // True se presente in ScrobbleLog dell'utente
  vibeTags         String[]         // Es. ["Notturno", "Vinile", "Melanconico"]
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  user             User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  release          Release?         @relation(fields: [releaseId], references: [id], onDelete: Cascade)
  track            Track?           @relation(fields: [trackId], references: [id], onDelete: Cascade)
  reactions        ReviewReaction[]

  @@unique([userId, releaseId])
  @@unique([userId, trackId])
}

model ReviewReaction {
  id        String       @id @default(uuid())
  reviewId  String
  userId    String
  type      ReactionType
  createdAt DateTime     @default(now())

  review    Review       @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([reviewId, userId, type])
}

model Playlist {
  id          String   @id @default(uuid())
  userId      String
  title       String
  description String?
  themeTag    String?
  coverUrl    String?
  trackIds    String[] // Array ordinato di ID Track
  isPublic    Boolean  @default(true)
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model DirectMessage {
  id              String   @id @default(uuid())
  senderId        String
  receiverId      String
  text            String?
  sharedTrackId   String?  // Se il messaggio consiglia una canzone
  sharedReleaseId String?  // Se il messaggio consiglia un album
  reaction        String?  // Reazione rapida del destinatario dopo l'ascolto
  isListened      Boolean  @default(false) // Indica se il destinatario ha riprodotto il consiglio
  createdAt       DateTime @default(now())

  sender          User     @relation("sentMessages", fields: [senderId], references: [id], onDelete: Cascade)
  receiver        User     @relation("receivedMessages", fields: [receiverId], references: [id], onDelete: Cascade)

  @@index([senderId, receiverId, createdAt(sort: Desc)])
}
```