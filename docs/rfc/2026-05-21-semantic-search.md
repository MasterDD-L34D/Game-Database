# RFC #3: Semantic / fuzzy search for taxonomy entities

**Date**: 2026-05-21
**Author**: parallel-#2 session (Ryzen, Claude opus-4.7)
**Status**: ACCEPTED (fuzzy scope) — Eduardo-authorized pull-forward to Fase 2, 2026-05-21. Semantic scope remains DRAFT / Fase 3-gated.
**Scope**: Game-Database `server/` only. No cross-repo touch.
**Spec reference**: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` § Fase 3 deliverable 3 "Semantic search"; implementation design `docs/superpowers/specs/2026-05-21-pg-trgm-fuzzy-search-design.md`

## Why this RFC exists

The value roadmap lists deliverable #3 as a single Fase 3 item:

> "Semantic search: pg_trgm + tsvector index su descriptions + `GET /api/search?q=...&entities=trait,biome` ranked"

and the Fase 3 header marks the whole phase "RFC-gated". A cross-repo
read-only audit (2026-05-21) established that:

- The Fase 3 RFC gate's **mandatory** language ("Eduardo-sovereign gate", "coordinator gate") attaches to the **cross-repo / Game-touching** deliverable #4 (bidirectional sync), not to pg_trgm as a technique.
- Fase 2 deliverable #3 **already lists** "pg_trgm fuzzy index" as in-scope.
- A cross-entity `/api/search` endpoint is **entirely internal to Game-Database** — the sibling Game repo consumes only `/api/traits/glossary` and is unaffected (ADR-2026-04-14 topology).

So the roadmap conflates two separable capabilities under one gated header. This
RFC removes that ambiguity by **splitting deliverable #3** and recording the
authorization to build the non-gated half now.

## Decision: split deliverable #3

### Part A — Fuzzy search (pg_trgm) — ACCEPTED, build in Fase 2 now

- Typo-tolerant `GET /api/search` using `pg_trgm` trigram `similarity()`, ranked,
  across Trait/Biome/Ecosystem/Species/Record.
- Game-Database-internal only; additive (existing `?q` substring search and the
  `/api/traits/glossary` contract untouched).
- **No cross-repo touch ⇒ no coordinator gate required.** Eduardo (project
  sovereign) authorized the pull-forward on 2026-05-21.
- Implementation design: `docs/superpowers/specs/2026-05-21-pg-trgm-fuzzy-search-design.md`.

### Part B — Semantic search (tsvector) — DEFERRED, stays Fase 3 RFC-gated

- tsvector full-text indexing, lexeme/stemming, relevance weighting beyond raw
  trigram, cross-field ranking models.
- Remains a future Fase 3 deliverable. A separate RFC revision (or RFC #3b)
  specs it when prioritized. No authorization to build now.

## Non-goals (both parts)

- Fuzzy on junction tables (FK ids / enums — meaningless).
- `?versionId=` snapshot-aware search — depends on RFC #1 (schema versioning).
- Replacing per-route `?q` substring search.

## Boundary / governance notes

- **Cross-repo**: none. Confirmed by audit — Game's only Game-Database
  dependency is `GET /api/traits/glossary` (`{ traits: [...] }`), with full local
  fallback. A new GET endpoint cannot intercept or alter it.
- **Auth**: open GET, consistent with the existing 10 open GET routes and the
  audit-endpoint open-by-default decision.
- **Migration**: `CREATE EXTENSION IF NOT EXISTS pg_trgm` + GIN trigram indexes.
  pg_trgm bundled in the Postgres 16-alpine image; superuser today.

## Acceptance criteria (Part A)

Tracked in the implementation design's acceptance criteria. Summary:
- `/api/search` endpoint + pure SQL builder + migration.
- Layered tests incl. a real-Postgres CI smoke (`q=lynks` → `Lynx lynx`).
- Per-route `?q` search unchanged.

## Follow-up

- Part B (tsvector semantic) — future Fase 3 RFC when prioritized.
- If search later needs version-awareness, coordinate with RFC #1 Phase C.
