# 🎨 Design System, Filosofia "Anti-AI-Slop" ed Euristiche di Nielsen

## 1. Direzione Artistica: "Warm Editorial Vinyl"
L'interfaccia di OpenMusic rifiuta categoricamente l'estetica fredda, artificiale e generica tipica dei template generati dall'IA ("AI-Slop"). L'obiettivo è unire il **calore tattile di un negozio di dischi e di una rivista cartacea** (come *Apartamento* o *Pitchfork* nei suoi migliori layout editoriali) con la **fluidità tecnica di Discord e Letterboxd**.

### Tabella di Contrasto: AI-Slop (Vietato) vs OpenMusic (Obbligatorio)

| Elemento | ❌ AI-Slop (Vietato) | ✅ OpenMusic Design System |
| :--- | :--- | :--- |
| **Sfondo Dark** | Nero piatto `#000000` o blu notte `#0F172A` | Grigio Vinile Caldo `#121214` con superfici elevate `#1A1A1E` |
| **Sfondo Light** | Bianco accecante `#FFFFFF` | Carta Editoriale Calda `#F6F3EC` con card `#EDE9DF` |
| **Accenti** | Gradienti neon viola/ciano (`#8B5CF6` $\rightarrow$ `#06B6D4`) | Ambra Analogica `#E07A38`, Verde Salvia `#4A9E74` + **Colore Dinamico Album** |
| **Tipografia** | Solo font di sistema senza gerarchia né carattere | Abbinamento **Serif/Grotesque Editoriale** (Titoli) + **Sans Tecnico** (Dati) |
| **Ombre e Bordi** | Bagliori colorati sfocati (`box-shadow` neon) | Bordi sottili materici `1px solid rgba(255,255,255,0.07)` |
| **Copywriting** | Frasi robotiche (*"Esplora l'universo sonoro!"*) | Linguaggio umano, diretto e familiare (*"In rotazione tra i tuoi amici"*) |

### Token Cromatici Ufficiali (CSS / React Native Theme)
- `bg.primary`: `#121214` (Dark) / `#F6F3EC` (Light)
- `bg.elevated`: `#1A1A1E` (Dark) / `#EDE9DF` (Light)
- `bg.glass`: `rgba(26, 26, 30, 0.82)` con `backdrop-filter: blur(16px)`
- `text.primary`: `#F3F0E6` (Dark) / `#161618` (Light)
- `text.secondary`: `#9E9B93` (Dark) / `#5C5A54` (Light)
- `accent.primary`: `#E07A38` (Warm Amber - usato per stati attivi e stelle)
- `accent.live`: `#45B26B` (Analog Green - usato per il pallino "In ascolto ora")
- `score.fresh`: `#45B26B` (Gradimento pubblico $\ge 70\%$)
- `score.mixed`: `#D9A236` (Gradimento pubblico $45\% - 69\%$)

### Estrazione del Colore Dinamico (Ambient Tinting)
Quando si apre un album o si scorre un *Music Reel*, il sistema estrae il colore dominante della copertina $(R, G, B)$, lo converte nello spazio colore **HSL** e ne fissa la luminosità $L \in [18\%, 25\%]$ e la saturazione $S \le 45\%$ per lo sfondo della card. In questo modo ogni disco ha una propria atmosfera unica ma il testo rimane sempre perfettamente leggibile (contrasto WCAG AA $\ge 4.5:1$).

---

## 2. Specifiche di Animazione (60/120fps)
Per garantire che l'app mobile sia scattante ma "viva":
1. **Spring Physics Naturale:** Tutte le transizioni su React Native Reanimated usano una configurazione fisica sovra-smorzata (`mass: 0.8, damping: 18, stiffness: 180`), evitando rimbalzi gommosi innaturali.
2. **Micro-animazione "Vinile in Ascolto":** Nella `<LiveFriendsBar />`, gli amici che stanno ascoltando musica mostrano la copertina quadrata dell'album con il bordo di un disco in vinile che sporge di $6\text{ px}$ a destra e ruota dolcemente solo mentre il brano è in riproduzione (`isPlaying === true`).
3. **Feedback Aptico (Haptics):**
   - Scorrimento mezze stelle durante il voto: `Haptics.selectionAsync()` leggerissimo ad ogni scatto di $0.5$ stelle.
   - Salvataggio brano dai Reels o attivazione *Ghost Mode*: `Haptics.impactAsync(ImpactFeedbackStyle.Medium)`.

