# AI_CONTEXT · Regole per assistenti AI (e per umani)

> Leggi questo file prima di generare codice, proporre modifiche architetturali o disegnare UI per
> **OpenMusic**. È volutamente breve: i dettagli stanno nei documenti linkati, che sono l'unica fonte
> di verità per il loro argomento. Se il codice e un documento divergono, segnalalo e correggi il
> documento nello stesso commit.

## 1. Progetto

Social network musicale open-source: Next.js 14 (web) + Expo (mobile) + Fastify/Socket.io (API) +
PostgreSQL/Prisma + Redis, in un monorepo Turborepo. Il maintainer ha solide basi TypeScript/Java/
Python/C ed è in fase di ramp-up su React Native: quando introduci pattern specifici di RN/Expo
(worklet Reanimated, moduli nativi) commenta il _perché_.

**Priorità attuale:** web prima, mobile dopo. Stato reale in
[`docs/04_STATUS_AND_OPEN_QUESTIONS.md`](./docs/04_STATUS_AND_OPEN_QUESTIONS.md).

## 2. Regole sul codice

1. **TypeScript strict, zero `any`.** Niente `as any`, niente `@ts-ignore` senza motivazione.
2. **Contract-first.** Ogni payload (REST, WebSocket) nasce come schema Zod + tipo in
   `packages/shared`, poi si implementa in `apps/api`, poi si consuma in `apps/web` tramite
   `@/lib/api` (che valida la risposta con lo stesso schema).
3. **Moduli piccoli e coesi.** API: `apps/api/src/modules/<dominio>/{*.routes.ts,*.service.ts}`.
   Le rotte validano e delegano; la logica sta nei service.
4. **Segui lo stile circostante.** Prettier (`singleQuote`, `printWidth: 100`) + ESLint.
5. **Niente segreti nel frontend.** Le chiamate a provider che richiedono secret passano dall'API.
6. **Real-time su Redis, non su Postgres.** Lo stato "Now Playing" vive in Redis con TTL 300 s e si
   propaga via Socket.io; Postgres riceve solo gli scrobble (`ScrobbleLog`).
7. **Niente dati mock nelle pagine web.** Gli stati vuoti/errore si gestiscono con `EmptyState` /
   `ErrorState`, non con array finti.

## 3. Autenticazione (sintesi di ADR-006, dettagli in [`docs/06_API_AND_AUTH.md`](./docs/06_API_AND_AUTH.md))

- Accesso principale: **account locali email + password** (`scrypt` di `node:crypto`).
- Sessione: **JWT HS256** con `sub` = id utente e `sv` = `User.sessionVersion` (il cambio password
  revoca le altre sessioni). Il ruolo **non** è nel token: si rilegge dal DB.
- Browser: solo cookie `om_session` httpOnly. Nativo/script: `Authorization: Bearer`.
- Socket.io: l'identità arriva **solo** dal token dell'handshake; la presenza va **solo ai follower**.
- Spotify e Last.fm sono account _collegati_ opzionali (OAuth con cookie di stato), mai login
  automatico per email.
- Nelle rotte: `preHandler: fastify.authenticate` / `optionalAuth` / `requireRole('ADMIN')`, poi
  `requireAuth(request)`. Mai fidarsi di un `userId` nel body o nel payload.

## 4. Gestione degli errori (ADR-007)

- Le rotte **non** hanno `try/catch`. Lanciano `AppError` (`apps/api/src/lib/errors.ts`) oppure
  lasciano propagare `ZodError`/errori Prisma: `registerErrorHandling`
  (`apps/api/src/lib/error-handler.ts`) li traduce in `ApiErrorBody`
  (`packages/shared/src/errors.ts`): `{ statusCode, code, message, fieldErrors? }`.
- Mai esporre stack, messaggi di Prisma o risposte dei provider: dettagli solo nei log.
- Chiamate esterne (Deezer, iTunes, Spotify, Last.fm) con `upstreamFetch` (`apps/api/src/lib/upstream.ts`,
  timeout 5 s); un errore del provider diventa `502 UPSTREAM_ERROR`.
