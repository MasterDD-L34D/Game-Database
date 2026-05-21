# Schema Versioning Phase B2 — Soft-Delete + Restore Design

**Date**: 2026-05-21
**Author**: parallel-#2 session (Ryzen, Claude opus-4.7)
**Status**: DRAFT — awaiting Eduardo review
**Parent**: RFC #1 `docs/rfc/2026-05-21-schema-versioning.md` (Q7 soft-delete). Phase A merged `1f642ee` (#154), Phase B1 merged `617215f` (#158).
**Goal alignment**: CLAUDE.md Goals → Mid "complete schema versioning (revertable taxonomy changes)".
**Scope**: Game-Database backend only. No dashboard UI (= B3). No read-path `?versionId=` (= Phase C).

## Goal

Replace hard-delete of the 4 versioned masters (Trait/Biome/Species/Ecosystem) with **soft-delete** (`deletedAt` timestamp), add a **restore** path, and make every read surface hide soft-deleted rows by default. This makes deletion **revertable** and removes Phase B1's interim hard-delete guard (`assertNotInReleasedVersion`), which only blocked deletion to protect released-version history — soft-delete preserves that history while still allowing the entity to be removed from active use.

## Decisions (ratified 2026-05-21)

1. **Revert model = soft-delete + restore + repointed audit-revert.** `DELETE` sets `deletedAt`; a new `POST /:id/restore` clears it; the existing `POST /api/audit/:logId/revert`, for a soft-deletable master whose row still exists, clears `deletedAt` instead of recreating.
2. **Slug stays reserved.** Keep the plain `slug @unique @db.VarChar(80)`. A soft-deleted row keeps owning its slug; creating a new entity with that slug returns a clear 409. Restore is therefore collision-free. **No uniqueness migration.**
3. **Hide by default; `?includeDeleted=true` on list + get-by-id.** Glossary, search, and dashboard counts **always** exclude soft-deleted (Game consumer + production surfaces).
4. **Approach 1 — explicit `liveFilter` helper applied per-route** (not a Prisma global extension, which would silently exclude soft-deleted masters from `snapshotAllMasters` at release and corrupt version semantics).

## Non-goals (B2)

- Dashboard UI for deleted/restore = B3.
- Read-path `?versionId=` filter + Game env pin = Phase C.
- Soft-delete for `Record` (not versioned, not Game-consumed) — Records keep hard-delete.
- Transitive junction filtering (a junction may reference a soft-deleted master). Deferred — see "Junction handling" below.
- Freeing a slug for reuse after soft-delete (Q2 rejected the partial-unique approach).

## Schema / migration

