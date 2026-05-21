# Schema Versioning Phase B1 — Version Lifecycle + Write-Path Design

**Date**: 2026-05-21
**Author**: parallel-#2 session (Ryzen, Claude opus-4.7)
**Status**: DRAFT — awaiting Eduardo review
**Parent**: RFC #1 `docs/rfc/2026-05-21-schema-versioning.md` (Phase A merged `1f642ee`, #154)
**Scope**: Game-Database backend only. No cross-repo touch. No dashboard UI (= B3). No soft-delete (= B2). No read-path `?versionId=` (= Phase C).

## Goal

Add the **version lifecycle** (create draft → release → retire) and the **write-path** that snapshots taxonomy state into a released version. After B1, an admin can cut a named, immutable `vX.Y.Z` snapshot of the current taxonomy on demand.

## Decisions (ratified 2026-05-21)

1. **Snapshot model = full-snapshot-on-release.** Releasing a draft copies **all** current master rows into that version's `*Version` tables (like the Phase A `v1.0.0` backfill). Each released version is complete + independent. **No per-mutation tagging** — entity mutations (`POST`/`PUT`/`DELETE` on traits/biomes/species/ecosystems) are unchanged by B1.
2. **Draft-then-release lifecycle.** `POST /versions` creates a `draft` (single-draft enforced by the existing partial unique index). `POST /versions/:tag/release` snapshots masters + flips to `released`.
3. **Validated semver tags.** User supplies the tag; enforce `^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$` + uniqueness. No monotonic-ordering enforcement (YAGNI). "Latest released" = most recent `releasedAt` (per RFC), not semver-max — not consumed in B1, relevant in Phase C.
4. **admin-only mutations.** `POST` create/release/retire + `DELETE` draft require role `admin` (via existing `requireRole('admin')`). The two `GET` endpoints stay open, matching every other GET route.

## Non-goals (B1)

- `GET /api/traits?versionId=` read filter + `EVO_TAXONOMY_VERSION` Game env pin → **Phase C**.
- `deletedAt` soft-delete (graceful master deletion while released history survives) → **B2**. B1 keeps Phase A's interim app-layer delete-guard.
- Dashboard "active draft" indicator + version-management panel → **B3**.
- Per-mutation draft tagging, draft "working snapshot" inspection → not needed under the full-snapshot model.

## Schema

**No migration.** `TaxonomyVersion` (with `status`/`tag`/`description`/`releasedAt`/`releasedBy`), the 4 `*Version` snapshot tables, and the single-draft partial unique index all landed in Phase A (`20260521125933_taxonomy_versioning`). B1 is code-only.

## Components

### 1. `server/utils/versionSnapshot.js` (new — shared snapshot logic)

Extract the master→snapshot field mapping out of `server/scripts/backfill-v1-snapshots.js` so backfill **and** release share one frozen-field source (avoids the duplicate-field-list drift foot-gun).

