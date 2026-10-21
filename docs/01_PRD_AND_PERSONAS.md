# 01 · PRD, Personas e User Stories

> Documento di **prodotto**: descrive cosa vogliamo costruire, non cosa esiste già. Lo stato reale
> di ogni funzionalità è in [`04_STATUS_AND_OPEN_QUESTIONS.md`](./04_STATUS_AND_OPEN_QUESTIONS.md);
> le decisioni vincolanti sono negli [ADR](./decisioni_chiuse_adr_e_roadmap_di_sviluppo.md).
> Unifica i precedenti `01_PRD_AND_PERSONAS.md` e `prd_user_personas_e_user_stories.md`.

## 1. Visione e Filosofia dell'Ambiente

OpenMusic nasce come un **"Third Place" digitale sereno** per chi ama la musica. A differenza dei social generalisti basati sull'engagement polarizzante, OpenMusic mette al centro la passione musicale, la scoperta genuina e la connessione tra amici attraverso ciò che si ascolta.

### I 6 pilastri funzionali

1. **Live Listening & Presenza Continua:** Sapere in ogni momento chi dei propri amici è online, cosa sta ascoltando in tempo reale, cosa ha ascoltato di recente e cosa gli sta piacendo nell'ultimo periodo (_Heavy Rotation_), sia nella barra superiore dell'app sia nel centro notifiche/widget del telefono.
2. **Recensioni e Rating Duale (Modello RYM + Rotten Tomatoes):**
   - **Indice di Gradimento (%):** Percentuale di utenti che hanno valutato positivamente l'opera (voto $\ge 3.5$ stelle).
   - **Media Ponderata ($0.5 - 5.0$):** Media bayesiana precisa che premia chi ha effettivamente ascoltato il disco (_Ascolto Verificato_).
   - **Voto Pubblico vs Critica:** Lancio iniziale con il Voto del Pubblico e architettura già pronta per affiancare il Voto della Critica (giornalisti e webzine musicali).
3. **Ambiente Sereno by Design (Anti-Tossicità):** Nessuna guerra tra fandom nei commenti pubblici. Le recensioni ricevono apprezzamenti qualitativi e le discussioni avvengono tra amici reciproci o in chat diretta.
4. **Scoperta Musicale Attiva (Out-of-the-bubble):**
   - **Music Reels (Scroll Verticale):** Feed verticale rapido di canzoni e album con avvio istantaneo dell'anteprima audio di $30\text{ s}$, copertina ad alta definizione, testo/estratto recensione e salvataggio rapido.
   - **Roulette Russa dei Generi:** Motore di esplorazione che pesca generi musicali distanti dallo storico dell'utente per rompere la bolla algoritmica.
5. **Condivisione, Playlist Tematiche & Chat Musicale:** Creazione di playlist tematiche multipiattaforma e messaggistica progettata per consigliarsi brani con traduzione automatica del link (Spotify $\leftrightarrow$ Apple Music $\leftrightarrow$ YouTube Music/Deezer) tramite codice ISRC.
6. **Spazio Video Musicale (Fase Futura / Secondaria):** Supporto futuro per brevi video-recensioni o approfondimenti musicali, mantenuto subordinato all'esperienza primaria di ascolto e catalogazione.

---

## 2. Analisi Competitiva (Ispirazioni)

- **Discord:** Eccellente gestione della presenza live ("Sta ascoltando Spotify") tramite API e rilevamento di sistema.
- **RateYourMusic (RYM) / Album of The Year (AOTY):** Profondità di catalogazione e distinzione critica/pubblico, ma bisognosi di una UI moderna e mobile-first.
- **Rotten Tomatoes:** Chiarezza visiva immediata nel distinguere l'indice di gradimento generale dalla media numerica.
- **Letterboxd:** Eleganza del diario personale, recensioni degli amici messe in evidenza e piacere estetico nel collezionare opere.
- **Airbuds:** Immediatezza del widget social con gli ascolti degli amici.

---

## 3. User Personas

### Persona 1: Marco, "Il Curatore Appassionato" (25 anni)

- **Profilo:** Laureando/giovane professionista, ascolta oltre $35\text{ ore}$ di musica a settimana tra Spotify Desktop e Android. Ama leggere recensioni su RateYourMusic e Ondarock.
- **Obiettivi:** Costruire un diario storico dei propri ascolti, scrivere recensioni curate senza che vengano sommerse da troll, scoprire generi sperimentali tramite la Roulette.
- **Frustrazioni:** RYM non ha una vera app mobile moderna né funzioni social in tempo reale; i social tradizionali penalizzano i contenuti testuali e musicali.

