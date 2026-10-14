# 🤖 AI Assistant Context & Engineering Rules v2.0 (OpenMusic)

> **ISTRUZIONI PER QUALSIASI ASSISTENTE AI:** Leggi attentamente questo file e la cartella `docs/` prima di generare codice, proporre modifiche architetturali o disegnare componenti UI per **OpenMusic**.

---

## 1. Identità del Progetto e Obiettivo
Stiamo costruendo **OpenMusic**, un social network musicale multipiattaforma (App Mobile Expo React Native + Sito Web Next.js + Backend Fastify Node.js + PostgreSQL/Prisma + Redis) open-source.
- **Autore/Maintainer principale:** Laureato in Informatica (Università di Pisa), forte background in TypeScript, JavaScript, Java, Python, C/C++, basi di React, in fase di ramp-up sullo sviluppo Mobile (React Native/Expo).
- **Approccio richiesto:** Ingegneria del software rigorosa (stile Big Tech), codice modulare, fortemente tipizzato, facilmente manutenibile nel tempo.

---

## 2. Regole Auree sul Codice (Coding Standards)
1. **Strict TypeScript (Zero Any):** Evita `any` senza eccezioni. Tutti i payload tra Backend (`apps/api`), Web (`apps/web`) e Mobile (`apps/mobile`) devono condividere le interfacce e gli schemi Zod definiti in `packages/shared`.
2. **Separazione Backend / Frontend & Contract-First:**
   - Il Frontend non chiama mai direttamente API segrete di provider musicali se richiedono secret server-side.
   - La logica real-time ("Now Playing") risiede in **Redis (Pub/Sub + RAM) + WebSockets**, mai facendo polling pesante su PostgreSQL.
   - Le modifiche al backend seguono l'approccio Contract-First: prima Zod e interfacce in `packages/shared`, poi logica in `apps/api`.
3. **Audio Preview Fallback (ISRC):** Risoluzione anteprima 30s tramite Spotify -> Deezer -> iTunes tramite codice ISRC.

---

## 3. Atlante di Design & Regole Tassative UI/UX ("ZERO AI-SLOP")
È **TASSATIVAMENTE VIETATO** generare interfacce "AI-Slop" (sfondi nero puro `#000000`, gradienti neon viola/blu/ciano `#8B5CF6 -> #06B6D4`, icone generiche, layout da dashboard SaaS generica, card cyberpunk luminescenti).

### A. Tipografia Editoriale
- **Titoli Album, Voti e Intestazioni Recensioni (`THEME.typography.fontEditorial`):** Usa **`Fraunces`** o **`Cabinet Grotesk`**.
- **UI, Corpo Testo e Chat (`THEME.typography.fontSans`):** Usa **`Plus Jakarta Sans`** o **`Satoshi`**.
- **Durate Brani, Audience Score % e Timestamp (`THEME.typography.fontMono`):** Usa **`JetBrains Mono`** con `fontVariant: ['tabular-nums']` obbligatorio.

### B. Palette Colori Materica (Importa SEMPRE `THEME` da `@openmusic/shared`)
- **Sfondo Primario:** Grigio Vinile Caldo `#121214` (MAI `#000000`).
- **Superfici Card / Player:** `#1C1C1F` con bordo sottile `#2A2A2E`.
- **Testo Primario:** Crema / Carta Avorio `#F3F0E6`; **Secondario:** Sabbia `#9E9B93`.
- **Accenti:** Ambra Analogico `#D97736`, Verde "Fresh" `#4E9F6E` (Audience Score >= 70%), Rosso "Rotten" `#C85A4B`.
- **Dynamic Cover Tint:** `dominantColor` estratto dalla copertina album, desaturato al 20-30% di opacità per contrasto WCAG AA.

### C. Iconografia
- Usa esclusivamente **Phosphor Icons** (`phosphor-react-native` su mobile, `@phosphor-icons/react` su web).
- Peso `regular` per stati inattivi; pesi **`duotone`** o **`fill`** per stati attivi (es. preferiti, badge Ascolto Verificato, Ghost Mode attiva, reazioni).

### D. Animazioni a 60/120fps e Fisica
- **Mobile:** Usa sempre `react-native-reanimated` v3 (`useSharedValue`, `useAnimatedStyle`, `withSpring` con `THEME.spring.snappy` o `THEME.spring.gentle`). Mai `Animated` legacy.
- **Liste e Feed:** Usa `@shopify/flash-list` con `estimatedItemSize` dichiarato.
- **Feedback Tattile:** `expo-haptics` (`Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`) su azioni chiave (Ghost Mode, rating, save reel, reazioni).

### E. Euristiche di Nielsen + Leggi della UX
- **10 Euristiche di Jakob Nielsen** (in `docs/02_DESIGN_AND_NIELSEN.md`).
- **Legge di Fitts:** Controlli primari sempre nella **Thumb Zone** inferiore.
- **Soglia di Doherty (< 400ms):** Pre-buffering audio 30s per i brani `N+1` e `N+2` nei Reels.

---

## 4. Dove verificare lo stato e le decisioni
- Consulta sempre `docs/04_STATUS_AND_OPEN_QUESTIONS.md` prima di ogni implementazione.