- `FIELD_MAP` — moved verbatim from the backfill script (the 4 entities' delegate/snapshot/fk/fields). Keep its existing "frozen v1.0.0 field set" comment.
- `async function snapshotAllMasters(client, versionId)` — for each entity in `FIELD_MAP`, read masters in 1000-row chunks (`skip`/`take`, `orderBy id asc`), map each row to `{ [fk]: row.id, versionId, ...fields }`, `createMany({ data, skipDuplicates: true })` into the snapshot delegate. Returns `{ trait, biome, species, ecosystem }` insert counts. `client` is either the prisma singleton or a `$transaction` tx client.
- `backfill-v1-snapshots.js` is refactored to `require` `FIELD_MAP` from here; its empty-baseline gate + CLI wrapper stay unchanged.

### 2. `server/routes/taxonomyVersions.js` (new) mounted at `/api/taxonomy/versions`

| Method | Path | Auth | Behavior |
|---|---|---|---|
| `GET` | `/` | open | List versions, `orderBy releasedAt desc` (drafts — null releasedAt — first). Excludes `retired` unless `?includeRetired=true`. |
| `GET` | `/:tag` | open | Single version meta + per-entity snapshot counts (`{trait,biome,species,ecosystem}`; all 0 for a draft). 404 `NOT_FOUND` if missing. |
| `POST` | `/` | admin | Body `{ tag, description? }`. Validate semver. Create `status='draft'`. |
| `POST` | `/:tag/release` | admin | Require `status='draft'`. `prisma.$transaction`: `snapshotAllMasters(tx, version.id)` then update `status='released'`, `releasedAt=now()`, `releasedBy=<user>`. Returns version + counts. |
| `POST` | `/:tag/retire` | admin | Require `status='released'`. Flip to `retired`. |
| `DELETE` | `/:tag` | admin | Require `status='draft'` (released/retired are immutable). Delete the metadata row (a draft holds no snapshots). |

- Mounted in `server/app.js` alongside the other routers: `app.use('/api/taxonomy/versions', taxonomyVersionsRouter)`.
- Semver validation via a small local regex helper; reuse `AppError`/`sendError`/`handleError` + `assertString` from existing utils.
- `releasedBy` resolved from request user context (same `resolveUser` path as audit).

### 3. Audit (Q4 ratified — log-only, non-revertable)

Every lifecycle mutation logs via the existing generic `logAudit(req, 'TaxonomyVersion', version.id, action, payload)`:
- create → `CREATE`; release → `UPDATE`; retire → `UPDATE`; draft-delete → `DELETE`.
- `payload` captures `{ tag, status }` transition (+ snapshot counts on release).
- **Non-revertable**: `TaxonomyVersion` is intentionally absent from `REVERTABLE_ENTITY_MODELS` in `server/routes/audit.js`, so the existing `POST /api/audit/:logId/revert` rejects it (`NOT_REVERTABLE`). No change to audit.js needed.

## Data flow — release (the one non-trivial path)

```
POST /api/taxonomy/versions/v1.1.0/release  (admin)
  → load version by tag; 404 if missing; 409 INVALID_STATE if status != 'draft'
  → prisma.$transaction(tx =>
        counts = snapshotAllMasters(tx, version.id)        // full copy of masters
        tx.taxonomyVersion.update(status='released',
                                  releasedAt=now, releasedBy=user))
  → logAudit(req, 'TaxonomyVersion', id, 'UPDATE', {tag, status:'released', counts})
  → 200 { version, counts }
```

Empty release is allowed (snapshots current masters even if nothing changed since the last version).

## Error semantics

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | tag missing or fails semver regex |
| `NOT_FOUND` | 404 | unknown `:tag` |
| `TAG_EXISTS` | 409 | tag unique violation (P2002 on `tag`) |
| `DRAFT_EXISTS` | 409 | second draft (P2002 on the single-draft partial index) |
| `INVALID_STATE` | 409 | release on non-draft, retire on non-released, delete on non-draft |
| `FORBIDDEN` | 403 | non-admin on a mutation (existing `requireRole`) |

P2002 disambiguation: inspect `err.meta?.target` / constraint name to distinguish `TAG_EXISTS` vs `DRAFT_EXISTS` (the partial index is `TaxonomyVersion_single_draft_idx`).

## Phase A interaction

- The Phase A delete-guard (`assertNotInReleasedVersion`) is unchanged. **Side-effect**: once a version is released, its snapshotted masters become hard-delete-blocked (409 `VERSION_IMMUTABLE`). This is correct under B1; the graceful soft-delete path is B2.
- Backfill script keeps working (now sourcing `FIELD_MAP` from the shared util).

## Testing

### Mocked — `server/test/taxonomyVersions.test.js` (added to `run-tests.js`, no Postgres)
Extend the test context (`test/utils.js`) with a controllable `taxonomyVersion` store + `*Version` count stubs.
- create: valid semver → 201 draft; invalid tag → 400; duplicate tag → 409 `TAG_EXISTS`; second draft → 409 `DRAFT_EXISTS`.
- release: draft → 200 released + counts; non-draft → 409 `INVALID_STATE`.
- retire: released → 200 retired; non-released → 409.
- delete: draft → 200; released/retired → 409.
- auth: non-admin mutation → 403.
- list: hides `retired` unless `?includeRetired=true`.
- get: returns per-entity counts.

### Real-Postgres — `server/test/taxonomyVersions.db.test.js` (search-db CI job)
- Full lifecycle: create draft `vX` → release → assert per-entity snapshot count == master count (parity) → retire.
- Single-draft: creating a 2nd draft → 409.
- Released immutability: releasing twice / deleting a released version → 409.
- Clean up `test-*` tags + any test-created versions in `after`.

### Shared-util — covered by the DB lifecycle test (parity assertion exercises `snapshotAllMasters`).

## File summary

- **Create**: `server/utils/versionSnapshot.js`, `server/routes/taxonomyVersions.js`, `server/test/taxonomyVersions.test.js`, `server/test/taxonomyVersions.db.test.js`.
- **Modify**: `server/scripts/backfill-v1-snapshots.js` (import shared `FIELD_MAP`), `server/app.js` (mount router), `server/test/run-tests.js` (register mocked test), `server/test/utils.js` (version store/mocks), `.github/workflows/backend-and-frontend-tests.yml` (run the new db test in `search-db`).
- **No** schema/migration change.
