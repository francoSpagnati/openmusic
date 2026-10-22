# OpenMusic

Social network open-source dedicato alla musica: ascolti in tempo reale degli amici, recensioni con
voto del pubblico e della critica, scoperta fuori dalla propria bolla (Reels, Roulette dei generi) e
chat pensata per consigliarsi brani.

> **Stato:** web e API funzionano end-to-end su dati reali (account locali, feed, recensioni, chat,
> notifiche, presenza live). Il catalogo importa album, brani, copertine e anteprime da Deezer,
> iTunes, MusicBrainz e Cover Art Archive, ma finora è stato **verificato solo con fixture
> registrate**: le chiamate live non sono mai state eseguite (vedi [Catalogo musicale](#catalogo-musicale-esterno)).
> L'app mobile (Expo SDK 58) usa l'API reale, ma non è mai stata provata su dispositivo o in
> Expo Go. Dettagli in [`docs/04_STATUS_AND_OPEN_QUESTIONS.md`](./docs/04_STATUS_AND_OPEN_QUESTIONS.md).

## Monorepo

| Percorso          | Contenuto                                                                 |
| ----------------- | ------------------------------------------------------------------------- |
| `apps/api`        | Backend Fastify 4 + Socket.io + Redis (REST `/api/*`, WebSocket presenza) |
| `apps/web`        | Next.js 16.4 (App Router, React 19.3) + Tailwind, client API tipizzato    |
| `apps/mobile`     | Expo SDK 58 + expo-router, client API con Bearer (mai provato su device)  |
| `packages/db`     | Schema Prisma, migrazioni SQL, seed                                       |
| `packages/shared` | Contratti Zod + tipi condivisi, `THEME` (token di design)                 |

Turborepo + npm workspaces. TypeScript strict ovunque.

## Quickstart

### Prerequisiti

- Node.js **>= 22.13** (richiesto da Expo SDK 58 / React Native 0.88) e npm 10
- Docker + Docker Compose (oppure PostgreSQL 16 e Redis 7 installati in locale)

### 1. Dipendenze e servizi

```bash
npm install
docker compose up -d          # PostgreSQL 16 su :5432, Redis 7 su :6379
```

### 2. Variabili d'ambiente

Un solo `.env` alla radice, letto da API, web (via `next.config.mjs`) e script di test.

```bash
cp .env.example .env
cp .env.example packages/db/.env   # la CLI Prisma legge DATABASE_URL da qui
```

- `JWT_SECRET`: obbligatorio in produzione (>= 32 caratteri). In sviluppo, se vuoto, l'API genera
  una chiave effimera e le sessioni si azzerano a ogni riavvio. Per generarla:
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
- Spotify e Last.fm sono **facoltativi**: senza chiavi l'app funziona, solo il collegamento di
  quegli account non è disponibile.

### 3. Database

```bash
npm run db:generate          # client Prisma
npm run db:migrate:deploy    # applica le migrazioni in packages/db/prisma/migrations
npm run db:seed              # utenti, release, recensioni e post di esempio
                             # (+ cover e tracklist reali dei dischi del seed se Deezer risponde)
npm run catalog:import -- --file curated-albums.json   # opzionale: ~46 album reali (serve rete)
```

Senza accesso alla rete il seed funziona lo stesso (cover Unsplash, tracklist del seed); per
un seed del tutto offline: `CATALOG_SEED_IMPORT=false npm run db:seed` oppure
`npm run db:seed:offline`.

Tutti gli utenti del seed hanno password `openmusic-dev` (es. `francospagnati@openmusic.test`;
`admin@openmusic.test` ha ruolo `ADMIN`).

Per modificare lo schema: `npm run db:migrate` (crea una nuova migrazione con `prisma migrate dev`).

### 4. Avvio

```bash
npm run dev                  # API su http://localhost:4000 + web su http://localhost:3000
npm run dev:api              # solo API
npm run dev:web              # solo web
npm run dev:mobile           # Expo (vedi "App mobile" sotto)
```

### 5. Qualità e test

```bash
npm run lint                 # ESLint (api, db, shared, web)
npm run typecheck            # tsc --noEmit su tutti i pacchetti, mobile incluso
npm run format:check         # Prettier
npm run db:test:prepare      # crea/azzera il DB "openmusic_test" (mai il DB di sviluppo)
npm test                     # Vitest: shared (unit) + api (integrazione su Postgres/Redis reali)
```

I test dell'API usano il database `openmusic_test` e il DB logico Redis 15, derivati da
`DATABASE_URL`/`REDIS_URL` (sovrascrivibili con `TEST_DATABASE_URL`/`TEST_REDIS_URL`).

### 6. End-to-end (Playwright)

Richiede DB migrato **e** seedato, e una build del web:

```bash
npx turbo run build --filter=@openmusic/web
npx playwright install chromium   # solo la prima volta (o PLAYWRIGHT_CHROMIUM_PATH=...)
npm run e2e
```

Playwright avvia da solo API (`:4000`) e `next start` (`:3000`), oppure riusa server già attivi.
Il test registra un account `e2e-*@openmusic.test` che viene cancellato alla fine
(`E2E_KEEP_DATA=1` per conservarlo).

## Catalogo musicale esterno

Release, brani, artisti, copertine e anteprime da 30 s arrivano da database pubblici, **senza
chiavi API** (scelta e alternative: ADR-010; dettagli tecnici: [`docs/06`](./docs/06_API_AND_AUTH.md) §8).

| Provider          | Ruolo                                                        |
| ----------------- | ------------------------------------------------------------ |
| Deezer            | primario: ricerca, tracklist con ISRC, UPC, cover, anteprime |
| iTunes Search     | fallback di ricerca e anteprime, artwork                     |
| MusicBrainz       | arricchimento canonico (MBID, etichetta, generi), 1 req/s    |
| Cover Art Archive | copertina di riserva per MBID                                |

L'API importa i risultati nel database con UUID interni (gli id esterni sono colonne a parte) e
deduplica per id → UPC/ISRC → titolo + artista. Comandi:

```bash
npm run catalog:smoke        # chiamata live a ogni provider; exit 1 se uno fallisce (nessun mock)
npm run catalog:import -- --file curated-albums.json            # importa ~46 album curati
npm run catalog:import -- --file curated-albums.json --dry-run --limit 5
```

**Stato onesto:** provider, import e deduplica sono coperti da test su **fixture JSON registrate**
(`apps/api/test/fixtures/catalog`, sulla forma documentata delle API). Nell'ambiente in cui è
stato sviluppato le API esterne erano bloccate: `catalog:smoke` lì fallisce 6 controlli su 6.
Va eseguito su una macchina con rete prima di considerare il catalogo verificato.

### Domini di rete necessari

Se l'API gira dietro un firewall o un proxy con allowlist, servono in uscita (HTTPS, porta 443):

| Dominio                                                           | Chi lo usa       | Per cosa                             |
| ----------------------------------------------------------------- | ---------------- | ------------------------------------ |
| `api.deezer.com`                                                  | API              | ricerca, album, brani, ISRC          |
| `*.dzcdn.net` (`cdn-images.`, `e-cdns-images.`, `cdnt-preview.`…) | API, web, mobile | copertine e anteprime MP3 Deezer     |
| `itunes.apple.com`                                                | API              | ricerca e lookup iTunes              |
| `*.mzstatic.com` (`is1-ssl.` … `is5-ssl.`)                        | API, web, mobile | artwork iTunes                       |
| `audio-ssl.itunes.apple.com`                                      | web, mobile      | anteprime AAC iTunes                 |
| `musicbrainz.org`                                                 | API              | arricchimento (`/ws/2`)              |
| `coverartarchive.org`, `archive.org`, `*.archive.org`             | API, web, mobile | copertine di riserva (redirect a IA) |
| `images.unsplash.com`                                             | web, mobile      | cover e avatar del seed              |
| `fonts.googleapis.com`, `fonts.gstatic.com`                       | build web        | font (`next/font/google`)            |

Per disattivare del tutto le chiamate esterne (CI, sviluppo offline): `CATALOG_EXTERNAL_ENABLED=false`
(ricerca solo locale, nessuna anteprima, nessun import). Altre variabili: `MUSICBRAINZ_CONTACT`
(contatto nello User-Agent, obbligatorio per MusicBrainz), `ITUNES_COUNTRY` (default `IT`),
`CATALOG_SEED_IMPORT`.

## App mobile (Expo Go)

L'app in `apps/mobile` è basata su **Expo SDK 58** (React Native 0.88, React 19.3) con
expo-router; la scelta è motivata nell'ADR-011. Richiede Node >= 22.13 e, sul telefono, l'app
**Expo Go** aggiornata (supporta solo l'SDK più recente).

```bash
cp apps/mobile/.env.example apps/mobile/.env
# imposta EXPO_PUBLIC_API_URL: deve essere raggiungibile DAL TELEFONO
#   simulatore iOS sulla stessa macchina:  http://localhost:4000
#   emulatore Android:                     http://10.0.2.2:4000
#   telefono fisico con Expo Go:           http://<IP LAN del computer>:4000
npm run dev:api              # API su :4000 (telefono e computer sulla stessa rete Wi-Fi)
npm run dev:mobile           # expo start: scansiona il QR con Expo Go (Android) o la Fotocamera (iOS)
```

- `EXPO_PUBLIC_API_URL` viene inserita nel bundle da Metro all'avvio: dopo averla cambiata
  riavvia con `npx expo start -c`. Non metterci segreti.
- Su un telefono fisico `localhost` è il telefono stesso: usa l'IP LAN e verifica che il firewall
  del computer accetti connessioni sulla porta 4000. In alternativa `npx expo start --tunnel`
  per Metro (l'API deve comunque essere raggiungibile all'URL configurato).
- Login con gli utenti del seed (password `openmusic-dev`). Il collegamento Spotify/Last.fm è
  disponibile solo sul web.
- Senza accesso a `api.expo.dev` anteponi `EXPO_OFFLINE=1` ai comandi Expo.
- Controlli: `npm -w @openmusic/mobile run typecheck`, `npm -w @openmusic/mobile test`.

**Mai eseguita** su dispositivo, simulatore o Expo Go: finora solo typecheck, Jest ed
`expo export` dei bundle. Dettagli e struttura: [`apps/mobile/README.md`](./apps/mobile/README.md).

## Documentazione

- [CONTRIBUTING.md](./CONTRIBUTING.md): flusso di lavoro, comandi, convenzioni
- [AI_CONTEXT.md](./AI_CONTEXT.md): regole vincolanti per assistenti AI (e per umani)
- [docs/](./docs/README.md): indice completo (prodotto, design, architettura, API, stato, ADR)

## Licenza

Il progetto è pensato come open-source con licenza **MIT**, ma il file `LICENSE` non è ancora nel
repository: va aggiunto prima di accettare contributi esterni.
