# 08 · Self-hosting su un server di casa (Docker, CasaOS, Tailscale)

Guida passo passo per far girare **tutto** OpenMusic (database, Redis, API, sito) su un computer
di casa, per esempio un portatile Intel con 8 GB di RAM e CasaOS, e aprirlo dal telefono o da fuori
casa con **Tailscale**. Le scelte tecniche sono nell'ADR-016
([`decisioni_chiuse_adr_e_roadmap_di_sviluppo.md`](./decisioni_chiuse_adr_e_roadmap_di_sviluppo.md)).
Render ([`07_DEPLOY.md`](./07_DEPLOY.md)) resta l'alternativa online: non cambia nulla lì (§14).

> **Stato:** immagini, stack e suite Playwright verificati davvero in una sandbox con Docker 29
> (§13). **Non** verificati: Tailscale (Serve/Funnel non raggiungibili dalla sandbox), l'import
> dall'interfaccia di CasaOS, la pubblicazione delle immagini su GHCR da GitHub Actions, un build
> su arm64.

## 1. Come è fatto

```text
browser / Expo Go ── https://<macchina>.<tailnet>.ts.net ──▶ Tailscale (Serve o Funnel)
                                                               │  http://127.0.0.1:8380
                                                               ▼
                                         caddy (unico ingresso, porta 8380 dell'host)
                       /socket.io/*, /health │                 │ tutto il resto (anche /api/*)
                                             ▼                 ▼
                                    api:4000 (Fastify,   web:3000 (Next.js; /api/* inoltrato
                                    Socket.io, poller)        lato server a api:4000)
                                             │
                                  postgres:5432 + redis:6379 (solo rete interna, nessuna porta)
```

Sito, API e socket hanno **un solo indirizzo** (`PUBLIC_URL`): i cookie di sessione sono di prima
parte, non servono CORS né domini separati, e il token del socket (`GET /api/auth/socket-token`)
indica come URL quello stesso indirizzo. Nessuna modifica al codice: è tutta configurazione
(`PUBLIC_API_URL = WEB_APP_URL = CORS_ORIGIN = PUBLIC_URL`).

| Container   | Immagine                                   | Limite RAM | Note                                |
| ----------- | ------------------------------------------ | ---------- | ----------------------------------- |
| `postgres`  | `postgres:16.15-alpine`                    | 512 MB     | Volume `postgres_data`              |
| `redis`     | `redis:7.4.11-alpine`                      | 128 MB     | AOF su disco, volume `redis_data`   |
| `api`       | `ghcr.io/francospagnati/openmusic-api`     | 512 MB     | Migrazioni all'avvio, poi l'API     |
| `web`       | `ghcr.io/francospagnati/openmusic-web`     | 512 MB     | Next.js standalone                  |
| `caddy`     | `caddy:2.11.7-alpine`                      | 64 MB      | Unica porta pubblicata (8380)       |
| `backup`    | `postgres:16.15-alpine` (profilo `backup`) | 128 MB     | `pg_dump` ogni notte in `./backups` |
| `tailscale` | `tailscale/tailscale:v1.104.2` (profilo)   | 128 MB     | Solo se non usi Tailscale sull'host |

File: [`deploy/selfhost/docker-compose.yml`](../deploy/selfhost/docker-compose.yml),
[`deploy/selfhost/.env.example`](../deploy/selfhost/.env.example),
[`deploy/selfhost/update.sh`](../deploy/selfhost/update.sh),
[`apps/api/Dockerfile`](../apps/api/Dockerfile), [`apps/web/Dockerfile`](../apps/web/Dockerfile).

## 2. Prerequisiti

- Linux x86_64 (amd64) con **Docker** e **Docker Compose ≥ 2.23.1** (CasaOS li installa già).
  Controlla con `docker compose version`.
