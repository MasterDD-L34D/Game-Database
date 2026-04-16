# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