- Web: `ApiError` (`status`, `code`, `fieldError(name)`); `status` 0 = errore di rete. Messaggi
  utente in italiano, calmi e azionabili (euristica di Nielsen #9).

## 5. Design (ADR-008, fonte unica: [`docs/05_DESIGN_SYSTEM.md`](./docs/05_DESIGN_SYSTEM.md))

- **Tipografia definitiva:** **Fraunces** (editoriale: titoli, album, citazioni) · **Plus Jakarta
  Sans** (UI e testo) · **JetBrains Mono** con `tabular-nums` per ogni numero (durate, voti, %).
  Cabinet Grotesk, Satoshi, Inter, Syne, Outfit **non** si usano.
- **Token:** importa sempre `THEME` da `@openmusic/shared` (mobile) o usa le classi semantiche
  Tailwind / variabili `--om-*` (web: `bg-canvas`, `bg-surface`, `text-ink-secondary`,
  `border-line-strong`...). Mai valori esadecimali inventati, mai `#000`/`#FFF` come sfondo.
- **Primitive web:** `@/components/ui` (Button, Card, Avatar, RatingStars, ScoreBadge, EmptyState...).
- **Anti "AI-slop":** niente gradienti neon viola/ciano, glow colorati, card "glass" cyberpunk,
  copy robotico. Un solo accento (ambra); verde/rosso solo con significato e sempre con icona o testo.
- **Icone:** solo Phosphor (`@phosphor-icons/react`, `phosphor-react-native`); `regular` inattivo,
  `fill`/`duotone` attivo.
- **Mobile:** Reanimated v3 (mai `Animated` legacy), `@shopify/flash-list`, `expo-haptics` sulle
  azioni chiave.
- **UX:** 10 euristiche di Nielsen in [`docs/02_DESIGN_AND_NIELSEN.md`](./docs/02_DESIGN_AND_NIELSEN.md).

## 6. Dominio (decisioni chiuse, vedi [ADR](./docs/decisioni_chiuse_adr_e_roadmap_di_sviluppo.md))

- Voto utente 0.5–5.0 stelle, salvato come intero 10–100. Aggregato: media pesata + % "Fresh"
  (voti >= 70). Ascolto verificato pesa 1.5, non verificato 1.0 (`packages/shared/src/review.ts`).
- Reazioni alle recensioni: `AGREE`, `WELL_WRITTEN`, `DISCOVERED`, `HEART` (ADR-009). Niente
  commenti pubblici.
- Reazioni in chat: `FIRE`, `HEART`, `NOT_FOR_ME`.
- Anteprime 30 s: oggi Deezer → iTunes (vedi ADR-003 per la discrepanza aperta).

## 7. Test e verifica (prima di dire "fatto")

- Esegui davvero: `npm run lint`, `npm run typecheck`, `npm run db:test:prepare && npm test`, e per
  modifiche UI la build web e `npm run e2e`. Riporta onestamente cosa fallisce.
- I test API sono **d'integrazione su Postgres e Redis reali** (`apps/api/test`, DB
  `openmusic_test`, Redis DB 15): niente mock di Prisma. I file girano in sequenza.
- Logica pura (punteggi, schemi Zod) → test unitari in `packages/shared/test` o accanto al modulo.
- Ogni bug di sicurezza o di integrità dei dati corretto ha un test che lo riproduce.
- Modifiche allo schema Prisma = nuova migrazione in `packages/db/prisma/migrations` (mai `db push`
  per cambi destinati al repo).
- `apps/mobile` va almeno compilato (`npm run typecheck`) anche quando non lo tocchi.

## 8. Dove guardare

| Domanda                         | Documento                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Cosa costruiamo e per chi       | [`docs/01_PRD_AND_PERSONAS.md`](./docs/01_PRD_AND_PERSONAS.md)                                               |
| Principi UX e Nielsen           | [`docs/02_DESIGN_AND_NIELSEN.md`](./docs/02_DESIGN_AND_NIELSEN.md)                                           |
| Architettura, moduli, algoritmi | [`docs/03_ARCHITECTURE_AND_STACK.md`](./docs/03_ARCHITECTURE_AND_STACK.md)                                   |
| Cosa è reale e cosa manca       | [`docs/04_STATUS_AND_OPEN_QUESTIONS.md`](./docs/04_STATUS_AND_OPEN_QUESTIONS.md)                             |
| Token, font, primitive UI       | [`docs/05_DESIGN_SYSTEM.md`](./docs/05_DESIGN_SYSTEM.md)                                                     |
| Endpoint, auth, errori, socket  | [`docs/06_API_AND_AUTH.md`](./docs/06_API_AND_AUTH.md)                                                       |
| Decisioni chiuse e roadmap      | [`docs/decisioni_chiuse_adr_e_roadmap_di_sviluppo.md`](./docs/decisioni_chiuse_adr_e_roadmap_di_sviluppo.md) |
| Come contribuire                | [`CONTRIBUTING.md`](./CONTRIBUTING.md)                                                                       |