- ~3 GB liberi su disco (immagini + database), meglio 5 se costruisci le immagini in casa (§4.2).
- **Tailscale** sul server (consigliato: dall'App Store di CasaOS o con lo script ufficiale) e
  sui dispositivi da cui apri l'app. Non serve aprire porte sul router.
- `git` e `openssl` (presenti su quasi tutte le distribuzioni).

Apri un terminale sul server (in CasaOS: icona **Terminal** nelle impostazioni, oppure `ssh`).

## 3. Scarica i file e prepara `.env`

```bash
git clone https://github.com/francoSpagnati/openmusic.git ~/openmusic
cd ~/openmusic/deploy/selfhost
cp .env.example .env
# tre segreti casuali (solo lettere e cifre: vanno anche dentro l'URL del database)
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
sed -i "s/^PROXY_SECRET=.*/PROXY_SECRET=$(openssl rand -hex 32)/" .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
chmod 600 .env
```

Se il repository è privato, `git clone` chiede le credenziali GitHub (usa un token, oppure copia
la cartella `deploy/selfhost` sul server con `scp`: per le immagini da GHCR bastano
`docker-compose.yml`, `.env.example` e `update.sh`).

Poi apri `.env` (`nano .env`) e imposta **l'indirizzo** con cui aprirai l'app:

| Modo                                   | `PUBLIC_URL`                          | `COOKIE_SECURE` |
| -------------------------------------- | ------------------------------------- | --------------- |
| Tailscale Serve o Funnel (consigliato) | `https://<macchina>.<tailnet>.ts.net` | `true`          |
| Solo rete di casa (§6.3)               | `http://<IP-LAN-del-server>:8380`     | `false`         |

Il nome esatto lo trovi dopo aver installato Tailscale (§6.1): lo stampa `tailscale serve status`,
ed è nella pagina **Machines** della console Tailscale. Si usa **un modo alla volta**: se cambi indirizzo,
cambia `PUBLIC_URL` e riavvia (`docker compose up -d`).

Facoltativi in `.env`: `DEMO_PASSWORD` (utenti di prova, come in `07_DEPLOY.md` §5), Spotify e
Last.fm (§7), `OPENMUSIC_PORT` se la 8380 è occupata, `OPENMUSIC_BIND=127.0.0.1` se non vuoi che
la LAN raggiunga la porta (Tailscale sull'host funziona lo stesso).

## 4. Primo avvio

### 4.1 Con le immagini già pronte (GHCR)

Ogni push su `main` costruisce e pubblica le immagini (`.github/workflows/images.yml`).

```bash
cd ~/openmusic/deploy/selfhost
# solo se il repository/pacchetto è PRIVATO: token GitHub "classic" con permesso read:packages
echo <TOKEN> | docker login ghcr.io -u <utente-github> --password-stdin
docker compose pull
docker compose up -d
```

Le immagini ereditano la visibilità del repository; se è pubblico, il login non serve (puoi
anche rendere pubblici solo i pacchetti: GitHub → Packages → `openmusic-api`/`openmusic-web` →
Package settings → Change visibility).

### 4.2 Oppure costruendole sul server

```bash
cd ~/openmusic/deploy/selfhost
docker compose build      # ~1-2 minuti, picco ~1,5 GB di RAM in più (§11)
docker compose up -d
```

Il build del web limita già l'heap di Node a 2 GB (`WEB_BUILD_MAX_OLD_SPACE_MB`): con 8 GB basta,
anche con gli altri servizi di CasaOS accesi.

### 4.3 Cosa succede e quanto ci mette

```bash
docker compose ps          # tutti "healthy" dopo 20-45 s
docker compose logs -f api # Ctrl+C per uscire
```

1. Postgres e Redis partono (pochi secondi).
2. L'API applica le migrazioni (`All migrations have been successfully applied`), poi si mette in
   ascolto e diventa `healthy` (~15-20 s).
3. Con `SEED_ON_START=true` importa in sottofondo i **46 dischi curati** da Deezer/iTunes:
   ~50 s, nei log `[first-deploy] curated albums imported`. Se il server non raggiunge
   internet vedrai `Deezer unreachable` e ci riprova al prossimo avvio: il sito funziona lo
   stesso.

Prova in locale sul server: `curl http://127.0.0.1:8380/health` → `{"status":"ok",...}`.

### 4.4 Con l'interfaccia di CasaOS (sperimentale)

CasaOS sa importare un file compose (**App Store → Custom Install** / icona **+** → **Install a
customized app** → **Import** → incolla `docker-compose.yml`). Il file contiene i metadati
`x-casaos` (titolo, porta 8380 del riquadro). **Non è stato provato** su un CasaOS vero e ci sono
due limiti noti: l'import non legge il tuo `.env` (le variabili `${...}` vanno sostituite a mano
nel testo o nei campi dell'interfaccia) e non può costruire immagini (`build:`). Per questo il modo
consigliato è il terminale (§4.1/4.2): i container avviati così compaiono comunque nella dashboard
di CasaOS.

## 5. Aprire l'app

Apri **sempre l'indirizzo scritto in `PUBLIC_URL`**: è quello a cui il sito collega il socket e a
cui Spotify/Last.fm rimandano.

- Con Tailscale: `https://<macchina>.<tailnet>.ts.net` da qualunque dispositivo del tailnet (§6.1).
- In modalità LAN: `http://<IP-LAN>:8380` da casa (§6.3).

`http://127.0.0.1:8380/health` sul server serve solo come controllo rapido.

Registrati con **Crea account**. Per provare chat e presenza live serve un secondo utente (un'altra
finestra anonima o un altro dispositivo).

## 6. Tailscale

### 6.1 Serve: privato sul tuo tailnet (consigliato)

Solo i dispositivi del tuo tailnet (i tuoi, e gli amici che inviti nel tailnet o con cui
**condividi** la macchina) possono aprire l'app; dagli altri l'indirizzo non risponde. Tailscale
fornisce il certificato HTTPS valido per `*.ts.net`.

1. Installa Tailscale sul server: dall'App Store di CasaOS, oppure
   `curl -fsSL https://tailscale.com/install.sh | sh` e poi `sudo tailscale up` (apri il link
   per accedere).
2. Nella console Tailscale (<https://login.tailscale.com/admin/dns>) attiva **MagicDNS** e
   **HTTPS Certificates** (se non lo fai, il comando del punto 3 te lo chiede con un link).
3. Pubblica la porta di Caddy sul tailnet, in HTTPS sulla 443, in background (resta attivo anche
   dopo un riavvio):

   ```bash
   sudo tailscale serve --bg --https=443 http://127.0.0.1:8380
   tailscale serve status          # mostra https://<macchina>.<tailnet>.ts.net
   ```

4. In `.env`: `PUBLIC_URL=https://<macchina>.<tailnet>.ts.net` e `COOKIE_SECURE=true`, poi
   `docker compose up -d`.
5. Sul telefono/PC: installa Tailscale, accedi con lo stesso account (o accetta l'invito), apri
   l'indirizzo.

Per spegnerlo: `sudo tailscale serve --https=443 off` (oppure `sudo tailscale serve reset` per
togliere tutte le configurazioni Serve).

**Tailscale come app di CasaOS:** gira in un container con rete dell'host; gli stessi comandi
vanno lanciati dentro il container, per esempio
`docker exec -it <nome-container-tailscale> tailscale serve --bg --https=443 http://127.0.0.1:8380`
(il nome lo vedi con `docker ps`).

### 6.2 Funnel: pubblico su internet

Funnel rende lo stesso indirizzo raggiungibile **da chiunque** su internet (utile per amici senza
Tailscale). Richiede che il tuo policy file abbia l'attributo `funnel` (la prima volta il comando
mostra il link per abilitarlo) e usa solo le porte 443, 8443 o 10000.

```bash
sudo tailscale serve --https=443 off           # se prima usavi Serve sulla stessa porta
sudo tailscale funnel --bg --https=443 http://127.0.0.1:8380
tailscale funnel status
# per chiuderlo:
sudo tailscale funnel --https=443 off
```

`PUBLIC_URL` resta lo stesso `https://<macchina>.<tailnet>.ts.net`. Con Funnel l'app è esposta a
internet: registrazioni aperte a tutti, limite di 10 tentativi di login al minuto per IP, nessun
captcha. Tienilo acceso solo quando serve, e aggiorna spesso (§8).

### 6.3 Solo rete di casa (senza Tailscale)

`PUBLIC_URL=http://<IP-LAN>:8380` (IP fisso o prenotato nel router) e **`COOKIE_SECURE=false`**:
su http i browser scartano i cookie `Secure`, quindi senza questa impostazione il login non
resta attivo. Limiti e rischi:

- il cookie di sessione viaggia **in chiaro** sulla rete di casa: chi è sul tuo Wi-Fi e intercetta
  il traffico può rubare la sessione. Accettabile solo su una rete fidata, mai su Wi-Fi pubblici;
- **niente Spotify**: accetta redirect URI solo `https` (o loopback `127.0.0.1`);
- l'app funziona solo da casa (Expo Go compreso, con `EXPO_PUBLIC_API_URL=http://<IP-LAN>:8380`).

### 6.4 Variante: Tailscale in un container (profilo `tailscale`)

Se non vuoi installare Tailscale sull'host, lo stack ha un container Tailscale che fa da Serve (o
Funnel) davanti a Caddy, come una macchina a sé nel tailnet:

1. Crea una auth key in <https://login.tailscale.com/admin/settings/keys> (serve solo al primo
   accesso: lo stato resta nel volume `tailscale_state`).
2. In `.env`: `TS_AUTHKEY=tskey-auth-...`, `TS_HOSTNAME=openmusic`, `TS_FUNNEL=false` (o `true`
   per Funnel), `PUBLIC_URL=https://openmusic.<tailnet>.ts.net`, `COOKIE_SECURE=true`. Puoi
   mettere `OPENMUSIC_BIND=127.0.0.1`.
3. `docker compose --profile tailscale up -d`.

La configurazione Serve è nel compose (`configs.tailscale_serve`): HTTPS sulla 443 →
`http://caddy:80`; `${TS_CERT_DOMAIN}` lo riempie il container con il suo nome `*.ts.net`. Per
Funnel serve comunque l'attributo `funnel` nel policy file per quel nodo.

### 6.5 IP reali e rate limit

Caddy accetta `X-Forwarded-For` solo da `TRUSTED_PROXIES` (di default le reti Docker
`172.16.0.0/12` e il loopback, cioè `tailscaled` sull'host o il container Tailscale): così il
limite di login per IP vede, se Tailscale lo inoltra, l'IP del dispositivo e non quello del
server. Se l'IP non arriva, tutti gli utenti che passano da Tailscale condividono il limite (10
tentativi al minuto): per un gruppo di amici basta; altrimenti alza `AUTH_RATE_LIMIT_MAX`.

## 7. Spotify e Last.fm (facoltativo)

Funzionano con l'indirizzo **https** di Tailscale (Serve o Funnel): sono redirect del browser,
quindi basta che il dispositivo che stai usando apra l'app.

- **Spotify** (<https://developer.spotify.com/dashboard>, app → **Edit settings** → Redirect
  URIs): aggiungi esattamente
  `https://<macchina>.<tailnet>.ts.net/api/auth/spotify/callback`. Spotify accetta qualunque
  dominio https (anche `*.ts.net`). In Development Mode aggiungi la tua email Spotify in **User
  Management**. Copia Client ID e secret in `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`.
- **Last.fm** (<https://www.last.fm/api/account/create>): Callback URL
  `https://<macchina>.<tailnet>.ts.net/api/auth/lastfm/callback`, poi `LASTFM_API_KEY` /
  `LASTFM_SHARED_SECRET`.

Poi `docker compose up -d` (ricrea l'API con le nuove variabili) e sul sito **Impostazioni →
Collega Spotify / Last.fm**. La lettura automatica di "cosa stai ascoltando" gira sul server
(ADR-013) anche quando nessuno ha l'app aperta.

## 8. App mobile (Expo Go)

L'app mobile parla con lo stesso indirizzo (HTTP su `/api/*`, socket su `/socket.io`):

```bash
# sul computer di sviluppo, apps/mobile/.env
EXPO_PUBLIC_API_URL=https://<macchina>.<tailnet>.ts.net
npm run dev:mobile
```

Il **telefono deve avere Tailscale attivo** sullo stesso tailnet (con Funnel no). Metro (il
bundler di Expo) gira sul computer di sviluppo come sempre: è un collegamento separato.

## 9. Aggiornamenti

```bash
cd ~/openmusic/deploy/selfhost
./update.sh             # backup, docker compose pull, up -d, pulizia immagini vecchie
# se costruisci in casa:
git -C ~/openmusic pull && ./update.sh --build
```

Equivale a `docker compose pull && docker compose up -d` preceduto da un backup. Le migrazioni
nuove si applicano da sole all'avvio dell'API. Per fissare una versione: `OPENMUSIC_TAG=sha-<7
caratteri del commit>` in `.env`. Tornare indietro: rimetti il tag precedente e `docker compose up
-d` (attenzione: una migrazione già applicata non si annulla, in quel caso ripristina il backup).

**Watchtower** (aggiornamento automatico) è volutamente escluso: il progetto
`containrrr/watchtower` è archiviato e con Docker 29 la versione 1.7.1 va in errore
(`client version 1.25 is too old`, verificato) a meno di impostare `DOCKER_API_VERSION=1.44`;
inoltre aggiornerebbe i container senza backup. Se vuoi l'automatismo, metti `./update.sh` in un
cron settimanale (`crontab -e` → `0 4 * * 1 /home/<utente>/openmusic/deploy/selfhost/update.sh`).

## 10. Backup e ripristino

Backup automatico ogni notte (03:30, ora `TZ`), conservati 14 giorni in `deploy/selfhost/backups`:

```bash
docker compose --profile backup up -d                # avvia anche il container di backup
docker compose --profile backup run --rm backup now  # backup immediato
ls -lh backups/                                      # openmusic-AAAAMMGG-hhmmss.dump
```

Copia ogni tanto la cartella `backups/` fuori dal portatile (disco esterno, altro PC): un backup
sullo stesso disco non protegge da un guasto del disco. Formato: `pg_dump --format=custom`.

**Ripristino** (sostituisce TUTTI i dati con quelli del backup):

```bash
cd ~/openmusic/deploy/selfhost
docker compose stop api web
docker compose exec -T postgres pg_restore -U openmusic -d openmusic \
  --clean --if-exists --no-owner < backups/openmusic-AAAAMMGG-hhmmss.dump
docker compose start api web
```

Per controllare un backup senza toccare i dati: ripristinalo in un database di prova.

```bash
docker compose exec -T postgres createdb -U openmusic prova
docker compose exec -T postgres pg_restore -U openmusic -d prova --no-owner < backups/<file>.dump
docker compose exec -T postgres psql -U openmusic -d prova -c 'select count(*) from "User"'
docker compose exec -T postgres dropdb -U openmusic prova
```

Redis non va salvato: contiene presenza, cache e calendario delle letture, che l'API ricostruisce.

## 11. Risorse (misurate)

Misure nella sandbox di verifica (4 vCPU, Docker 29, `docker stats`):

| Container  | A riposo    | Durante la suite e2e | Sotto carico (3000 richieste, 25 in parallelo) |
| ---------- | ----------- | -------------------- | ---------------------------------------------- |
| api        | ~70 MB      | 69 MB                | 90 MB, CPU ~100%                               |
| web        | ~64 MB      | 79 MB                | 219 MB, CPU ~150%                              |
| postgres   | ~54 MB      | 54 MB                | 68 MB                                          |
| redis      | ~4 MB       | 5 MB                 | 4 MB                                           |
| caddy      | ~16 MB      | 16 MB                | 20 MB                                          |
| **Totale** | **~210 MB** | **~225 MB**          | **~400 MB** (135 richieste/s, nessun errore)   |

I limiti (512/512/512/128/64 MB, ~1,7 GB in tutto) lasciano margine sugli 8 GB anche con altri
servizi; l'heap di Node è limitato a 320 MB (`API_MAX_OLD_SPACE_MB`, `WEB_MAX_OLD_SPACE_MB`).

Immagini: `openmusic-api` 459 MB su disco (115 MB da scaricare), `openmusic-web` 300 MB (75 MB).
Build sul server da zero, i due in parallelo (§4.2): API 32 s, web 57 s, picco di RAM usata
**+1,45 GB** rispetto a prima del build.

## 12. Problemi frequenti

| Sintomo                                                                  | Causa probabile e rimedio                                                                                                                                                           |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set JWT_SECRET in .env` (o PROXY_SECRET, POSTGRES_PASSWORD, PUBLIC_URL) | Manca il valore in `.env`, o lanci `docker compose` da un'altra cartella: entra in `deploy/selfhost`.                                                                               |
| `docker compose pull`: `denied` / `unauthorized` su ghcr.io              | Repository privato: `docker login ghcr.io` con un token `read:packages` (§4.1), oppure costruisci in casa (§4.2).                                                                   |
| Login riuscito ma subito disconnesso                                     | `COOKIE_SECURE=true` su un indirizzo http: usa l'indirizzo https di Tailscale, oppure modalità LAN con `COOKIE_SECURE=false` (§6.3). `PUBLIC_URL` deve essere l'indirizzo che apri. |
| "Il live degli amici non è raggiungibile ora"                            | Il socket va a `PUBLIC_URL`: se apri l'app da un indirizzo diverso non si connette. Allinea `PUBLIC_URL` e riavvia.                                                                 |
| `api` non diventa healthy, `P1000 Authentication failed`                 | Hai cambiato `POSTGRES_PASSWORD` dopo il primo avvio: rimetti quella vecchia, oppure `docker compose exec postgres psql -U openmusic -c "ALTER USER openmusic PASSWORD '<nuova>'"`. |
| `Bind for 0.0.0.0:8380 failed: port is already allocated`                | Porta occupata da un'altra app di CasaOS: cambia `OPENMUSIC_PORT` (e la porta in `tailscale serve`).                                                                                |
| Esplora vuota, nei log `Deezer unreachable`                              | Il server non esce su internet (DNS, firewall): ci riprova a ogni avvio (`docker compose restart api`).                                                                             |
| `tailscale serve`: `HTTPS not enabled`                                   | Attiva HTTPS Certificates e MagicDNS nella console (§6.1).                                                                                                                          |
| Spotify: `INVALID_CLIENT: Invalid redirect URI`                          | Il redirect registrato non è identico a `<PUBLIC_URL>/api/auth/spotify/callback` (https, niente slash finale).                                                                      |
| Il build sul server viene ucciso (`Killed`, exit 137)                    | Poca RAM libera: chiudi altri servizi o `docker compose build --build-arg WEB_BUILD_MAX_OLD_SPACE_MB=1536`; meglio ancora usa le immagini di GHCR.                                  |
| Vedere i log                                                             | `docker compose logs -f api` (o `web`, `caddy`, `postgres`); i log ruotano a 3 × 10 MB per container.                                                                               |

## 13. Come è stato verificato

In una sandbox amd64 con Docker 29.9 e Compose 5.6 (che però non risolve i DNS esterni dai
container e passa da un proxy: per il build è stata usata un'immagine base con il certificato del
proxy, `--build-arg NODE_IMAGE=...`, i Dockerfile sono quelli del repository):

1. `docker build` di entrambe le immagini, da zero e in parallelo (tempi e RAM al §11).
2. `docker compose up -d` con volumi nuovi e valori di `.env.example`: tutti `healthy` in ~40 s,
   7 migrazioni applicate, import dei dischi curati **tentato** e fallito con
   `ENOTFOUND api.deezer.com` (nessun DNS esterno nei container della sandbox) e quindi
   rimandato, come previsto. Lo stesso container API, avviato a parte con rete dell'host e proxy,
   ha importato **45 dischi su 46** (1 non trovato) in ~50 s.
3. Suite Playwright completa (20 test: registrazione, login, feed, recensione, chat, presenza e
   chat live sul socket tra due browser, cookie di prima parte, giro dello stato OAuth) contro
   Caddy, con il file di verifica [`compose.e2e.yml`](../deploy/selfhost/compose.e2e.yml):

   ```bash
   cd deploy/selfhost
   docker compose -f docker-compose.yml -f compose.e2e.yml up -d
   cd ../.. && E2E_WEB_URL=http://127.0.0.1:8380 E2E_API_URL=http://127.0.0.1:8380 \
     DATABASE_URL="postgresql://openmusic:<POSTGRES_PASSWORD>@127.0.0.1:55432/openmusic" npm run e2e
   ```

4. `docker stats` durante la suite e sotto carico; `docker compose down` + `up -d`: utenti e
   recensioni ancora presenti, nessuna migrazione da applicare, seed non ripetuto; Redis con AOF.
5. Backup manuale e programmato (orario impostato al minuto dopo), cancellazione dei dump più
   vecchi di 14 giorni, ripristino in un database di prova (stessi utenti e migrazioni).
6. Container Tailscale: avvio e configurazione Serve generata correttamente (`${TS_CERT_DOMAIN}`
   intatto per il container); il login al control plane non era raggiungibile.

Non verificato: Tailscale Serve/Funnel reali, certificati `ts.net`, Spotify/Last.fm con quel
dominio, l'import da CasaOS, l'Action che pubblica su GHCR, `update.sh` contro GHCR, arm64.

## 14. Passare a Render più tardi

Self-hosting e Render usano lo stesso codice; `render.yaml` e `07_DEPLOY.md` restano validi.

1. Crea il Blueprint come in `07_DEPLOY.md`.
2. Per portare i dati: fai un backup (§10), poi in Render → `openmusic-db` → **Access Control**
   aggiungi temporaneamente il tuo IP e ripristina con l'**External Database URL**:
   `pg_restore --clean --if-exists --no-owner -d "<External Database URL>" backups/<file>.dump`
   (da un PC con `pg_restore` 16, o con `docker run --rm -i postgres:16.15-alpine pg_restore ...`).
   Poi togli l'IP (alla prossima sincronizzazione del Blueprint `ipAllowList: []` lo rimette).
3. Aggiorna i redirect URI di Spotify/Last.fm all'URL di `openmusic-web` e `EXPO_PUBLIC_API_URL`
   all'URL dell'API Render.
4. Spegni il server di casa: `docker compose down` (i volumi restano finché non usi `-v`).

Nota: i `JWT_SECRET` sono diversi, quindi tutti dovranno rifare il login.

## 15. Fonti

Consultate a ottobre 2026 (la sandbox non raggiungeva `tailscale.com`: i dettagli Tailscale vengono
da ricerche web sulle pagine ufficiali; ricontrollali sulla tua versione con `tailscale serve
--help`).

- Tailscale Serve (CLI, `--bg`, `off`, header di identità): <https://tailscale.com/kb/1242/tailscale-serve>,
  <https://tailscale.com/kb/1312/serve>
- Tailscale Funnel (attributo `funnel`, porte 443/8443/10000): <https://tailscale.com/kb/1311/tailscale-funnel>,
  <https://tailscale.com/kb/1223/funnel>
- Tailscale in Docker (`TS_AUTHKEY`, `TS_STATE_DIR`, `TS_USERSPACE`, `TS_SERVE_CONFIG`,
  `${TS_CERT_DOMAIN}`): <https://tailscale.com/kb/1282/docker>,
  <https://tailscale.com/blog/docker-tailscale-guide>,
  <https://pkg.go.dev/tailscale.com/cmd/containerboot>
- Formato `x-casaos`: app ufficiali in <https://github.com/IceWhaleTech/CasaOS-AppStore> (es.
  `Apps/Jellyfin/docker-compose.yml`)
- Caddy `reverse_proxy` e `trusted_proxies`: <https://caddyserver.com/docs/caddyfile/directives/reverse_proxy>,
  <https://caddyserver.com/docs/caddyfile/options#trusted-proxies>
- Next.js `output: 'standalone'`: <https://nextjs.org/docs/app/api-reference/config/next-config-js/output>
- GHCR e `GITHUB_TOKEN`: <https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry>
- Spotify redirect URI (https o loopback): <https://developer.spotify.com/documentation/web-api/concepts/redirect_uri>
