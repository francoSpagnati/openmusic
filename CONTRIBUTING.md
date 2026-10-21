# Contribuire a OpenMusic

Grazie per l'interesse. Questo file descrive come lavoriamo; per l'ambiente locale segui prima il
[Quickstart del README](./README.md#quickstart).

## Flusso di lavoro

1. **Parti da un branch** dal `main` aggiornato (`feat/...`, `fix/...`, `docs/...`, `chore/...`).
2. **Leggi lo stato** in [`docs/04_STATUS_AND_OPEN_QUESTIONS.md`](./docs/04_STATUS_AND_OPEN_QUESTIONS.md)
   e le decisioni in [`docs/decisioni_chiuse_adr_e_roadmap_di_sviluppo.md`](./docs/decisioni_chiuse_adr_e_roadmap_di_sviluppo.md).
   Una scelta che contraddice un ADR richiede prima un nuovo ADR (o un emendamento) nella stessa PR.
3. **Contract-first:** schema Zod + tipo in `packages/shared` → servizio e rotta in `apps/api` →
   client in `apps/web/src/lib/api` → UI.
4. **Commit piccoli e coerenti**, messaggio in stile Conventional Commits:
   `feat(web): ...`, `fix(api): ...`, `test: ...`, `docs: ...`, `chore: ...`.
5. **Verifica in locale** (vedi sotto) e apri una PR verso `main`. La CI
   (`.github/workflows/ci.yml`) esegue lint, typecheck, test, build web e, in un job separato,
   i test e2e Playwright.
6. **Aggiorna la documentazione** nella stessa PR quando cambi endpoint, regole di auth, token di
   design o stato delle funzionalità.

## Comandi

| Comando                                      | Cosa fa                                                    |
| -------------------------------------------- | ---------------------------------------------------------- |
| `npm run dev`                                | API (:4000) + web (:3000) in watch                         |
| `npm run dev:api` / `dev:web` / `dev:mobile` | Un'app sola                                                |
| `npm run lint`                               | ESLint su api, db, shared, web (incluso `apps/web/e2e`)    |
| `npm run typecheck`                          | `tsc --noEmit` su tutti i pacchetti, mobile incluso        |
| `npm run format` / `format:check`            | Prettier                                                   |
| `npm run db:generate`                        | Rigenera il client Prisma                                  |
| `npm run db:migrate`                         | Nuova migrazione da `schema.prisma` (`prisma migrate dev`) |
| `npm run db:migrate:deploy`                  | Applica le migrazioni esistenti                            |
| `npm run db:seed`                            | Dati di esempio (password `openmusic-dev`)                 |
| `npm run db:test:prepare`                    | Ricrea il DB `openmusic_test` (rifiuta nomi senza `_test`) |
| `npm test`                                   | Vitest: `packages/shared` + `apps/api`                     |
| `npm run e2e`                                | Playwright (richiede build web + DB seedato)               |

Checklist minima prima di una PR:

```bash
npm run lint && npm run typecheck
npm run db:test:prepare && npm test
npx turbo run build --filter=@openmusic/web   # se tocchi il web
npm run e2e                                   # se tocchi flussi utente
```

## Convenzioni

### TypeScript

- `strict` ovunque, **niente `any`**; preferisci `unknown` + parsing Zod ai cast.
- I tipi derivano dagli schemi: `type X = z.infer<typeof XSchema>`, esportati da `@openmusic/shared`.
- Prettier: apici singoli, punto e virgola, `printWidth` 100, `trailingComma: es5`.

### API (`apps/api`)

- Un modulo per dominio: `modules/<dominio>/<dominio>.routes.ts` + `<dominio>.service.ts`.
- Le rotte validano input con gli schemi condivisi (`Schema.parse(request.body)`) e delegano.
- **Niente `try/catch` nelle rotte:** lancia una sottoclasse di `AppError` (`BadRequestError`, `NotFoundError`,
  `ForbiddenError`, `ConflictError`...)
  e lascia che l'error handler centrale produca `ApiErrorBody`. Mai restituire dettagli interni.
- Auth: `preHandler: fastify.authenticate` / `optionalAuth` / `requireRole(...)`; l'id utente si
  prende da `requireAuth(request)`, mai dal body.
- Chiamate a servizi esterni con `upstreamFetch` (timeout 5 s).
- Cambi allo schema DB = migrazione versionata in `packages/db/prisma/migrations`.

### Web (`apps/web`)

- Dati solo tramite `api.*` di `@/lib/api`; niente `fetch` sparsi, niente dati mock.
- Pagine protette con `<RequireAuth>` / `useRequireAuth()`; redirect solo con `safeNextPath`.
- Link esterni scritti dagli utenti passano da `externalHref()` (`@/lib/url`).
- UI con le primitive di `@/components/ui` e i token di [`docs/05_DESIGN_SYSTEM.md`](./docs/05_DESIGN_SYSTEM.md).
- Testi dell'interfaccia in italiano.

### Test

- `packages/shared/test`: unit test di schemi e logica pura.
- `apps/api/test`: integrazione con `app.inject` su Postgres e Redis reali (DB `openmusic_test`,
  Redis DB 15). Usa gli helper in `apps/api/test/helpers`.
- `apps/web/e2e`: smoke Playwright; crea account `e2e-*@openmusic.test` (cancellati a fine run).
- Un bug corretto porta con sé il test che lo riproduce.

### Documentazione

- Lingua: italiano (il design system `docs/05` è in inglese per scelta del suo autore; non
  duplicarlo in italiano).
- Un argomento, un documento: linka invece di copiare. Indice in [`docs/README.md`](./docs/README.md).
- Nuove decisioni architetturali → nuovo ADR numerato nel file degli ADR.

## Sicurezza

Non aprire issue pubbliche per vulnerabilità: contatta il maintainer in privato. Non committare
mai `.env`, token o dump di database.
