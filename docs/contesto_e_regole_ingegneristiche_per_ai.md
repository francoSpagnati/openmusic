# 🤖 AI Assistant Context & Engineering Rules (OpenMusic)

> **ISTRUZIONI PER QUALSIASI ASSISTENTE AI (Cursor, Copilot, Gemini, Claude):** Leggi attentamente questo file e la cartella `docs/` prima di generare codice, proporre modifiche architetturali o disegnare componenti UI per **OpenMusic**. Tutte le scelte qui riportate sono vincolanti.

## 1. Identità del Progetto e Obiettivo
Stiamo costruendo **OpenMusic** (`https://github.com/francoSpagnati/openmusic`), un social network musicale multipiattaforma (App Mobile + Sito Web) open-source con licenza MIT.
- **Autore/Maintainer principale:** Laureato in Informatica (Università di Pisa), solido background in TypeScript, JavaScript, Java, Python, C/C++, basi di React, in fase di ramp-up sullo sviluppo Mobile (React Native/Expo).
- **Approccio richiesto:** Ingegneria del software rigorosa (stile Big Tech), codice modulare, fortemente tipizzato, facilmente aggiornabile e mantenibile. Ogni volta che introduci pattern specifici di React Native o Expo (es. Native Modules, Reanimated worklets), commenta il *perché* architetturale.

## 2. Decisioni Architetturali Chiuse (Single Source of Truth)
1. **Sistema di Rating Duale (RYM + Rotten Tomatoes):**
   - L'utente vota su una scala da $0.5$ a $5.0$ stelle (con incrementi di $0.5$), salvata a database come intero $rating \in [10, 100]$ (dove $0.5 \text{ stelle} = 10$ e $5.0 \text{ stelle} = 100$).
   - L'aggregato mostra **due metriche del pubblico**: la **Media Bayesiana** su base $5.00$ (stile RateYourMusic) e la **Percentuale di Gradimento / Freshness** (stile Rotten Tomatoes, calcolata come percentuale di voti $\ge 70/100$, ovvero $\ge 3.5$ stelle).
   - Il database supporta già il **Voto della Critica** (`Role.CRITIC`), che verrà attivato in una fase successiva.
2. **Anti-Review Bombing & "Vivere Sereni":**
   - Niente commenti pubblici aperti agli sconosciuti sotto le recensioni per evitare flame tra fandom. Si usano **Reazioni Curate** costruttive e risposte testuali limitate agli amici reciproci (*Mutuals*) o che aprono una chat privata.
   - Se un utente recensisce un album che risulta effettivamente ascoltato tramite il suo *scrobbling*, la recensione ottiene il badge **"Ascolto Verificato"** e ha un peso maggiore ($w = 1.5$) nel calcolo della media bayesiana rispetto a chi vota senza aver ascoltato ($w = 0.5$).
3. **Preview Audio Universali da 30s (Reels & Roulette):**
   - Non dipendiamo esclusivamente da Spotify per gli MP3 di anteprima. Il backend usa un `PreviewResolverService` che interroga **Apple iTunes Search API** (AAC $256\text{ kbps}$) e **Deezer API** (MP3 $128\text{ kbps}$) tramite codice **ISRC** o metadati, garantendo il funzionamento dei *Music Reels* anche agli utenti senza abbonamento premium.
4. **Presenza Live & Spazio Notifiche Mobile:**
   - In-app: barra superiore `<LiveFriendsBar />` aggiornata via **WebSockets + Redis Pub/Sub**.
   - Sistema Operativo Mobile: *Ongoing Notification* espandibile su Android + *Widget Lock Screen / Home Screen* e *Live Activities* su iOS.

## 3. Regole Auree sul Codice (Coding Standards)
1. **Strict TypeScript:** Vietato l'uso di `any`. Tutti i DTO, gli eventi WebSocket e gli schemi di validazione (`Zod`) risiedono in `packages/shared`.
2. **Separazione Backend / Frontend:**
   - Il Frontend non contiene mai chiavi segrete.
   - Lo stato "Now Playing" risiede in **Redis** con TTL, mai facendo query di scrittura continua su PostgreSQL ad ogni cambio canzone.
3. **Performance Mobile First:** Su `apps/mobile`, usa `@shopify/flash-list` per le liste, `react-native-reanimated` per animazioni a $60/120\text{ fps}$ sul thread UI nativo e pre-buffering audio per lo scroll verticale dei *Music Reels*.

## 4. Regole Tassative di UI/UX ("NO AI-SLOP")
- **VIETATO lo stile "AI-Slop":** Vietati sfondi `#000000` con gradienti viola/ciano cyberpunk (`#8B5CF6` $\rightarrow$ `#06B6D4`), bordi neon finti o layout anonimi.
- **Mood Editoriale e Caldo:** Usa la palette *Warm Vinyl* (`#121214` scuro caldo, `#1C1C1F` card, `#F3F0E6` testo crema, `#D97736` ambra vinile) + colori estratti dinamicamente dalle copertine degli album e opportunamente desaturati.
- **Euristiche di Nielsen obbligatorie:** Rispetta sempre le 10 euristiche mappate in `docs/02_DESIGN_AND_NIELSEN.md` (in particolare: *Ghost Mode* a 1-tap, *Undo* sugli swipe della Roulette/Reels, auto-salvataggio delle bozze delle recensioni).