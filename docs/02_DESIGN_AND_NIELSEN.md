# 02 · Principi di design ed euristiche di Nielsen

> **Cosa c'è qui:** la filosofia "anti-AI-slop" e i requisiti UX (10 euristiche di Nielsen, leggi
> della UX, animazioni). **Cosa non c'è:** colori, font, spaziature e primitive, che stanno solo in
> [`05_DESIGN_SYSTEM.md`](./05_DESIGN_SYSTEM.md) (fonte di verità: `THEME` in
> `packages/shared/src/theme.ts`). Unifica i precedenti `02_DESIGN_AND_NIELSEN.md` e
> `design_system_anti_ai_slop_ed_euristiche_di_nielsen.md`, i cui valori di colore e font erano
> superati.

## 1. Direzione artistica: "Warm Editorial Vinyl"

OpenMusic deve sembrare un **negozio di dischi indipendente che stampa anche una rivista**: il calore
tattile della carta e delle copertine, con la reattività delle migliori app native (Discord,
Letterboxd).

### Cosa significa "NO AI-SLOP"

| Elemento    | Vietato                                                                   | OpenMusic                                                                   |
| ----------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Sfondo      | Nero piatto `#000000`, blu notte, bianco accecante `#FFFFFF`              | Carbone caldo (dark) / carta da rivista (light), grana analogica            |
| Accenti     | Gradienti neon viola/ciano (`#8B5CF6` → `#06B6D4`, `#6366F1` → `#EC4899`) | Un solo accento ambra; verde/rosso solo con significato (fresh/rotten/live) |
| Superfici   | Card "glass" traslucide con glow colorati                                 | Card a "busta di vinile" opache, bordi sottili, ombra calda                 |
| Tipografia  | Font di sistema senza gerarchia, display "da agenzia" (Syne)              | Serif editoriale (Fraunces) + sans leggibile + mono tabulare (ADR-008)      |
| Iconografia | Icone eterogenee, illustrazioni "Corporate Memphis"                       | Solo Phosphor, pesi coerenti                                                |
| Copywriting | "Esplora l'universo sonoro!"                                              | Linguaggio umano e diretto: "In rotazione tra i tuoi amici"                 |
| Movimento   | Transizioni lente e "gommose"                                             | Molle smorzate, durate brevi, `prefers-reduced-motion` rispettato           |

### Colore dinamico della copertina (requisito)

Su pagina album e Reels lo sfondo può prendere una tinta dal colore dominante della copertina,
convertito in HSL con luminosità 18–25 % e saturazione <= 45 %, in modo che il testo resti sempre

> = 4.5:1 (WCAG AA). _Stato:_ implementato sul web (`apps/web/src/components/discovery/ambientTint.ts`, pagina release e
> Reels) quando la release ha `dominantColor`; l'estrazione automatica dalla copertina non esiste
> ancora (il valore arriva dal seed).

## 2. Animazioni e feedback

- **Mobile:** `react-native-reanimated` v3 con molle sovra-smorzate (`THEME.spring.snappy` /
  `gentle`), mai `Animated` legacy; liste con `@shopify/flash-list`.
- **Web:** durate e easing dai token (`duration-fast`, `ease-tonearm`...), vedi `05` §4.
- **"Vinile in ascolto":** chi sta ascoltando mostra un disco che ruota solo durante la riproduzione.
- **Haptics (mobile):** `Haptics.selectionAsync()` a ogni mezza stella; `impactAsync(Medium)` su
  salvataggio dai Reels e Ghost Mode.

## 3. Leggi della UX

- **Fitts:** controlli primari nella _thumb zone_ inferiore su mobile.
- **Doherty (< 400 ms):** nei Reels si pre-caricano le anteprime dei brani `N+1` e `N+2`.
- **Hick:** al massimo una azione primaria per vista; il resto nel menu rapido (long press).

## 4. Le 10 euristiche di Jakob Nielsen

