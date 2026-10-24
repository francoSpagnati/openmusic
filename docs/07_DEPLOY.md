# 07 · Deploy online su Render (piano gratuito)

Guida passo passo per mettere OpenMusic online e provarlo con il tuo account, senza spendere
nulla. Non serve saper usare un server: Render legge il file [`render.yaml`](../render.yaml) del
repository (un **Blueprint**) e crea tutto da solo. Le scelte tecniche sono spiegate nell'ADR-014
([`decisioni_chiuse_adr_e_roadmap_di_sviluppo.md`](./decisioni_chiuse_adr_e_roadmap_di_sviluppo.md)).

> Preferisci un server di casa (Docker, CasaOS, Tailscale)? Vedi [`08_SELF_HOSTING.md`](./08_SELF_HOSTING.md).

> **Stato:** il Blueprint non è mai stato eseguito su Render (chi l'ha scritto non aveva un account
> e la sandbox non raggiungeva `render.com`). È stato verificato in locale con gli stessi comandi
> di avvio, `NODE_ENV=production` e web e API su due siti diversi (§11). Se qualcosa non torna, la
> sezione [Problemi frequenti](#10-problemi-frequenti) copre i casi più probabili.

## 1. Cosa viene creato

| Risorsa (nome in Render) | Tipo                   | A cosa serve                                                        |
| ------------------------ | ---------------------- | ------------------------------------------------------------------- |
| `openmusic-web`          | Web service Node, free | Il sito (Next.js). Inoltra `/api/*` all'API                         |
| `openmusic-api`          | Web service Node, free | API Fastify + Socket.io (presenza live, chat) + lettura Spotify     |
| `openmusic-db`           | PostgreSQL 16, free    | Utenti, recensioni, catalogo, chat                                  |
| `openmusic-kv`           | Key Value, free        | Compatibile Redis: presenza "in ascolto", cache, calendario letture |

Tutto nella regione **Frankfurt** (la più vicina all'Italia).

Come parlano tra loro:

```text
browser ── https ──▶ openmusic-web ── /api/* (lato server) ──▶ openmusic-api ──▶ openmusic-db
browser ── wss (socket, token di 60 s) ──────────────────────▶ openmusic-api ──▶ openmusic-kv
Expo Go ── https (Bearer) ───────────────────────────────────▶ openmusic-api
```

Perché il web fa da tramite: `openmusic-web.onrender.com` e `openmusic-api.onrender.com` per il
browser sono **siti diversi** (`onrender.com` è un "suffisso pubblico", come `.it`), quindi il cookie
di accesso non passerebbe dall'uno all'altro. Passando tutto dal sito web, il cookie resta sul sito
web e funziona (dettagli: `06_API_AND_AUTH.md` §1).

## 2. Crea l'account Render

1. Vai su <https://dashboard.render.com/register> e scegli **GitHub** per registrarti: così Render
   vede già i tuoi repository.
2. Conferma l'email se te lo chiede.
3. Se il repository `openmusic` è **privato**, Render ti chiederà di installare la sua GitHub App
   e di dare accesso al repository (puoi scegliere "Only select repositories" → `openmusic`).

## 3. Crea il Blueprint

Hai due strade equivalenti:

- **Pulsante:** nel [`README`](../README.md) premi **Deploy to Render** (funziona se il repository è
  pubblico).
- **Dashboard:** in alto a destra **New** → **Blueprint** → scegli il repository `openmusic` →
  branch **`main`**.

Render mostra la pagina del Blueprint:

1. **Blueprint Name:** scrivi `openmusic` (è solo un'etichetta).
2. Controlla che compaiano le 4 risorse del §1, tutte con piano **Free**.
3. Render chiede i valori delle variabili marcate come facoltative (`sync: false`). **Lasciale tutte
   vuote** per la prima prova:

   | Variabile               | Servizio        | Cosa mettere                                                                                |
   | ----------------------- | --------------- | ------------------------------------------------------------------------------------------- |
   | `DEMO_PASSWORD`         | `openmusic-api` | Vuoto. Oppure una password lunga e privata (>= 12 caratteri) per avere utenti di prova (§5) |
   | `SPOTIFY_CLIENT_ID`     | `openmusic-api` | Vuoto (si aggiunge dopo, §6)                                                                |
   | `SPOTIFY_CLIENT_SECRET` | `openmusic-api` | Vuoto                                                                                       |
   | `LASTFM_API_KEY`        | `openmusic-api` | Vuoto (si aggiunge dopo, §6)                                                                |
   | `LASTFM_SHARED_SECRET`  | `openmusic-api` | Vuoto                                                                                       |

   Tutto il resto (database, Redis, segreti `JWT_SECRET` e `PROXY_SECRET`, URL tra i servizi) è già
   nel Blueprint e Render lo compila da solo. **Non** inventare valori per `JWT_SECRET`.

4. Premi **Deploy Blueprint** (o **Apply**).

### Quanto ci mette

- Database e Key Value: un paio di minuti.
- `openmusic-api` e `openmusic-web`: ognuno installa le dipendenze di tutto il monorepo (anche
  quelle dell'app mobile) e poi compila: **5–15 minuti** la prima volta, sul piano free.
- Al primo avvio l'API applica le migrazioni del database e poi, in sottofondo, importa i **~46
  dischi reali** del catalogo curato da Deezer/iTunes (2–5 minuti; il sito funziona già mentre lo
  fa). Nei log di `openmusic-api` vedrai `[first-deploy] curated albums imported`.

Quando tutti i servizi sono **Live** (pallino verde) hai finito.

## 4. Trova gli indirizzi, registrati, accedi

1. Nella dashboard apri `openmusic-web`: in alto c'è l'URL, di solito
   `https://openmusic-web.onrender.com`. Se il nome era già preso Render aggiunge un suffisso
   (`https://openmusic-web-xxxx.onrender.com`): **usa sempre quello mostrato lì**.
2. Allo stesso modo `openmusic-api` ha il suo URL (es. `https://openmusic-api.onrender.com`).
   Prova `https://<url-api>/health`: deve rispondere `{"status":"ok",...}`.
3. Apri l'URL del web, premi **Crea account**, inserisci email, username e una password di almeno
   10 caratteri. Sei dentro: il feed, **Esplora** (con i dischi reali), recensioni, chat e
   notifiche funzionano.
4. Per provare chat e presenza live serve un secondo utente: registrane un altro da una finestra
   anonima (o da un altro browser), seguitevi a vicenda e scrivetevi.

**Il primo accesso dopo una pausa è lento:** sul piano free i servizi si addormentano dopo 15
minuti senza visite e si risvegliano alla prima richiesta (circa un minuto, vedi §7). Se vedi
"Il server OpenMusic non risponde", aspetta e ricarica.

## 5. Utenti di prova (facoltativo)

Il seed di sviluppo ha una piccola comunità (6 utenti con recensioni, post, playlist e chat). Online
**non** viene creata finché non lo chiedi, così non esiste nessun account con una password nota:

1. Dashboard → `openmusic-api` → **Environment** → `DEMO_PASSWORD` → una password lunga che solo tu
   conosci (almeno 12 caratteri) → salva le modifiche (Render ridistribuisce il servizio).
2. Al riavvio l'API crea, **una volta sola**, gli utenti `francospagnati@openmusic.test`,
   `giulia.rossi`… e `admin@openmusic.test` (ruolo **ADMIN**), tutti con quella password, poi
   reimporta le copertine reali dei loro dischi.

Attenzione: chiunque conosca quella password entra come amministratore. Non usarla altrove.

## 6. Spotify e Last.fm (facoltativo)

L'app funziona anche senza. Servono solo per collegare l'account e vedere in automatico cosa stai
ascoltando. In produzione i callback passano dal **sito web** (non dall'API).

### Spotify

1. <https://developer.spotify.com/dashboard> → **Create app** (o apri quella che usi in locale).
2. In **Redirect URIs** aggiungi esattamente (con l'URL del **web** del §4):

   ```text
   https://openmusic-web.onrender.com/api/auth/spotify/callback
   ```

   Puoi tenere anche quello locale (`http://127.0.0.1:4000/api/auth/spotify/callback`).

3. **APIs used:** Web API. Salva.
4. **User Management:** in Development Mode solo gli utenti elencati qui (max 5) possono collegarsi:
   aggiungi la tua email Spotify.
5. Copia **Client ID** e **Client secret** in Render → `openmusic-api` → **Environment** →
   `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` → salva (l'API si riavvia).
6. Sul sito: **Impostazioni → Collega Spotify**.

### Last.fm

1. <https://www.last.fm/api/account/create>: come **Callback URL** metti

   ```text
   https://openmusic-web.onrender.com/api/auth/lastfm/callback
   ```

2. Copia **API key** e **Shared secret** in `LASTFM_API_KEY` / `LASTFM_SHARED_SECRET` di
   `openmusic-api` e salva.
3. Sul sito: **Impostazioni → Collega Last.fm**.

Non serve impostare `SPOTIFY_REDIRECT_URI` né `LASTFM_CALLBACK_URL`: l'API li ricava da
`WEB_APP_URL` (l'URL del web). Impostali solo se usi un dominio tuo.

## 7. Limiti del piano gratuito

Valori tratti dalla documentazione Render (§12); possono cambiare, controlla le pagine linkate.

- **Web service free:** 512 MB di RAM e 0,1 CPU; si **addormentano dopo 15 minuti** senza
  richieste e il risveglio richiede fino a circa un minuto. Il web e l'API dormono separatamente: il
  primo accesso può svegliarli entrambi. Il proxy del web aspetta l'API fino a 90 s.
- **750 ore di istanza free al mese** per workspace, condivise da tutti i servizi free: due servizi
  sempre accesi ne consumerebbero ~1.490. Con lo sleep (uso occasionale) non è un problema; se le
  ore finiscono, i servizi free restano sospesi fino al mese successivo.
- Mentre l'API dorme **non legge** Spotify/Last.fm (la lettura automatica riparte al risveglio).
- File system effimero: nulla di ciò che l'app scrive su disco sopravvive a un riavvio (OpenMusic
  tiene tutto in Postgres e Redis, quindi va bene).
- **Postgres free:** 1 GB, un solo database free per workspace, **nessun backup**. **Scade 30 giorni
  dopo la creazione**; poi c'è un periodo di grazia (14 giorni secondo la documentazione) per
  passare a un piano a pagamento, dopo il quale viene cancellato con tutti i dati. Per ricominciare
  gratis: cancella `openmusic-db` dalla dashboard e risincronizza il Blueprint (database nuovo e
  vuoto; i dischi curati si reimportano da soli, gli account vanno ricreati).
- **Key Value free:** 25 MB di memoria e ~50 connessioni, **nessuna persistenza su disco**: a ogni
  riavvio perde presenza, cache e calendario delle letture (l'API lo ricostruisce). Nessun accesso
  dall'esterno (`ipAllowList: []`).
- Niente **Shell** né **pre-deploy command** sui servizi free: per questo le migrazioni girano
  all'avvio dell'API e i dati iniziali li importa l'API stessa (`SEED_ON_START`).

## 8. Aggiornamenti

- Ogni **push o merge su `main`** fa ripartire build e deploy di `openmusic-api` e `openmusic-web`
  (`autoDeployTrigger: commit`). Un deploy che fallisce lascia online la versione precedente.
- Le migrazioni nuove si applicano da sole all'avvio dell'API (`prisma migrate deploy`).
- Se cambi `apps/api/data/curated-albums.json`, al deploy successivo l'API importa i dischi nuovi.
- Le modifiche a `render.yaml` vengono applicate quando Render sincronizza il Blueprint (dalla
  pagina del Blueprint: **Manual Sync** se non parte da sola).
- Deploy manuale: servizio → **Manual Deploy → Deploy latest commit**. Riavvio senza build:
  **Manual Deploy → Restart service** (se presente).

## 9. App mobile (Expo Go) contro l'API online

L'app mobile parla **direttamente** con l'API (non serve il web).

```bash
# apps/mobile/.env (vedi apps/mobile/.env.example)
EXPO_PUBLIC_API_URL=https://openmusic-api.onrender.com
```

poi `npm run dev:mobile` e apri il QR con Expo Go. Con l'API online non serve che telefono e
computer siano sulla stessa rete. L'app abbandona le richieste dopo 15 s: se l'API dorme, prima
apri `https://<url-api>/health` nel browser e aspetta la risposta.

## 10. Problemi frequenti

| Sintomo                                                             | Causa probabile e rimedio                                                                                                                                                                                             |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build fallita con `Cannot find module 'typescript'` / `tailwindcss` | Il comando di build deve essere `npm ci --include=dev ...` (con `NODE_ENV=production` npm salta le devDependencies). Ripristina quello di `render.yaml`.                                                              |
| `openmusic-api` fallisce all'avvio su `prisma migrate deploy`       | Il database non è ancora pronto o `DATABASE_URL` manca: attendi che `openmusic-db` sia **Available** e rifai **Manual Deploy**.                                                                                       |
| `Invalid environment configuration: JWT_SECRET ...`                 | Hai cancellato o accorciato `JWT_SECRET`. Rimettilo con **Generate** (>= 32 caratteri). Cambiarlo disconnette tutti.                                                                                                  |
| Sul sito "Il server OpenMusic non risponde"                         | L'API si sta svegliando (attendi un minuto e ricarica) o è ferma: guarda i **Logs** di `openmusic-api`. Controlla che `API_ORIGIN` di `openmusic-web` sia l'URL dell'API.                                             |
| Login riuscito ma subito disconnesso, o "Sessione scaduta"          | `COOKIE_SECURE` deve essere `true` (Render usa https) e `COOKIE_DOMAIN` **non** deve esistere.                                                                                                                        |
| Sotto le storie: "Il live degli amici non è raggiungibile ora"      | Il socket non si connette all'API. Nei log dell'API cerca errori; apri `https://<url-web>/api/auth/socket-token` da loggato: `url` deve essere l'URL dell'API. Se serve, imposta `PUBLIC_API_URL` su `openmusic-api`. |
| `WEB_APP_URL` / `CORS_ORIGIN` / `API_ORIGIN` / `PROXY_SECRET` vuoti | Render non ha risolto un riferimento tra servizi. Copiali a mano: `WEB_APP_URL` e `CORS_ORIGIN` = URL del web; `API_ORIGIN` = URL dell'API; `PROXY_SECRET` del web = quello dell'API.                                 |
| Spotify: `INVALID_CLIENT: Invalid redirect URI`                     | Il redirect URI registrato non è identico a `https://<url-web>/api/auth/spotify/callback` (https, nessuno slash finale, URL del **web**).                                                                             |
| Torni su Impostazioni con errore `FORBIDDEN` dopo Spotify/Last.fm   | Il cookie di stato è scaduto (10 minuti) o hai iniziato da un altro indirizzo: riprova dal sito web.                                                                                                                  |
| Spotify: errore `UPSTREAM_ERROR` subito dopo il consenso            | In Development Mode il tuo utente Spotify deve essere in **User Management** (§6); controlla anche Client ID e secret.                                                                                                |
| Esplora vuota o con pochi dischi                                    | L'import iniziale è ancora in corso o Deezer non rispondeva: nei log cerca `[first-deploy]`. Viene ritentato al prossimo avvio (**Manual Deploy**).                                                                   |
| "Troppi tentativi" al login                                         | Limite di 10 tentativi al minuto per IP: aspetta un minuto.                                                                                                                                                           |
| Servizi sospesi a fine mese                                         | Finite le 750 ore free del workspace (§7).                                                                                                                                                                            |

## 11. Come è stato verificato

In locale, senza Render, con la suite Playwright in modalità **cross-site**:

```bash
npx turbo run build --filter=@openmusic/web
E2E_PROFILE=cross-site npm run e2e
```

Web su `http://127.0.0.1:3000` e API su `http://localhost:4000` (per il browser sono siti diversi,
come due `*.onrender.com`), entrambi con `NODE_ENV=production` e avviati come in `render.yaml`
(`npm run start:api`, `npm run start:web`), cookie non `Secure` solo perché è http. La suite prova
registrazione, login, feed, recensione, chat, presenza e messaggi live sul socket tra due browser e
il giro del cookie di stato OAuth attraverso il proxy. Gira anche in CI (job `e2e`).

Non verificabile senza Render: la risoluzione dei riferimenti `fromService` (in particolare quelli
incrociati web ↔ API), i tempi reali di build e risveglio, il comportamento del proxy di Render
con `X-Forwarded-For`, la validazione ufficiale del Blueprint (`render blueprints validate` o lo
schema JSON).

## 12. Fonti

La sandbox in cui è stato scritto il Blueprint non raggiungeva `render.com`: i fatti sono stati
presi dalle **skill ufficiali di Render** per agenti
([github.com/render-oss/skills](https://github.com/render-oss/skills), commit `8675173`, 2026-10-08),
dagli esempi ufficiali e da riassunti di ricerca delle pagine qui sotto. Ricontrollale prima di
contare su un limite preciso.

- Blueprint (campi, `fromService`/`fromDatabase`, `envVarKey`, `generateValue`, `sync: false`,
  `autoDeployTrigger`, `ipAllowList` obbligatorio per Key Value): <https://render.com/docs/blueprint-spec>
- Schema JSON del Blueprint: <https://render.com/schema/render.yaml.json>
- Piano free (sleep dopo 15 minuti, 750 ore, Postgres che scade dopo 30 giorni, niente shell e
  pre-deploy sui free): <https://render.com/docs/free>
- Rete privata (i web service free possono avviare ma **non ricevere** traffico privato):
  <https://render.com/docs/private-network>
- Variabili d'ambiente e `RENDER_EXTERNAL_URL`: <https://render.com/docs/environment-variables>
- Key Value (Valkey 8, free senza persistenza, `maxmemoryPolicy`): <https://render.com/docs/key-value>
- WebSocket sui web service: <https://render.com/docs/websocket>
- Piani di calcolo: <https://render.com/docs/compute-plans>
- Pulsante Deploy to Render: <https://render.com/docs/deploy-to-render-button>
- Esempio ufficiale di `fromService.envVarKey: RENDER_EXTERNAL_URL`:
  <https://github.com/render-examples/blog-thumbnails-workflows/blob/main/render.yaml>
- `X-Forwarded-For` sul proxy di Render (accodato, non ripulito):
  <https://community.render.com/t/accessing-client-ips-in-a-node-express-app/36282>