---

## 3. Verifica Rigorosa delle 10 Euristiche di Jakob Nielsen

| # | Euristica di Nielsen | Requisito di Implementazione in OpenMusic |
| :--- | :--- | :--- |
| **1** | **Visibilità dello stato del sistema** | La `<LiveFriendsBar />` mostra in tempo reale: (a) il tuo stato di sincronizzazione musicale (*Connesso a Spotify*, *In pausa*, o *Ghost Mode attiva*), (b) chi è online e il minuto esatto del brano che sta ascoltando tramite una sottile barra di avanzamento sotto la miniatura dell'album. |
| **2** | **Corrispondenza tra sistema e mondo reale** | La terminologia rispecchia la cultura musicale reale: *In rotazione*, *Diario degli ascolti*, *Scaffale*, *Lato A / Lato B*. Le stelle e le percentuali di gradimento sono immediatamente comprensibili senza legende complesse. |
| **3** | **Controllo e libertà dell'utente** | **1) Ghost Mode istantanea:** Un tap sul proprio avatar nella barra superiore nasconde subito l'ascolto live. **2) Pulsante Undo universale:** Nei *Music Reels* e nella *Roulette*, un bottone flottante permette sempre di tornare al brano appena scartato. |
| **4** | **Coerenza e standard** | In tutta l'app (Feed, Profilo, Chat, Reels): **Tap singolo** sulla cover = apre la scheda album; **Tap sul bottone Play** = avvia/ferma l'anteprima di $30\text{ s}$; **Long Press** = apre il menu rapido di condivisione/valutazione. |
| **5** | **Prevenzione degli errori** | **Auto-save locale delle bozze:** Mentre l'utente scrive una recensione su `MMKV` / `localStorage`, ogni battitura viene salvata localmente. Se il telefono si spegne o l'app crasha, riaprendo l'album la recensione è ancora lì. |
| **6** | **Riconoscimento anziché ricordo** | Aprendo il compositore di recensioni o il selettore per allegare un brano in chat, la vista mostra subito la griglia **"Ascoltati negli ultimi 60 minuti"** e **"In riproduzione ora"**, azzerando la necessità di digitare titoli a memoria. |
| **7** | **Flessibilità ed efficienza d'uso** | Gli utenti nuovi possono valutare aprendo la scheda album; gli utenti esperti possono fare **swipe laterale** su qualsiasi traccia nel proprio diario per assegnare rapidamente il voto o aggiungerla ai preferiti, e i link condivisi si aprono direttamente nel player predefinito dell'utente grazie alla traduzione ISRC. |
| **8** | **Design estetico e minimalista** | Nessun rumore visivo: i contatori secondari, i codici catalogo, le etichette discografiche e l'istogramma completo dei voti sono racchiusi in una sezione espandibile *"Dettagli e Crediti"* dentro la pagina dell'album, lasciando pulito il feed principale. |
| **9** | **Aiuto nel riconoscere e recuperare dagli errori** | Se l'API di Spotify o Apple Music revoca il token o va in timeout, non appare mai un errore bloccante o un codice HTTP `401/500`, ma un banner contestuale calmo: *"La connessione con Spotify si è interrotta. [Riconnetti con 1 tap]"*. |
| **10** | **Aiuto e documentazione** | All'ingresso nella *Roulette dei Generi* o alla prima configurazione della notifica persistente, un piccolo coachmark non modale spiega in 2 righe il funzionamento e sparisce per sempre una volta compreso. |