| #                                                                                                                       | Euristica di Nielsen                                | Requisito di Implementazione in OpenMusic                                                                                                                                                                                                                                                                                     |
| :---------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**                                                                                                                   | **Visibilità dello stato del sistema**              | La `<LiveFriendsBar />` mostra in tempo reale: (a) il tuo stato di sincronizzazione musicale (_Connesso a Spotify_, _In pausa_, o _Ghost Mode attiva_), (b) chi è online e il minuto esatto del brano che sta ascoltando tramite una sottile barra di avanzamento sotto la miniatura dell'album.                              |
| **2**                                                                                                                   | **Corrispondenza tra sistema e mondo reale**        | La terminologia rispecchia la cultura musicale reale: _In rotazione_, _Diario degli ascolti_, _Scaffale_, _Lato A / Lato B_. Le stelle e le percentuali di gradimento sono immediatamente comprensibili senza legende complesse.                                                                                              |
| **3**                                                                                                                   | **Controllo e libertà dell'utente**                 | **1) Ghost Mode istantanea:** Un tap sul proprio avatar nella barra superiore nasconde subito l'ascolto live. **2) Pulsante Undo universale:** Nei _Music Reels_ e nella _Roulette_, un bottone flottante permette sempre di tornare al brano appena scartato.                                                                |
| **4**                                                                                                                   | **Coerenza e standard**                             | In tutta l'app (Feed, Profilo, Chat, Reels): **Tap singolo** sulla cover = apre la scheda album; **Tap sul bottone Play** = avvia/ferma l'anteprima di $30\text{ s}$; **Long Press** = apre il menu rapido di condivisione/valutazione.                                                                                       |
| **5**                                                                                                                   | **Prevenzione degli errori**                        | **Auto-save locale delle bozze:** Mentre l'utente scrive una recensione su `MMKV` (mobile) / `localStorage` (web), ogni battitura viene salvata localmente. Se il telefono si spegne o l'app crasha, riaprendo l'album la recensione è ancora lì.                                                                             |
| **6**                                                                                                                   | **Riconoscimento anziché ricordo**                  | Aprendo il compositore di recensioni o il selettore per allegare un brano in chat, la vista mostra subito la griglia **"Ascoltati negli ultimi 60 minuti"** e **"In riproduzione ora"**, azzerando la necessità di digitare titoli a memoria.                                                                                 |
| **7**                                                                                                                   | **Flessibilità ed efficienza d'uso**                | Gli utenti nuovi possono valutare aprendo la scheda album; gli utenti esperti possono fare **swipe laterale** su qualsiasi traccia nel proprio diario per assegnare rapidamente il voto o aggiungerla ai preferiti, e i link condivisi si aprono direttamente nel player predefinito dell'utente grazie alla traduzione ISRC. |
| **8**                                                                                                                   | **Design estetico e minimalista**                   | Nessun rumore visivo: i contatori secondari, i codici catalogo, le etichette discografiche e l'istogramma completo dei voti sono racchiusi in una sezione espandibile _"Dettagli e Crediti"_ dentro la pagina dell'album, lasciando pulito il feed principale.                                                                |
| **9**                                                                                                                   | **Aiuto nel riconoscere e recuperare dagli errori** | Se l'API di Spotify o Apple Music revoca il token o va in timeout, non appare mai un errore bloccante o un codice HTTP `401/500`, ma un banner contestuale calmo: _"La connessione con Spotify si è interrotta. [Riconnetti con 1 tap]"_.                                                                                     |
| **10**                                                                                                                  | **Aiuto e documentazione**                          | All'ingresso nella _Roulette dei Generi_ o alla prima configurazione della notifica persistente, un piccolo coachmark non modale spiega in 2 righe il funzionamento e sparisce per sempre una volta compreso.                                                                                                                 |
| Ogni nuova schermata va verificata contro questa tabella prima del merge. Le euristiche non ancora                      |
| soddisfatte dal codice attuale (es. Undo nei Reels e nella Roulette, banner di riconnessione Spotify) sono tracciate in |
| [`04_STATUS_AND_OPEN_QUESTIONS.md`](./04_STATUS_AND_OPEN_QUESTIONS.md).                                                 |
