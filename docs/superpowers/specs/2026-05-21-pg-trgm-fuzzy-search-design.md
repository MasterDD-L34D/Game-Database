# Game-Database — pg_trgm fuzzy cross-entity search (Fase 2 #3)

**Date**: 2026-05-21
**Author**: parallel-#2 session (Ryzen, Claude opus-4.7)
**Status**: DRAFT — awaiting user review before writing-plans
**Scope**: Game-Database only (`server/`). New endpoint + migration + CI test job. Zero cross-repo touch.
**Spec reference**: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` § Fase 2 deliverable 3 "Search-as-you-type" (pg_trgm fuzzy index)
**Governance**: pull-forward of pg_trgm-fuzzy portion of Fase 3 #3, Eduardo-authorized 2026-05-21. See `docs/rfc/2026-05-21-semantic-search.md` (RFC #3) for the scope split. tsvector/semantic relevance stays Fase 3 RFC-gated.

## Problem statement

Current search (`?q` on each list route) is ILIKE substring (`contains`,
`mode: 'insensitive'`) on name/slug-equivalent fields. It is **not
typo-tolerant**: `q=lynks` does not find `Lynx lynx`. For a taxonomy CMS whose
keys are latin binomials (easy to mistype), typo tolerance is a real designer
aid. There is also no single place to search across entity types.

This adds a dedicated fuzzy endpoint using Postgres `pg_trgm` trigram
similarity, ranked, across the 5 master/record entities.

## Goals

- `GET /api/search?q=...` returns typo-tolerant matches ranked by trigram
  similarity, across Trait/Biome/Ecosystem/Species/Record.
- Filterable by entity, bounded result count, configurable similarity floor.
- Self-contained: existing per-route `?q` substring search is **untouched**.
- No cross-repo touch (Game consumes only `/api/traits/glossary`; unaffected).

## Non-goals (stay Fase 3 RFC #3 — `docs/rfc/2026-05-21-semantic-search.md`)

- tsvector full-text search / lexeme stemming.
- Semantic / relevance weighting beyond raw trigram similarity.
- Fuzzy on junction tables (they search FK ids / enums — meaningless).
- `?versionId=` snapshot-aware search (RFC #1 territory).
- Replacing the existing per-route `?q` substring search.

## Architecture decision

**New endpoint, single parameterized raw query, UNION ALL across entities.**

Prisma's query builder cannot express trigram similarity, so the search path
uses `prisma.$queryRaw` (tagged template — parameterized, never
`queryRawUnsafe`). A single statement UNION-ALLs one normalized SELECT per
selected entity, ranks by similarity DESC, and limits. One round-trip; ranking
is global across entities.

The existing `contains` per-route search is left in place — this is additive.

### Identifier quoting (cross-repo audit finding)

The Prisma schema uses **no `@@map`/`@map`**. Default mapping ⇒ tables are
PascalCase (`"Trait"`, `"Biome"`, `"Ecosystem"`, `"Species"`, `"Record"`) and
columns camelCase (`"scientificName"`, `"commonName"`), all case-sensitive.
**Every table and column in the raw SQL must be double-quoted.** An unquoted
`Trait` would resolve to lowercase `trait` and fail.

## Endpoint contract

```
GET /api/search?q=<text>&entities=<csv>&limit=<n>&threshold=<f>
```

| Param | Required | Default | Notes |
|---|---|---|---|
| `q` | yes | — | trimmed; empty/missing ⇒ 400 `VALIDATION` |
| `entities` | no | all 5 | CSV from allowlist `trait,biome,ecosystem,species,record`; unknown token ⇒ 400 |
| `limit` | no | 20 | clamped to [1, 50] |
| `threshold` | no | 0.3 | similarity floor, clamped to [0, 1] |

Response `200`:
```json
{
  "q": "lynks",
  "results": [
    { "entity": "Species", "id": "ck...", "slug": "lynx-lynx", "label": "Lynx lynx", "score": 0.45 }
  ]
}
```

RBAC: **open GET** (mirrors all 10 existing GET routes + the audit-endpoint
open-by-default decision). No write, no auth wall beyond optional LAN basicAuth.

## Searchable fields per entity

| Entity | Table | Search columns | `label` (alias) | `slug` |
|---|---|---|---|---|
| Trait | `"Trait"` | `name`, `slug` | `name` | `slug` |
| Biome | `"Biome"` | `name`, `slug` | `name` | `slug` |
| Ecosystem | `"Ecosystem"` | `name`, `slug` | `name` | `slug` |
| Species | `"Species"` | `scientificName`, `commonName`, `slug` | `scientificName` | `slug` |
| Record | `"Record"` | `nome`, `descrizione` | `nome` | `NULL` (no slug column) |

`score` per row = `GREATEST(similarity(<col>, $q), ...)` over that entity's
search columns. Row included when `score >= $threshold` (equivalently any col
`% $q` with the session threshold; explicit `similarity >= $threshold` is used
for determinism).

## SQL shape (illustrative, parameterized)

```sql
-- $1 = q, $2 = threshold, $3 = limit
SELECT * FROM (
  SELECT 'Trait' AS entity, "id", "slug", "name" AS label,
         GREATEST(similarity("name", $1), similarity("slug", $1)) AS score
    FROM "Trait"
   WHERE GREATEST(similarity("name", $1), similarity("slug", $1)) >= $2
  UNION ALL
  SELECT 'Species', "id", "slug", "scientificName",
         GREATEST(similarity("scientificName", $1), similarity("commonName", $1), similarity("slug", $1))
    FROM "Species"
   WHERE GREATEST(similarity("scientificName", $1), similarity("commonName", $1), similarity("slug", $1)) >= $2
  -- ... Biome, Ecosystem, Record (Record: slug = NULL, cols nome/descrizione)
) ranked
ORDER BY score DESC, label ASC
LIMIT $3;
```

The set of UNION arms is assembled server-side from the entity allowlist map
based on `entities`; only `$1/$2/$3` are user-derived parameters. `commonName`
is nullable — `similarity()` on NULL returns NULL and `GREATEST` ignores NULLs,
so no special handling.

## Components / files

- **`server/utils/searchQuery.js`** (new, pure): `buildFuzzySearch({ entities, })`
  returns `{ sql, params(q, threshold, limit) }` (or a tagged-template fragment
  builder). Holds the entity→{table, cols, labelCol, hasSlug} allowlist map.
  Parses/validates the `entities` CSV (throws on unknown token). No DB, no IO →
  unit-testable in isolation.
- **`server/routes/search.js`** (new): GET handler — validate `q`/`limit`/
  `threshold`, call builder, run `prisma.$queryRaw`, shape response, error via
  existing `handleError`/`sendError` utils.
- **`server/app.js`**: mount `app.use('/api/search', searchRouter)` (after the
  `/api` user-context middleware, alongside the other GET routers).
- **Migration `server/prisma/migrations/<ts>_pg_trgm_search/migration.sql`**:
  `CREATE EXTENSION IF NOT EXISTS pg_trgm;` + GIN trigram indexes
  (`USING gin ("col" gin_trgm_ops)`) on the 11 searchable text columns.
  Hand-written; Prisma does not manage GIN-ops indexes but will not drop them.

## Migration safety (cross-repo audit)

- Postgres **16-alpine** (docker-compose + CI) — `pg_trgm` is bundled contrib;
  `CREATE EXTENSION IF NOT EXISTS` works under the default `postgres` superuser.
- `prisma migrate dev` shadow-DB replays the migration; superuser can
  `CREATE EXTENSION` there too. (Flag: a future least-privilege DB role would
  break shadow-DB diffing — document, out of scope now.)
- CI/Docker use `migrate deploy` (no shadow DB) — safe.
- RFC #1 (schema-versioning) Phase A only **adds** tables and does not touch
  master tables/indexes ⇒ no conflict.

## Testing & quality gates (CLAUDE.md Release Standard)

Layered (decided 2026-05-21):

### Step 1 — Smoke
1. **Pure builder unit** (`server/test/searchQuery.test.js`, node:test, no DB):
   - default entities = all 5; `entities=trait,species` scopes arms.
   - unknown entity token ⇒ throws/400.
   - Record arm emits `slug = NULL`, no `"slug"` column reference.
   - generated SQL references only double-quoted idents; only `$1/$2/$3` params.
2. **Route unit** (mocked): stub `prisma.$queryRaw` in `server/test/utils.js`
   to return fixture rows ⇒ assert response shape, `400` on empty `q`,
   `limit`/`threshold` clamping, `entities` validation.
3. **DB-backed smoke (NEW CI job)**: add a `services: postgres` block to
   `.github/workflows/backend-and-frontend-tests.yml` (mirror `prisma-seed.yml`),
   run a gated integration test that migrates + seeds a real PG16, then asserts
   `GET /api/search?q=lynks` returns `Lynx lynx` ranked first, `threshold` filters
   out weak matches, and `EXPLAIN` shows a GIN index scan. This is the honest
   Step-1 smoke (mocking `$queryRaw` proves nothing about trigram ranking).

### Step 2 — Research (`docs/research/pg-trgm-search-<date>.md`)
≥3 edge cases: empty/whitespace q (400), no-match (empty results, 200),
special chars in q (parameterized-safe, no injection), unknown entity (400),
NULL `commonName`/`descrizione` handling, threshold boundary.

### Step 3 — Tuning
Tune `threshold` default on the seed (precision vs recall on known typos);
`EXPLAIN ANALYZE` before/after GIN index (seq scan → index scan); document
before/after in commit body.

## Risk + mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Raw SQL identifier-case bug | High | Double-quote all idents; builder unit test asserts quoting; DB smoke catches at runtime |
| SQL injection via `q`/`entities` | High | `$queryRaw` tagged-template params for values; table/col names only from server allowlist (never user input); unknown-entity rejected |
| `$queryRaw` breaks mocked suite | Med | Stub `$queryRaw` in `server/test/utils.js`; real behavior covered by the new DB job |
| GIN index unused (planner) | Low | EXPLAIN assertion in DB smoke; threshold tuned |
| CI Postgres job flakiness/time | Low | Mirror proven `prisma-seed.yml` service config |
| Future least-privilege role can't CREATE EXTENSION | Low | Documented; superuser today |

## Acceptance criteria

- [ ] `searchQuery.js` builder + unit tests green (allowlist, Record-no-slug, quoting, entity scoping)
- [ ] `search.js` route + mocked route tests (shape, 400, clamping)
- [ ] Migration: `CREATE EXTENSION pg_trgm` + 11 GIN trgm indexes
- [ ] CI `backend-and-frontend-tests.yml` gains a Postgres-backed job; DB smoke green (`q=lynks` → Lynx lynx ranked)
- [ ] Existing per-route `?q` search unchanged; full backend suite green
- [ ] RFC #3 (`docs/rfc/2026-05-21-semantic-search.md`) committed recording the scope split + Eduardo authorization
- [ ] Research + tuning docs

## Commit policy (ADR-0011)

Trailers `Coding-Agent` + `Trace-Id`; no `Co-Authored-By`; squash + `(#N)`;
pre-merge `/pulls/N/comments` triage.

## References

- Roadmap: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` § Fase 2 #3, Fase 3 #3
- RFC #3 scope split: `docs/rfc/2026-05-21-semantic-search.md`
- Topology constraint: Game `docs/adr/ADR-2026-04-14-game-database-topology.md` (keep additive, port 3333, glossary stable)
- Cross-repo audit 2026-05-21: Game consumes only `/api/traits/glossary`; governance gate is cross-repo (Fase 3 #4), not pg_trgm.
