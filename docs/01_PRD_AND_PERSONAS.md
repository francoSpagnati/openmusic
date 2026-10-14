# 📋 Product Requirements Document (PRD), Personas & User Stories

## 1. Visione e Filosofia dell'Ambiente
OpenMusic nasce come un **"Third Place" digitale sereno** per chi ama la musica. A differenza dei social generalisti basati sull'engagement rabbioso, OpenMusic mette al centro la passione musicale, la scoperta genuina e la connessione tra amici attraverso ciò che si ascolta.

### Pilastri Funzionali:
1. **Live Listening & Presenza:** Sapere in ogni momento cosa stanno ascoltando gli amici, cosa hanno ascoltato di recente e cosa sta piacendo loro nell'ultimo periodo.
2. **Recensioni e Rating (Modello RYM / Rotten Tomatoes):** Recensire canzoni e album con un doppio indicatore:
   - **Voto del Pubblico (Attivo in MVP):** Basato sulle valutazioni della community.
   - **Voto della Critica (Fase successiva):** Basato sulle recensioni di giornalisti musicali, critici e webzine accreditate.
3. **Condivisione e Playlist Tematiche:** Condividere brani del momento, creare playlist collaborative o tematiche (es. *"Pioggia a Pisa in autunno"*) esportabili su qualsiasi piattaforma.
4. **Scoperta Musicale Attiva (Out-of-the-bubble):**
   - **Roulette Russa dei Generi:** Esplorazione casuale o semi-guidata di generi lontani dai propri ascolti abituali.
   - **Music Reels (Scroll Verticale):** Feed verticale rapido di canzoni e album con preview audio immediata di 30 secondi, copertina ad alta risoluzione e un estratto della miglior recensione.
5. **Messaggistica e Consigli Musicali:** Chat diretta pensata specificamente per inviare canzoni/album agli amici, con stato "Ascoltato / Non ancora ascoltato" e reazione rapida.
6. **Contenuti Video a Tema Musicale (Priorità Secondaria / Futuro):** Spazio per video-recensioni, approfondimenti o brevi clip musicali, mantenuto in secondo piano rispetto all'esperienza core di ascolto e recensione.

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
- **Comportamento:** Ascolta musica costantemente mentre studia o lavora. Usa Spotify su desktop e Android. Legge recensioni musicali e ama catalogare i dischi ascoltati.
- **Bisogni:** Vuole un profilo che rifletta la sua identità musicale, scrivere recensioni ben formattate e scoprire generi di nicchia tramite la Roulette.
- **Pain Point:** Su Instagram o WhatsApp i consigli musicali si perdono nel caos delle chat; RYM non ha un'app mobile fluida e social.

### Persona 2: Sofia, "L'Esploratrice Connessa" (22 anni)
- **Comportamento:** Usa Apple Music su iPhone. Per lei la musica è condivisione quotidiana con il suo gruppo di amici (che però usano Spotify o YouTube Music).
- **Bisogni:** Vuole aprire l'app e vedere subito nella barra in alto chi dei suoi amici è online e cosa sta ascoltando, mandare un brano con un tap e scorrere i "Music Reels" quando non sa cosa mettere su.
- **Pain Point:** Condividere link tra Apple Music e Spotify è scomodo; gli algoritmi di raccomandazione le propongono sempre le stesse 20 canzoni.

### Persona 3: Lorenzo, "Il Critico / Redattore Webzine" (29 anni - Target Fase 2)
- **Comportamento:** Scrive per una testata musicale indipendente.
- **Bisogni:** Avere un badge verificato "Critica", pubblicare estratti delle sue recensioni con link all'articolo originale e contribuire al *Critic Score* degli album.

---

## 4. User Stories Principali (Suddivise per Epiche)

### Epica 1: Stato Live & Notifiche ("Now Playing")
- **US-1.1:** Come utente, voglio vedere nella parte superiore dell'app una barra compatta sempre presente con gli avatar dei miei amici online e il brano che stanno ascoltando in tempo reale.
- **US-1.2:** Come utente mobile, voglio poter avere una notifica persistente / Live Activity nello spazio notifiche del telefono che riassume chi dei miei amici sta ascoltando musica in quel momento.
- **US-1.3:** Come utente, voglio poter attivare la *Ghost Mode* con un tap per ascoltare musica privatamente senza che venga mostrata agli amici.

### Epica 2: Catalogo, Recensioni & Rating
- **US-2.1:** Come utente, voglio cercare qualsiasi canzone o album e visualizzarne la scheda con copertina, tracce, **Voto del Pubblico** (percentuale di gradimento + media) e recensioni degli amici in cima.
- **US-2.2:** Come utente, voglio assegnare un voto, scrivere una recensione e aggiungere dei tag d'atmosfera (es. *Notturno, Energico, Sperimentale*).
- **US-2.3:** Come utente, voglio avere sul mio profilo una sezione "Cosa mi sta piacendo ultimamente" (rotazione pesante della settimana/mese) e i miei "Preferiti di sempre".

### Epica 3: Discovery (Music Reels & Roulette)
- **US-3.1:** Come utente, voglio scorrere un feed verticale di brani/album con avvio immediato dell'anteprima audio di 30 secondi e animazioni fluide.
- **US-3.2:** Come utente, voglio attivare la "Roulette Russa dei generi" per ricevere un brano appartenente a un genere musicale che non ho mai ascoltato, potendolo salvare o scartare.

### Epica 4: Social, Playlist & Messaggistica
- **US-4.1:** Come utente, voglio inviare un brano a un amico in chat; il sistema deve permettere al mio amico di aprirlo direttamente nella *sua* app di musica preferita.
- **US-4.2:** Come utente, voglio creare una playlist tematica su OpenMusic e permettere a chiunque di esportarla con un click sul proprio account Spotify o Apple Music.