### Persona 2: Sofia, "L'Esploratrice Social" (22 anni)

- **Profilo:** Usa Apple Music su iPhone. Vive la musica come legame quotidiano con i suoi 10 amici più stretti (che però usano Spotify e YouTube Music).
- **Obiettivi:** Sbirciare dalla tendina delle notifiche o dalla barra in alto cosa stanno ascoltando i suoi amici mentre studiano, mandare una canzone in chat con un tap e scorrere i _Music Reels_ per trovare musica fresca.
- **Frustrazioni:** Quando manda un link Apple Music sul gruppo WhatsApp, i suoi amici con Spotify non riescono ad aprirlo al volo; gli algoritmi le propongono sempre le stesse canzoni.

### Persona 3: Elena, "La Critica di Webzine" (29 anni - Target Fase 2)

- **Profilo:** Scrive recensioni per una rivista musicale indipendente.
- **Obiettivi:** Avere un profilo verificato `CRITIC`, pubblicare la sintesi delle proprie recensioni contribuendo al _Critic Score_ dell'album e rimandare i lettori interessati all'articolo completo.

---

## 4. User Stories e criteri di accettazione

### Epica 1: Stato Live & Notifiche ("Now Playing")

- **US-1.1 (Live Top Bar):** Come utente, voglio vedere nella parte superiore dell'app una barra sempre presente con gli amici online e il brano che stanno ascoltando.
  - _Criterio di accettazione:_ L'aggiornamento avviene in $< 2\text{ secondi}$ dalla ricezione dell'evento via WebSocket senza ricaricare la pagina.
- **US-1.2 (Notifica / Widget OS):** Come utente mobile, voglio un riepilogo rapido nello spazio notifiche (Android) o Lock Screen/Live Activity (iOS) che mostri chi dei miei amici sta ascoltando musica.
  - _Criterio di accettazione:_ Toccando un amico nella notifica/widget si apre direttamente la scheda del brano o la chat con quell'amico.
- **US-1.3 (Ghost Mode):** Come utente, voglio attivare o disattivare la _Ghost Mode_ con un solo tap dalla barra superiore.
  - _Criterio di accettazione:_ Quando attiva, il server interrompe immediatamente il broadcast WebSocket del mio stato di ascolto e mostra un'icona chiara che conferma la modalità privata.

### Epica 2: Catalogo, Recensioni & Rating

- **US-2.1 (Valutazione Ibrida):** Come utente, voglio valutare un album o una canzone da $0.5$ a $5.0$ stelle (anche con un drag continuo del dito) e opzionalmente aggiungere testo e _Vibe Tags_.
  - _Criterio di accettazione:_ Se ho ascoltato l'album tramite account collegato, la recensione mostra automaticamente il badge _"Ascolto Verificato"_.
- **US-2.2 (Heavy Rotation):** Come utente, voglio che il mio profilo mostri automaticamente "Cosa mi sta piacendo ultimamente" (calcolato sugli ascolti degli ultimi 7/30 giorni) oltre ai brani che scelgo di fissare manualmente.

### Epica 3: Discovery (Music Reels & Roulette)

- **US-3.1 (Music Reels):** Come utente, voglio scorrere verticalmente schede di brani/album con avvio istantaneo dell'anteprima audio di $30\text{ s}$.
  - _Criterio di accettazione:_ Il brano successivo $(i+1)$ e quello successivo ancora $(i+2)$ devono essere pre-caricati in memoria per garantire una latenza di riproduzione $< 150\text{ ms}$ allo swipe.
- **US-3.2 (Roulette dei Generi):** Come utente, voglio girare la "Roulette dei Generi" scegliendo il livello di azzardo (_Affine ai miei gusti_, _Territorio inesplorato_, _Caos totale_) per ascoltare subito un brano fuori dalla mia bolla.
  - _Criterio di accettazione:_ Presenza costante del tasto _Undo_ per recuperare un brano scartato per sbaglio.

### Epica 4: Chat Musicale & Traduzione Universale

- **US-4.1 (Invio e Conversione ISRC):** Come utente, voglio inviare una canzone in chat a un amico e permettergli di ascoltare l'anteprima in chat o aprirla nella sua app musicale preferita.
  - _Criterio di accettazione:_ Il messaggio include link universali risolti tramite ISRC (o metadati) per Spotify, Apple Music, Deezer e YouTube Music, così il destinatario apre il brano nel suo servizio.
