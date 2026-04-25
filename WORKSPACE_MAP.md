# WORKSPACE_MAP — Game-Database (taxonomy CMS sibling)

> **Scope**: mappa fisica del repo Game-Database e suo ruolo nell'ecosystem Evo-Tactics. Pendant simmetrico di `Game/WORKSPACE_MAP.md` lato runtime.
> **Aggiornato**: 2026-04-25
> **Sorgenti**: filesystem repo + `README.md` + ADR-2026-04-14 (lato Game) + smoke test 2026-04-25.

---

## TL;DR

Game-Database è un **taxonomy CMS** (Prisma + Postgres + Express + React MUI + Tailwind + TanStack Table) che mantiene il glossary canonical di trait/biomi/specie/ecosistemi. Riceve dati build-time dal repo sibling **Game** (Evo-Tactics) tramite `npm run evo:import`. Espone API REST `/api/traits/glossary` consumata opzionalmente dal Game backend via flag `GAME_DATABASE_ENABLED=true` (HTTP Alt B di ADR-2026-04-14).

---

## 🗺️ Topologia repo (cartelle vive)

| Cartella                | Ruolo                                                                                            | Entry point                            |
| ----------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `server/`               | Backend Express + Prisma. Routes `/api/traits`, `/api/biomes`, `/api/species`, `/api/ecosystems` | `server/index.js` + `server/app.js`    |
| `server/prisma/`        | Schema Prisma + migrations + seed                                                                | `server/prisma/schema.prisma`          |
| `server/scripts/ingest/`| Script `import-taxonomy.js` per ingest da pack catalog Game                                       | `server/scripts/ingest/import-taxonomy.js` |
| `apps/dashboard/`       | Frontend React MUI + Tailwind + TanStack Table                                                   | `apps/dashboard/index.html`            |
| `docs/`                 | Documentazione locale Game-Database                                                              | `docs/`                                 |
| `docker-compose.yml`    | Postgres 16-alpine + opzionale server containerizzato                                            | repo root                               |

---

## 🔌 Stack porte locali

| Servizio                         | Host port  | Container port | Note                                                                |
| -------------------------------- | ---------- | -------------- | ------------------------------------------------------------------- |
| Postgres (Docker)                | **5433**   | 5432           | Host port 5433 per evitare collisione con Postgres del repo Game (5432) |
| Server Express + Prisma (`server/`) | **3333**   | 3333           | Override via `PORT` env                                             |
| Dashboard React (`apps/dashboard/`) | **5174**   | n/a            | Vite dev server                                                     |

---

## 🚀 Bootstrap quick (PowerShell)

```powershell
# 1) Postgres
docker compose up -d db

# 2) Server API
Set-Location server
Copy-Item .env.example .env    # DATABASE_URL=postgresql://postgres:postgres@localhost:5433/game?schema=public
npm install
npm run dev:setup              # prisma generate + migrate deploy + seed
npm run dev                    # http://localhost:3333

# 3) Dashboard (in altra shell)
Set-Location ..\apps\dashboard
Copy-Item .env.local.example .env.local
npm install
npm run dev                    # http://localhost:5174
```

**Smoke test** (post bootstrap):

```bash
curl http://localhost:3333/api/traits/glossary    # shape Alt B compliant
curl http://localhost:3333/api/traits?limit=3
curl http://localhost:3333/api/biomes?limit=3
curl http://localhost:3333/api/species?limit=3
```

---

## 🔗 Repo sibling — Game (Evo-Tactics)

**Path locale**: `C:/Users/edusc/Desktop/gioco/Game/`
**GitHub**: https://github.com/MasterDD-L34D/Game

**Mappa workspace completa**: vedi `Game/WORKSPACE_MAP.md` (entry-point fisico + 6 cartelle vive + zip + game-swarm + diagramma flussi).

**Data flow**:

```
┌─────────────────────────┐                ┌──────────────────────────┐
│         Game/           │  build-time    │     Game-Database/       │
│                         │  evo:import    │                          │
│  packs/evo_tactics_pack/│ ─────────────► │  server/scripts/ingest/  │
│  docs/catalog/          │                │  import-taxonomy.js      │
│                         │ ◄── ─── ─── ── │                          │
└─────────────────────────┘  HTTP Alt B    └──────────────────────────┘
                            (flag-OFF default)
                            GET /api/traits/glossary
```

**Build-time (default unico flusso live)**: pack Game → script ingest Game-Database → Postgres.

**Runtime HTTP Alt B (scaffolded, flag-OFF)**: Game backend chiama `GET /api/traits/glossary` su Game-Database porta 3333. Schema condiviso in `Game/packages/contracts/schemas/glossary.schema.json`. Cache TTL + fallback locale. Attivare da Game-side con `GAME_DATABASE_ENABLED=true` quando questo server è up.

**ADR canonical**: `Game/docs/adr/ADR-2026-04-14-game-database-topology.md`.

---

## 🧪 Stato validazione (2026-04-25)

- ✅ `docker compose up -d db` → Postgres healthy
- ✅ `npm install` server → deps OK (con audit warning normali)
- ✅ `npx prisma generate` → Client v5.22.0
- ✅ `npx prisma validate` → schema valid
- ✅ `npm run dev:setup` → 2 migrations applied + seed (200 record / 4 trait / 4 biomi / 3 specie / 3 ecosistemi)
- ✅ `npm run dev` → server :3333 listening
- ✅ Smoke 4 endpoint canonical (200 OK, shape conforme)

---

## 📐 Convenzioni

- **Audit opzionale**: header `X-User: <id>` propaga su `createdBy`/`updatedBy`
- **Ruoli scrittura**: env `TAXONOMY_WRITE_ROLES` (default `taxonomy:write,admin`)
- **Encoding**: UTF-8 forzato cross-platform (vedi linee guida Game `CLAUDE.md`)
- **Migrations**: Prisma migrate, mai SQL diretto (vedi README sezione "Avvio rapido")

---

## 🔗 Cross-link

- `README.md` — onboarding step-by-step utenti finali
- `README_HOWTO_AUTHOR_TRAIT.md` — flow autoring nuovi trait
- `CLAUDE.md` — guidance Claude Code per questo repo
- `Game/WORKSPACE_MAP.md` (sibling) — mappa Evo-Tactics ecosystem
- `Game/docs/adr/ADR-2026-04-14-game-database-topology.md` — ADR canonical topology
