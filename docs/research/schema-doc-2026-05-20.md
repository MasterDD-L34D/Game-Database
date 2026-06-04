# Research — Schema doc auto-gen + drift gate

**Date**: 2026-05-20
**Component**: `server/scripts/generate-schema-doc.js`, `docs/schema-reference.md`, `.github/workflows/schema-doc-check.yml`, `docs/modal-game-database.md` slim
**Author**: parallel-#2 session (Ryzen)
**Spec reference**: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` PR-γ + Q3 resolved (coexist, not replace)

## Goal

Document the design choices for the Prisma schema doc auto-generator, the chosen co-exist strategy (NOT replace), and the 3+ edge case scenarios for drift detection.

## Design choices

### 1. Pure-JS text parser (no `@prisma/generator-helper` dep)

The generator parses `schema.prisma` as text with regex/state-machine. Rationale:
- Zero new npm dependency
- The schema has 10 enums + 10 models, all standard Prisma syntax
- Field syntax stable across Prisma 5.x: `name Type @modifier1 @modifier2`
- Block syntax stable: `model X { ... }`, `enum X { ... }`
- `// comments` stripped first, then `extractBlocks()` regex captures top-level kinds

Alternative considered: `@prisma/generator-helper` programmatic AST. Rejected because it would require installing prisma as a runtime dep (currently dev-dep only) and the regex parse is sufficient for our schema's stable subset.

### 2. Scalar / relation field classification heuristic

A field is classified as **relation** if:
- It has `@relation(...)` modifier, OR
- Its base type (stripped of `?` / `[]`) matches a known model name

This catches both sides of a relation (the side with `@relation` and the back-side bare field like `species Species[]`).

Primitives recognized: `String`, `Int`, `Float`, `Boolean`, `DateTime`, `Json`, `Bytes`, `Decimal`, `BigInt`.

Enums fall through as `maybeRelation` and resolve to scalar in the heuristic since they're not in modelNames set.

### 3. Idempotent output + `--check` flag

The generator writes file with normalized whitespace (`\n{3,}` → `\n\n`) and trailing newline. Running it twice produces byte-identical output (verified smoke).

`--check` flag: regenerate in memory, compare to committed file, exit 1 on drift. Used by CI workflow `.github/workflows/schema-doc-check.yml`.

## Edge case scenarios investigated

### Scenario 1 — Manual edit drift

**Risk pre-PR-γ**: `modal-game-database.md` schema table edited by hand, drifts from `schema.prisma`. Real example caught during research: doc said "PostgreSQL 15" while `docker-compose.yml` uses `postgres:16-alpine` (Postgres 16). Spec autoresearch flagged this.

**Post-PR-γ**: drift impossible for schema content. Generator is single source. CI fails any PR that touches schema without regenerating doc.

**Coverage**: PR-γ also fixes the Postgres 15→16 drift in the slimmed `modal-game-database.md` and updated `Documento_Riferimento.md` line 54.

### Scenario 2 — Adding a new model

**Pre-PR-γ**: developer adds `model Inventory { ... }` to schema.prisma, forgets to update `modal-game-database.md`. Doc loses parity silently.

**Post-PR-γ**: developer runs `npm run schema:doc`, commits regenerated doc. CI `schema-doc-check` job fails the PR if they forget.

**Test**: simulate by adding a dummy enum/model to schema.prisma, running `schema:doc:check` — expect exit 1 + helpful error message. Smoke verified during research session.

### Scenario 3 — Renaming a field or changing its type

**Pre-PR-γ**: rename `Trait.slug` → `Trait.canonicalSlug`. Doc table column "Campi principali" cites `slug` → stale.

**Post-PR-γ**: generator picks up renamed field, table row regenerated. Drift caught.

### Scenario 4 — Cosmetic generator regression

**Risk**: future edits to `generate-schema-doc.js` produce same logical content but different formatting (extra newlines, different ordering). Idempotency check on byte-equality would false-positive drift.

**Mitigation**: generator normalizes `\n{3,}` collapse, sorts fields in declaration order (stable), and `--check` compares full file content. If a generator bump regenerates differently, fix generator OR commit regenerated doc — both legitimate, the gate enforces sync.

## Slim of `modal-game-database.md`

### Strategy (per Q3 resolved)

- **Auto-gen `schema-reference.md`** = canonical schema reference. 10 models + 9 enums. 8332 chars. CI-gated.
- **Manual `modal-game-database.md`** = slim to dominio/runtime/audit/operativo content. Schema section (14 lines, ~33% of original) replaced with pointer + commands to regenerate.

### Sections preserved (manual)

1. Obiettivo e dominio (entità key list, NOT schema details)
2. Schema (replaced: pointer to schema-reference.md + regen instructions)
3. Processi di popolamento (seed + import script)
4. Sicurezza e audit (RBAC, X-User header)
5. Note operative (env vars, ports, prerequisites — fixed Postgres 15→16 drift)
6. Questioni aperte / TODO

### Updated line anchors

- `Documento_Riferimento.md:47` — old `†L6-L30` → new `†L1-L14` + new `schema-reference.md†L1-L40` reference
- `Documento_Riferimento.md:69` — same update
- `Documento_Riferimento.md:54` — Postgres 15 → 16 (drift fix)

### Cross-repo refs

Zero external references to `modal-game-database.md` (Game / codemasterdd / Godot-v2 / vault all clear per autoresearch).

## Quality gates (CLAUDE.md Release Standard)

- **Step 1 Smoke**: `npm run schema:doc` → emits `schema-reference.md` (8332 chars); rerun = byte-identical output (idempotency). `npm run schema:doc:check` → exit 0 when in sync.
- **Step 2 Research**: this document, 4 scenarios.
- **Step 3 Tuning**: generator runtime measured on local schema (282 lines): under 50ms in Node 20. Well under 2s spec target.

## Cross-repo audit

- **Game** (`C:/dev/Game`): no consumer of `schema-reference.md` or `modal-game-database.md`. Contract is `glossary.schema.json` (already canonical in `server/schemas/`). ZERO breakage.
- **codemasterdd-ai-station**: no policy bears; append-only handoff.
- **vault**, **Game-Godot-v2**: NOT inspected (NO-GO).

## Open follow-ups (out-of-scope for PR-γ)

1. CI lint Postgres-version-in-prose against `docker-compose.yml` (catch future drift in manual sections automatically) — defer to follow-up PR
2. Include indexes in summary table (currently in "Block directives" section) — could add a dedicated "Indexes" subsection per model
3. Optional: link from `schema-reference.md` model anchors to `prisma/schema.prisma` GitHub line refs — defer

## References

- Spec: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` PR-γ + Q3
- Source: `server/prisma/schema.prisma` (282 lines, 10 models + 9 enums)
- Generator: `server/scripts/generate-schema-doc.js`
- CI gate: `.github/workflows/schema-doc-check.yml`
