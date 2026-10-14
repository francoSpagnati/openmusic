# 🎨 Design System, Filosofia "Anti-AI-Slop" ed Euristiche di Nielsen

## 1. Identità Visiva e Mood Generale
OpenMusic deve trasmettere la sensazione di entrare in un **negozio di dischi indipendente, accogliente e curato**, combinata con la reattività tecnica delle migliori app native moderne.

### Cosa significa "NO AI-SLOP" (Divieti Assoluti)
Molte web/mobile app generate con l'ausilio dell'AI soffrono di un'estetica standardizzata e senz'anima. In OpenMusic sono **banditi**:
- I gradienti neon viola/indaco/ciano (`#6366F1` -> `#EC4899`) su sfondo nero assoluto.
- Le card traslucide con finti bagliori cyberpunk privi di gerarchia tipografica.
- Le icone incoerenti o le illustrazioni vettoriali piatte aziendali ("Corporate Memphis").
- Le transizioni lente o macchinose che rallentano l'utente.

### Linee Guida Estetiche (Cosa fare)
- **Colori Materici e Dinamici:**
  - *Background Dark (Default):* Grigio Vinile Caldo (`#121214`), Superfici Card (`#1C1C1F`), Testo Primario Crema/Avorio (`#F3F0E6`), Testo Secondario (`#9E9B93`).
  - *Background Light:* Carta Editoriale (`#F7F4EB`), Superfici (`#EFECE2`), Testo Inchiostro (`#18181A`).
  - *Accenti Dinamici:* Quando si visualizza un album o il player di un amico, la scheda estrae il colore dominante della copertina dell'album (desaturato e bilanciato per garantire sempre contrasto WCAG AA).
- **Tipografia Editoriale:**
  - **Titoli Album e Recensioni:** Font con personalità editoriale (es. *Fraunces*, *Playfair Display* o un Grotesque deciso come *Cabinet Grotesk* / *Plus Jakarta Sans*).
  - **UI e Metadati:** Font ad altissima leggibilità (es. *Inter* o *Geist*) con numeri tabulari (`tabular-nums`) per durate dei brani e punteggi.
- **Animazioni e Fisica:**
  - Utilizzo di fisica a molla (*spring animations* con smorzamento naturale, senza rimbalzi eccessivi).
  - Micro-interazioni tattili: vinile o onda sonora che pulsa dolcemente per chi sta ascoltando in tempo reale, feedback aptico leggero su mobile quando si dà un voto o si salva un brano.

---

## 2. Mappatura Completa delle 10 Euristiche di Jakob Nielsen

Ogni schermata e componente di OpenMusic deve superare la verifica delle 10 euristiche di Nielsen:

### 1. Visibilità dello stato del sistema
- La **Live Friends Top Bar** mostra istantaneamente (tramite indicatore luminoso discreto e micro-equalizzatore animato) chi è online e chi sta riproducendo musica.
- L'utente vede sempre se il proprio *scrobbling* (collegamento a Spotify/Apple Music/OS) è attivo, in pausa o in modalità *Ghost*.

### 2. Corrispondenza tra sistema e mondo reale
- Utilizzo di concetti familiari agli amanti della musica: *Rotazione Pesante (Heavy Rotation)*, *Scaffale / Crate*, *Lato A / Lato B* per le playlist, recensioni impaginate come su una rivista musicale.
- Nessun messaggio tecnico esposto all'utente.

### 3. Controllo e libertà dell'utente
- **Ghost Mode a 1-tap:** L'utente può sospendere in qualsiasi istante la condivisione di ciò che sta ascoltando.
- **Undo immediato:** Nello scroll dei *Music Reels* o nella *Roulette*, se l'utente fa swipe per errore scartando una canzone, un pulsante "Annulla" permette di tornare subito al brano precedente.

### 4. Coerenza e standard
- Un tap sulla copertina apre sempre l'opera; un tap sul pulsante Play avvia sempre l'anteprima di 30s; una pressione prolungata (*long press*) su qualsiasi elemento musicale apre sempre lo stesso menu rapido (*Aggiungi in coda, Recensisci, Invia a un amico, Apri nella tua app musicale*).

### 5. Prevenzione degli errori
- Salvataggio automatico locale (*Draft Auto-save*) durante la scrittura di una recensione o la creazione di una playlist: se l'app viene chiusa accidentalmente, il lavoro non va perso.
- Conferma non invasiva prima di azioni distruttive (es. eliminazione di una recensione lunga o di una playlist).

### 6. Riconoscimento anziché ricordo
- Quando l'utente clicca su "Nuova Recensione" o "Consiglia un brano in chat", la schermata propone immediatamente gli **ultimi 10 brani/album ascoltati** e il **brano attualmente in riproduzione**, evitando di dover digitare il titolo a memoria.

### 7. Flessibilità ed efficienza d'uso
- **Traduzione Universale dei Link:** L'utente non deve preoccuparsi di quale app usi il suo amico. Condivide il brano su OpenMusic e chi lo riceve ha il bottone diretto per aprirlo nel proprio player predefinito.
- Scorciatoie rapide per utenti esperti (doppio tap per mettere tra i preferiti, swipe su una traccia per valutarla al volo).

### 8. Design estetico e minimalista
- Niente sovraccarico informativo nel feed: le card mostrano solo gli elementi essenziali. I crediti completi, la tracklist dettagliata e i grafici di distribuzione dei voti sono accessibili espandendo la scheda dell'album.

### 9. Aiuto nel riconoscere, diagnosticare e recuperare dagli errori
- Se un servizio esterno (es. API Spotify) disconnette il token o non risponde, l'app mantiene i dati in cache e mostra un avviso chiaro e azionabile: *"La sincronizzazione con Spotify richiede un nuovo accesso. Riconnetti ora"*.

### 10. Aiuto e documentazione
- Onboarding fluido e opzionale al primo accesso per configurare i propri account musicali e selezionare 5 generi o artisti del cuore, più brevi suggerimenti contestuali alla prima apertura della *Roulette*.