# OpenMusic

Social network open-source dedicato alla musica: ascolti in tempo reale degli amici, recensioni con
voto del pubblico e della critica, scoperta fuori dalla propria bolla (Reels, Roulette dei generi) e
chat pensata per consigliarsi brani.

> **Stato:** web e API funzionano end-to-end su dati reali (account locali, feed, recensioni, chat,
> notifiche, presenza live). L'app mobile è ancora un prototipo su dati mock. Dettagli onesti in
> [`docs/04_STATUS_AND_OPEN_QUESTIONS.md`](./docs/04_STATUS_AND_OPEN_QUESTIONS.md).

## Monorepo

| Percorso          | Contenuto                                                                 |
| ----------------- | ------------------------------------------------------------------------- |
| `apps/api`        | Backend Fastify 4 + Socket.io + Redis (REST `/api/*`, WebSocket presenza) |
| `apps/web`        | Next.js 14 (App Router) + Tailwind, client API tipizzato                  |
| `apps/mobile`     | Expo / React Native (prototipo, non ancora collegato all'API reale)       |
| `packages/db`     | Schema Prisma, migrazioni SQL, seed                                       |
| `packages/shared` | Contratti Zod + tipi condivisi, `THEME` (token di design)                 |

Turborepo + npm workspaces. TypeScript strict ovunque.

## Quickstart

### Prerequisiti

- Node.js **>= 20** e npm 10
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
npm run catalog:import -- --file curated-albums.json   # opzionale: ~46 album reali
npm run catalog:smoke        # verifica la raggiungibilità di Deezer/iTunes/MusicBrainz/CAA
```

Tutti gli utenti del seed hanno password `openmusic-dev` (es. `francospagnati@openmusic.test`;
`admin@openmusic.test` ha ruolo `ADMIN`).

Per modificare lo schema: `npm run db:migrate` (crea una nuova migrazione con `prisma migrate dev`).

### 4. Avvio

```bash
npm run dev                  # API su http://localhost:4000 + web su http://localhost:3000
npm run dev:api              # solo API
npm run dev:web              # solo web
npm run dev:mobile           # Expo (prototipo)
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

## Documentazione

- [CONTRIBUTING.md](./CONTRIBUTING.md): flusso di lavoro, comandi, convenzioni
- [AI_CONTEXT.md](./AI_CONTEXT.md): regole vincolanti per assistenti AI (e per umani)
- [docs/](./docs/README.md): indice completo (prodotto, design, architettura, API, stato, ADR)

## Licenza

Il progetto è pensato come open-source con licenza **MIT**, ma il file `LICENSE` non è ancora nel
repository: va aggiunto prima di accettare contributi esterni.
