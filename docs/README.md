# Documentazione OpenMusic

Un argomento, un documento. Se due file dicono cose diverse, vale quello indicato qui come fonte e
l'altro va corretto.

| Documento                                                                                          | Fonte di verità per                                                         |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [`../README.md`](../README.md)                                                                     | Presentazione e quickstart (prerequisiti, Docker, `.env`, migrazioni, test) |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md)                                                         | Flusso di lavoro, comandi, convenzioni di codice e test                     |
| [`../AI_CONTEXT.md`](../AI_CONTEXT.md)                                                             | Regole sintetiche e vincolanti per assistenti AI                            |
| [`01_PRD_AND_PERSONAS.md`](./01_PRD_AND_PERSONAS.md)                                               | Visione, personas, user stories (cosa vogliamo, non cosa esiste)            |
| [`02_DESIGN_AND_NIELSEN.md`](./02_DESIGN_AND_NIELSEN.md)                                           | Filosofia "anti-AI-slop", leggi della UX, 10 euristiche di Nielsen          |
| [`03_ARCHITECTURE_AND_STACK.md`](./03_ARCHITECTURE_AND_STACK.md)                                   | Stack, moduli, flusso richieste e realtime, algoritmi, modello dati         |
| [`04_STATUS_AND_OPEN_QUESTIONS.md`](./04_STATUS_AND_OPEN_QUESTIONS.md)                             | Cosa è reale, cosa manca, prossimi passi mobile, questioni aperte           |
| [`05_DESIGN_SYSTEM.md`](./05_DESIGN_SYSTEM.md) (in inglese)                                        | Tipografia, colori, token, primitive UI                                     |
| [`06_API_AND_AUTH.md`](./06_API_AND_AUTH.md)                                                       | Sessione e auth, formato errori, elenco endpoint, Socket.io, client web     |
| [`decisioni_chiuse_adr_e_roadmap_di_sviluppo.md`](./decisioni_chiuse_adr_e_roadmap_di_sviluppo.md) | ADR-001…009 e roadmap per milestone                                         |

Fonti nel codice che prevalgono sempre sui documenti:

- contratti e costanti: `packages/shared/src`
- schema dati: `packages/db/prisma/schema.prisma`
- token di design: `packages/shared/src/theme.ts`

File rimossi perché duplicati (2026-10): `docs/AI_CONTEXT.md` e
`contesto_e_regole_ingegneristiche_per_ai.md` (→ `../AI_CONTEXT.md`),
`prd_user_personas_e_user_stories.md` (→ `01`), `design_system_anti_ai_slop_ed_euristiche_di_nielsen.md`
(→ `02` + `05`), `architettura_tecnica_algoritmi_e_schema_db.md` (→ `03`).
