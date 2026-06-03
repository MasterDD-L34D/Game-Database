# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Goals (S/M/L)

> Canonical per-repo goals. Hub mirror: `codemasterdd/GOALS.md`. Horizons: Short=weeks / Mid=1-2mo / Long=3-6mo.

- **Short**: wiring consumer Phase C-Game -- chiudere il loop di versioning end-to-end. Il `traitRepository` di Game passa `?versionId` risolto da `EVO_TAXONOMY_VERSION` cosi una build fissa una versione di tassonomia (l'unico acceptance item RFC Sezione 5 non spuntato). Cross-repo (PR su Game + sign-off Eduardo). Versioning lato-DB completato (Phase A+B+C-DB #154/#158/#160/#161/#163 + UI version-mgmt #164).
- **Mid**: letture versionate per Biome/Species/Ecosystem (estendere `?versionId` oltre i soli trait -- C-DB ha coperto solo i trait); sync bidirezionale (DB come source-of-truth) scoping RFC #4; hardening della audit-UI curator.
- **Long**: robust canonical content backend -- versioned, auditable taxonomy provider feeding Game via `evo:import`.

## Project overview

**Game-Database** is a taxonomy CMS for the Evo-Tactics project. It provides a CRUD dashboard (React) and REST API (Express + Prisma + PostgreSQL) for managing traits, species, biomes, and ecosystems. Most docs and commit messages are in **Italian** — match that language when editing docs, but code identifiers stay English.

## Repository layout

- `server/` — Express backend (entry `index.js`, app factory `app.js`)
  - `routes/` — REST API route modules (traits, biomes, species, ecosystems, records, dashboard, + 4 junction endpoints)
  - `middleware/` — user context, basicAuth, permissions (`requireTaxonomyWrite`)
  - `utils/` — audit logging, validation, error handling, pagination
  - `prisma/` — Prisma schema, migrations, seed
  - `scripts/ingest/` — import pipeline (`import-taxonomy.js`) that reads from sibling Game repo
  - `schemas/` — shared JSON Schema contracts (e.g., `glossary.schema.json`)
  - `db/prisma.js` — Prisma client singleton
  - `test/` — backend test suite (node:test)
- `apps/dashboard/` — React + Vite frontend (MUI + TanStack Table/Query + i18n)
- `docs/` — architecture reference, import guide, onboarding, operational runbooks
- `docker-compose.yml` — PostgreSQL 16 + Node server

## Common commands

Node 18+, npm. PostgreSQL 16 via Docker.

### Dev setup

```bash
docker compose up -d                     # Postgres on host port 5433
cd server && cp .env.example .env        # Adjust DATABASE_URL if needed
npm install && npm run dev:setup         # Prisma generate + migrate + seed
npm run dev                              # Express on http://localhost:3333
```

Dashboard (separate terminal):
```bash
cd apps/dashboard && npm install && npm run dev   # Vite on http://localhost:5174
```

### Tests

- `cd server && npm test` — backend test suite (node:test, file-by-file isolation)
- `cd apps/dashboard && npm test` — frontend unit tests (Vitest)
- `cd apps/dashboard && npm run test:e2e` — Playwright E2E

### Import from Game repo

```bash
cd server && npm run evo:import -- --repo C:/Users/VGit/Documents/GitHub/Game
```

Flags: `--dry-run`, `--verbose`, `--config <path>`. Idempotent upsert by slug.

### Other scripts

- `npm run prisma:studio` — visual DB browser on http://localhost:5555
- `npm run start:lan` — serve dashboard + API on 0.0.0.0 with Basic Auth

## Port allocation

| Service | Port | Note |
|---------|------|------|
| Express backend | **3333** | Default, override with `PORT` env |
| PostgreSQL (host) | **5433** | Mapped from internal 5432 to avoid conflict with Game repo |
| Dashboard (Vite) | 5174 | Vite dev server |
| Prisma Studio | 5555 | `npm run prisma:studio` |

## Sibling repo topology

This repo is a sibling of `MasterDD-L34D/Game` (local path typically `C:/Users/VGit/Documents/GitHub/Game`).

- **Import direction**: Game → Game-Database (unidirectional, build-time via `npm run evo:import`)
- **Integration endpoint**: `GET /api/traits/glossary` — consumed by Game backend when `GAME_DATABASE_ENABLED=true` on Game side. Response shape: `{ traits: [{ _id, labels: { it, en }, descriptions: { it, en } }] }`. Contract schema in `server/schemas/glossary.schema.json` (canonical source: `Game/packages/contracts/schemas/glossary.schema.json`).
- **No configuration needed here** for the integration — the glossary endpoint is always available.
- Full topology documented in Game's `docs/adr/ADR-2026-04-14-game-database-topology.md`.

## Architecture notes

- **Prisma schema** (`server/prisma/schema.prisma`): 10 models — Trait, Biome, Species, Ecosystem (masters) + SpeciesTrait, SpeciesBiome, EcosystemBiome, EcosystemSpecies (junctions) + Record (generic data) + AuditLog.
- **Auth**: mutations require `taxonomy:write` or `admin` role via `X-Roles` header. GET endpoints are open. Optional Basic Auth for LAN mode.
- **Audit**: `X-User` header populates `createdBy`/`updatedBy`. All mutations logged to AuditLog table.
- **i18n**: dashboard uses react-i18next with Italian namespace-based JSON files in `apps/dashboard/src/i18n/locales/it/`.

## Running both services locally

```bash
# 1. Game-Database
cd Game-Database && docker compose up -d    # Postgres on 5433
cd Game-Database/server && npm run dev       # API on 3333

# 2. Game
cd Game && docker compose up -d              # Postgres on 5432
cd Game && npm run start:api                 # API on 3334

# 3. Enable HTTP integration (optional)
# Set GAME_DATABASE_ENABLED=true in Game's .env
# Game backend will fetch trait glossary from http://localhost:3333
```

## Migration discipline (issue #159)

`prisma migrate dev` is **interactive** (prompts for the migration name + confirmations) AND, on Prisma 5.x, **refuses to run in a non-interactive environment at all** — in an agent/CI context with no TTY it either hangs forever waiting for input (a real run hung ~5.4h) or errors out. In any automated path:

- **Author** a migration: `npx prisma migrate diff --from-schema-datamodel <prev> --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<ts>_<name>/migration.sql` (read-only diff; `migrate dev --create-only --name` is NOT a reliable substitute — it is also blocked non-interactively on Prisma 5.x).
- **Apply**: `npx prisma migrate deploy` (non-interactive).
- **Inspect only**: `npx prisma migrate diff ...` (read-only).

NEVER run bare `npx prisma migrate dev` in automation. Always run prisma from `server/` (the root resolves a different binary with different flags). A leftover hung `migrate dev` can also hold a Postgres advisory lock — if `migrate deploy` errors P1002, look for an idle backend holding `pg_advisory_lock` and terminate that single backend (do not reset the DB).

## Code review protocol (MANDATORY pre-merge)

**Before squash-merging ANY PR, you MUST check inline review comments.**

Run:

```bash
gh api repos/MasterDD-L34D/Game-Database/pulls/<N>/comments \
  --jq '.[] | "[\(.user.login)] \(.path):\(.line // "?") :: \(.body)"'
```

Triage each comment:

- **P1** (correctness / security / data loss / CI gate truncation): **must fix** before merge.
- **P2** (behavior bug / inconsistency / UX regression): **must fix** before merge OR explicitly defer with rationale in PR description.
- **P3+** (nit / style / suggestion): may defer to follow-up issue, but acknowledge in PR description.

Add fixes as additional commits on the same branch, re-run CI, then merge. If a comment is **rejected** (false-positive / out-of-scope), reply explaining why before merging.

### Anti-pattern flagged 2026-05-20

5 Codex P1+P2 inline review comments on PR #118 / #122 / #125 / #127 were merged silently without inspection. Caught only by post-hoc audit. Follow-up PR #128 fixed all 5 + introduced this protocol.

**Never merge again without checking `/pulls/N/comments` first.**

Full protocol detail: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` § "Code review protocol".

## Baseline / quality gates

### Definition of Done

Una change e DONE solo con: gate verdi con output mostrato (no "sembra fatto") -- per i comandi vedi `## Tests` (server `npm test` + dashboard Vitest; non c'e' uno step di lint dedicato) + zero TODO/stub/placeholder + doc/commit aggiornati + nessun self-merge che salta il review-gate di `## Code review protocol`. Preferisci test mirati > full-suite.

### Dependencies

Chiedi conferma prima di aggiungere una prod-dependency; niente version-bump/update senza approval esplicito; rispetta il lockfile (no edit manuale).

### Secret handling

MAI committare secret/key/token; tienili in env/secret-store (`.env` gitignored, template `server/.env.example`); fai uno scan pre-commit prima del push.
