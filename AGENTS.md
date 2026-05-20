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

- The repo has four GitHub Actions workflows under `.github/workflows/`:
  - `backend-and-frontend-tests.yml`
  - `playwright-e2e.yml`
  - `prisma-seed.yml`
  - `evo-import-sync.yml`
- `evo-import-sync.yml` is a scheduled/manual workflow that checks out the sibling `Game` repo, runs `npm run evo:import`, and opens a PR with synced changes when needed.
- CI uses Node `20` for backend/frontend checks and Playwright, and Node `18` for the Prisma seed verification workflow.