Add to **Trait, Biome, Species, Ecosystem** (only):
```prisma
  deletedAt   DateTime?
  // ...
  @@index([deletedAt])
```
Migration `<ts>_soft_delete_masters`: `ALTER TABLE "<M>" ADD COLUMN "deletedAt" TIMESTAMP(3);` + `CREATE INDEX "<M>_deletedAt_idx" ON "<M>"("deletedAt");` for each of the 4. Slug `@unique` unchanged. Regenerate `docs/schema-reference.md` (CI gate). Use `prisma migrate dev --create-only` then apply (the GIN indexes are now modeled per #155, so the diff is clean — only the 4 columns + indexes).

## Components

### 1. `server/utils/softDelete.js` (new)

```js
// liveFilter(req) -> a where-fragment hiding soft-deleted rows unless the
// caller explicitly opts in with ?includeDeleted=true.
function liveFilter(req) {
  const includeDeleted = req && req.query && req.query.includeDeleted === 'true';
  return includeDeleted ? {} : { deletedAt: null };
}
module.exports = { liveFilter };
```
Composed into master `where` clauses via spread: `{ ...liveFilter(req), ...otherConds }`.

### 2. Master routes (×4: traits, biomes, species, ecosystems)

- **List** (`GET /`): merge `liveFilter(req)` into the `where` used by both `count` and `findMany`.
- **Get-by-id** (`GET /:id`): after `findExistingByIdOrSlug`, if the row's `deletedAt` is set and `?includeDeleted` is not true, return 404 `NOT_FOUND` (hidden). Otherwise return it.
- **Glossary** (traits only, `GET /glossary`): always `where: { deletedAt: null }` (no `includeDeleted` honored — Game consumer).
- **DELETE `/:id`** (`requireTaxonomyWrite`): remove the `assertNotInReleasedVersion(...)` import + call. Fetch the row; if `deletedAt` already set → 409 `ALREADY_DELETED`; else `update({ where:{id}, data:{ deletedAt: new Date() } })`; `logAudit(req, '<Entity>', id, 'DELETE', existing)`; `notifyGameCacheInvalidation()` (traits only, as today); return `{ success: true, id }`.
- **POST `/:id/restore`** (`requireTaxonomyWrite`, new): fetch the row (by id, ignoring `deletedAt`); 404 if absent; if `deletedAt` is null → 409 `NOT_DELETED`; else `update({ where:{id}, data:{ deletedAt: null } })`; `logAudit(req, '<Entity>', id, 'UPDATE', { restored: true })`; `notifyGameCacheInvalidation()` (traits); return the restored row. Collision-free: the slug never left this row, so no live row can hold it.

### 3. Search (`server/utils/searchQuery.js`)

Add `softDeletable: true` to the `trait`/`biome`/`ecosystem`/`species` entries of `ENTITY_MAP` (NOT `record`). In `armFor`, when `softDeletable`, append `AND "deletedAt" IS NULL` to the arm's WHERE:
```js
const live = ENTITY_MAP[key].softDeletable ? Prisma.sql` AND "deletedAt" IS NULL` : Prisma.empty;
return Prisma.sql`... WHERE (${whereMatch})${live}`;
```
Search always excludes soft-deleted (no `includeDeleted`).

### 4. Dashboard (`server/routes/dashboard.js`)

In `computeDashboardStats`, add `where: { deletedAt: null }` to the 4 master `count()` calls (`totalTraits`/`totalBiomes`/`totalSpecies`/`totalEcosystems`) and merge `deletedAt: null` into the 4 orphan-count `where` clauses. Junction counts and Record counts are unchanged (no `deletedAt`).

### 5. Audit-revert reconciliation (`server/routes/audit.js`)

In `POST /:logId/revert`, for a `DELETE` audit whose `entity` maps to a soft-deletable master (`modelKey` ∈ {trait,biome,species,ecosystem}):
- `findUnique({ where:{ id: projected.id } })`:
  - **row exists + `deletedAt` set** → `update deletedAt=null` (restore), `logAudit(... 'UPDATE', { revertedFrom: logId, restored: true })`, return restored row.
  - **row exists + live** → 409 `CONFLICT` "already exists" (current behavior).
  - **row absent** (legacy pre-B2 hard-delete tombstone) → keep the existing `.create()` recreate path (with its slug-collision pre-check).
- `Record` and any non-soft-deletable entity keep the current recreate-only path.

### 6. Guard removal

- Delete `assertNotInReleasedVersion` from `server/utils/taxonomyValidation.js` (+ its export) — obsolete; soft-delete is the graceful replacement.
- Remove its import + call from the 4 master delete routes (done in §2).

## Junction handling (deferred, documented)

Soft-deleting a master leaves its junction rows intact. Because the master row survives, the existing FK constraints (default `onDelete: Restrict`) are satisfied — soft-delete **succeeds even when junctions exist**, unlike the current hard-delete which fails with a FK error (P2003) on a master that has junctions. Relation reads (e.g. a live species' biomes) may still surface a junction pointing to a soft-deleted master; transitive filtering is out of scope for B2 (YAGNI — the master itself is hidden from all top-level lists/glossary/search).

## Error semantics

| Code | HTTP | When |
|---|---|---|
| `NOT_FOUND` | 404 | unknown id, or soft-deleted on get-by-id without `?includeDeleted=true` |
| `ALREADY_DELETED` | 409 | DELETE on an already-soft-deleted row |
| `NOT_DELETED` | 409 | restore on a row that is not soft-deleted |
| `CONFLICT` | 409 | create with a slug owned by a (soft-deleted) row; audit-revert onto a live row |

## Testing

### Mocked (`server/test/utils.js` extension + new `softDelete.test.js`, in `run-tests.js`)
Extend the master mock (`createModelMock`) so `findMany`/`count` honor a `deletedAt: null` where-clause and `update` can set/clear `deletedAt`; add a `markDeleted`/seed-with-deletedAt helper.
- Per master: DELETE → 200 + hidden from list; `?includeDeleted=true` → visible; restore → 200 + reappears; double-DELETE → 409 `ALREADY_DELETED`; restore-live → 409 `NOT_DELETED`; create-with-soft-deleted-slug → 409.
- get-by-id of a soft-deleted entity → 404 (200 with `?includeDeleted=true`).
- search + glossary exclude soft-deleted; dashboard counts exclude.
- **Update `versionImmutability.test.js`**: replace the "DELETE versioned → 409" cases with "DELETE versioned master → 200 soft-delete; row survives (`deletedAt` set); its released `*Version` snapshots intact". Drop the now-unused released-guard branch of the `*Version.count` mock + `markReleased`/`releasedSnapshots` (keep the `versionId` count branch — B1 uses it).

### Real-Postgres (`server/test/softDelete.db.test.js`, search-db CI job)
- Soft-delete a versioned master → its released `*Version` snapshot rows survive; master hidden from `GET /traits/glossary` and `/api/search`.
- Restore → reappears in list/glossary.
- Audit-revert of a soft-delete DELETE audit → row's `deletedAt` cleared (restore path), not a recreate.
- Clean up `test-*` rows in `after`.

## File summary

- **Create**: `server/utils/softDelete.js`, `server/test/softDelete.db.test.js`, mocked tests (in an existing or new file registered in `run-tests.js`).
- **Modify**: `server/prisma/schema.prisma` (+migration), `server/routes/{traits,biomes,species,ecosystems}.js` (delete→soft, +restore, list/get/glossary filter), `server/utils/searchQuery.js`, `server/routes/dashboard.js`, `server/routes/audit.js` (revert reconciliation), `server/utils/taxonomyValidation.js` (remove guard), `server/test/utils.js` (mock), `server/test/versionImmutability.test.js` (flip semantics), `docs/schema-reference.md` (regen), `.github/workflows/backend-and-frontend-tests.yml` (run the new db test).
- **RFC #1**: note Phase B1 merged `617215f` + Phase B2 in progress (ride on the B2 branch).
