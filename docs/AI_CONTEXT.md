# 🤖 AI Assistant Context & Engineering Rules (OpenMusic)

> **ISTRUZIONI PER QUALSIASI ASSISTENTE AI:** Leggi attentamente questo file e la cartella `docs/` prima di generare codice, proporre modifiche architetturali o disegnare componenti UI per **OpenMusic**.

## 1. Identità del Progetto e Obiettivo
Stiamo costruendo **OpenMusic**, un social network musicale multipiattaforma (App Mobile + Sito Web) open-source.
- **Autore/Maintainer principale:** Laureato in Informatica (Università di Pisa), forte background in TypeScript, JavaScript, Java, Python, C/C++, basi di React, in fase di ramp-up sullo sviluppo Mobile (React Native/Expo).
- **Approccio richiesto:** Ingegneria del software rigorosa (stile Big Tech), codice modulare, fortemente tipizzato, facilmente aggiornabile e mantenibile nel tempo. Spiega sempre brevemente le scelte architetturali rilevanti, specialmente lato mobile nativo.

## 2. Regole Auree sul Codice (Coding Standards)
1. **Strict TypeScript:** Evita `any`. Tutti i payload tra Backend (`apps/api`), Web (`apps/web`) e Mobile (`apps/mobile`) devono condividere le interfacce definite in `packages/shared`.
2. **Separazione Backend / Frontend:**
   - Il Frontend non chiama mai direttamente le API segrete dei provider musicali se richiedono secret server-side; passa per `apps/api` o usa token OAuth scopati.
   - La logica real-time ("Now Playing") passa per **Redis + WebSockets**, mai facendo polling pesante sul database PostgreSQL.
3. **Performance Mobile First:** Su `apps/mobile`, privilegia `FlashList` (invece di `FlatList` standard per liste lunghe), `react-native-reanimated` (animazioni sul thread UI nativo) e memoizzazione (`useMemo`, `useCallback`) per evitare frame drop.

## 3. Regole Tassative di UI/UX ("NO AI-SLOP")
Quando generi codice Frontend (React / React Native / Tailwind / StyleSheet):
- **VIETATO lo stile "AI-Slop":** Non usare sfondi nero puro (`#000000`) accoppiati a gradienti neon viola/blu/ciano (`#8B5CF6` -> `#06B6D4`), card con bordi luminescenti finti o layout da dashboard SaaS generica.
- **Mood Editoriale e Caldo:** Usa palette calde e materiche (grigio vinile `#141416`, avorio caldo `#F4F1EA`, accenti ambra/terracotta o colori estratti dinamicamente dalla cover dell'album).
- **Euristiche di Nielsen obbligatorie:** Ogni vista deve mostrare chiaramente lo stato del sistema (es. connessione musicale attiva/inattiva), offrire sempre un controllo di uscita/annullamento (es. *Ghost Mode* per nascondere l'ascolto live, *Undo* sugli swipe) e prevenire gli errori (salvataggio automatico delle bozze delle recensioni).

## 4. Dove verificare lo stato attuale
Prima di implementare una feature, controlla sempre `docs/04_STATUS_AND_OPEN_QUESTIONS.md` per sapere in quale fase (Milestone) ci troviamo e quali decisioni tecniche sono già state prese o sono ancora aperte.