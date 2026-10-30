# Piano delle prossime funzionalità

Richieste del 30/10/2026, in ordine di sviluppo: dalla più semplice alla più complessa, e in modo
che ogni passo prepari il successivo. Una alla volta, ognuna con test, verifica sullo stack
self-hosted e PR.

| #   | Funzionalità                           | Dipende da | Stato      |
| --- | -------------------------------------- | ---------- | ---------- |
| 0   | Anteprime di 30 s che partono sempre   |            | In corso   |
| 1   | Play sul tuo riproduttore preferito    | 0          | Da fare    |
| 2   | Condivisione di un brano con un tocco  |            | Da fare    |
| 3   | Recensioni delle singole canzoni       |            | Da fare    |
| 4   | Home centrata su "In ascolto ora"      | 1, 2, 3    | Da fare    |
| 5   | Voti pesati per ascolti ed esperienza  | 3          | Da fare    |
| 6   | Feed "Per te"                          | 2, 3, 5    | Da fare    |

## 0. Anteprime che partono sempre (bug)

I link delle anteprime Deezer sono firmati e scadono circa 15 minuti dopo l'import (poi 403).
Nuovo endpoint `GET /api/catalog/tracks/:id/preview`: rinnova il link quando è scaduto (Deezer per
id, poi il resolver ISRC/titolo), lo tiene in cache fino alla scadenza e risponde con un redirect.
L'API restituisce quel percorso al posto dei link firmati; web e mobile lo usano così com'è.

## 1. Play sul riproduttore preferito

- **Impostazione nel profilo:** "Riproduttore preferito": Spotify, Apple Music, Deezer, YouTube
  Music oppure "Solo anteprima".
- **Spotify collegato (Premium):** Play avvia quel brano esatto sul dispositivo Spotify attivo
  (Spotify Connect, `PUT /me/player/play`), senza uscire da OpenMusic.
  - Serve il permesso `user-modify-playback-state`: chi ha già collegato Spotify lo ricollega una
    volta.
  - Se non c'è un dispositivo attivo, l'app apre Spotify sul brano (`spotify:track:<id>`).
- **Abbinamento al catalogo Spotify:** per codice ISRC (ricerca `isrc:`), poi titolo + artista.
  L'id trovato viene salvato.
- **Altri servizi:** link diretti all'app (Deezer per id; Apple Music e YouTube Music per ricerca).

## 2. Condivisione con un tocco

- Tasto "Condividi" su un brano: crea un post senza testo ("Franco sta condividendo…"), visibile
  agli amici e nel feed pubblico.
- Annullabile per qualche secondo; un solo post per lo stesso brano ogni 24 h per utente.

## 3. Recensioni delle singole canzoni

- Si recensisce un brano come un album: voto + testo facoltativo + vibe.
- La pagina dell'album mostra:
  - il voto dell'album (recensioni dell'album);
  - **"Media dei brani (pubblico)"**: media dei voti medi di ogni brano, calcolata solo sugli
    utenti, mai sui critici, con la copertura (es. "7 brani su 12").
- La pagina del brano mostra le sue recensioni.

## 4. Home centrata su "In ascolto ora"

- In cima alla home: il brano che stai ascoltando, in grande, con avanzamento in tempo reale.
- Azioni: **Recensisci**, **Condividi** (un tocco), **Ascolta** (riproduttore preferito).
- Se non stai ascoltando: l'ultimo brano ascoltato e gli amici in diretta.

## 5. Voti pesati

- Ogni recensione ha un peso tra 1,0 e 1,5. È una piccola spinta: nessun voto conta il doppio.
  - Fino a +0,15 per quanta musica ascolti (scala logaritmica: 10.000 ascolti non valgono 10 volte
    1.000).
  - Fino a +0,35 per l'esperienza nel genere dell'album: la quota dei tuoi ascolti in quel genere e
    da quanto tempo lo ascolti.
- Contano solo gli ascolti verificati (Spotify/Last.fm), non quelli inseriti a mano.
- In pagina si vedono la media semplice e la media pesata, con un "Perché?" che spiega il calcolo.
- Decisione da documentare in un ADR.

## 6. Feed "Per te"

- Accanto ad "Amici", una scheda "Per te".
  - Candidati: recensioni e condivisioni recenti con molti like, utenti molto seguiti, uscite
    popolari.
  - Ordinamento: interazioni con decadimento nel tempo, moltiplicate per la somiglianza con i tuoi
    gusti (generi e artisti dai tuoi ascolti).
  - Diversità: non più di 2 elementi di fila dallo stesso utente o artista.
- Prima versione calcolata al volo con una cache breve; niente modelli di machine learning.
- Decisione da documentare in un ADR.

## Ritocchi UI

Da raccogliere durante le prove. Per segnalarli: screenshot dal telefono, cerchio sull'elemento con
lo strumento di modifica della galleria, poi l'immagine incollata nella chat di Claude Code insieme
a una riga di descrizione.
