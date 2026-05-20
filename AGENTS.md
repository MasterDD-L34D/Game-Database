# AGENTS.md

## Project context

- `Game-Database` is a standalone taxonomy CMS for Evo-Tactics with:
  - `server/`: Express + Prisma API
  - `apps/dashboard/`: React + Vite dashboard
- Repository docs and operational notes are primarily in Italian. Match that language when editing docs.

## Grounded commands

### Backend

- `cd server && npm run dev:setup`  
  Generates Prisma client, applies migrations, and runs the seed.
- `cd server && npm run dev`  
  Starts the API on `http://localhost:3333`.
- `cd server && npm test`  
  Runs the backend test suite.
- `cd server && npm run evo:import -- --repo C:/Users/VGit/Documents/GitHub/Game`  
  Imports taxonomy data from the sibling `Game` repository.
- `cd server && npm run start:lan`  
  Serves API + built dashboard for LAN usage with Basic Auth.

### Dashboard

- `cd apps/dashboard && npm run dev`  
  Starts the Vite dev server on `http://localhost:5174`.
- `cd apps/dashboard && npm test -- --run <paths...>`  
  Preferred targeted frontend test pattern used by CI.
- `cd apps/dashboard && npm run test:e2e`  
  Runs Playwright E2E tests.

### Docker

- `docker compose up -d`  
  Starts the local Postgres for this repo on host port `5433`.
- `docker compose -f docker-compose.dev.yml up -d`  
  Starts the unified local stack for `Game` + `Game-Database`; requires the sibling `../Game` repo.

## Workflow notes

- The repo has five GitHub Actions workflows under `.github/workflows/`:
  - `backend-and-frontend-tests.yml`
  - `playwright-e2e.yml`
  - `prisma-seed.yml`
  - `evo-import-sync.yml`
  - `schema-doc-check.yml` (added in PR-γ #121: fails if `docs/schema-reference.md` is out-of-sync with `server/prisma/schema.prisma`)
- `evo-import-sync.yml` is a scheduled/manual workflow that checks out the sibling `Game` repo, runs `npm run evo:import`, and opens a PR with synced changes when needed.
- CI uses Node `20` for backend/frontend checks, Playwright, and schema-doc-check; Node `18` for the Prisma seed verification workflow.

## Pre-merge protocol (MANDATORY)

**Never squash-merge a PR without first inspecting inline review comments.**

```bash
gh api repos/MasterDD-L34D/Game-Database/pulls/<N>/comments \
  --jq '.[] | "[\(.user.login)] \(.path):\(.line // "?") :: \(.body)"'
```

Triage each comment by severity:

- **P1** (correctness / security / data loss / CI truncation) → fix before merge.
- **P2** (behavior bug / inconsistency / UX regression) → fix before merge OR explicitly defer with rationale.
- **P3+** (nit / style / suggestion) → may defer to follow-up issue with explicit ack.

If a comment is rejected as false-positive or out-of-scope, reply on the PR explaining why before merging.

**Anti-pattern flagged 2026-05-20**: 5 unaddressed Codex P1+P2 review comments across PR #118 / #122 / #125 / #127 merged silently and only caught by post-hoc audit. Follow-up PR #128 fixed all 5 + introduced this protocol section. See `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` § "Code review protocol" for the full anti-pattern catalogue.
