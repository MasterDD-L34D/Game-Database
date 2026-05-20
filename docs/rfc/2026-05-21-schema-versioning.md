# RFC: Schema versioning for taxonomy entities

**Date**: 2026-05-21
**Author**: parallel-#2 session (Ryzen, Claude opus-4.7)
**Status**: DRAFT — awaiting Eduardo + coordinator review
**Scope**: Game-Database schema + Game build-time consumer + RFC-gated cross-repo touch
**Spec reference**: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` § Fase 3 deliverable 1 "Schema versioning"

## Problem statement

Today, Game-Database stores **a single canonical version** of each taxonomy entity (Trait/Biome/Species/Ecosystem/Record). Any edit immediately mutates the live row. Consequences:

1. **No rollback window**: an erroneous mass-update (e.g. wrong import) can only be undone by replaying audit-log (PR #122 read + #130 revert), which is per-row and slow for bulk regressions.
2. **No A/B test** of balance variants: designers can't ship two competing trait configurations and have Game runtime randomly route playtest sessions.
3. **No build-time pin**: Game runtime always sees `master` taxonomy. A breaking change to Trait.dataType propagates instantly even if Game v1.5 was tested against an older schema.
4. **No staging**: there's no "approve set of changes as a unit before they're live" mechanism beyond manual coordination.

PR #135's AuditHistoryPanel surfaces *what* changed; this RFC introduces *when* + *which version*.

## Goals

- Each taxonomy mutation (CREATE/UPDATE/DELETE) is tagged with a `version_id` indicating which named version it belongs to.
- Named versions are immutable once **released** (status: `released`). `draft` versions are mutable.
- A query parameter `?versionId=v1.2.0` on GET endpoints returns the entity-snapshot as of that version, NOT the current live row.
- Game runtime can pin to a specific version at build-time via env var `EVO_TAXONOMY_VERSION=v1.2.0`. Default (unset) = `latest released`.
- Backward compatibility: if no client-side version-aware code exists, current behavior is preserved (all GETs return latest released, all mutations apply to the active draft).

## Non-goals (this RFC)

- **Branching**: this RFC does NOT introduce parallel-branch development (that's deliverable 2 of Fase 3 — separate RFC). Versions here are linear semver tags.
- **Per-row branching**: a user editing Trait X can't have their own "fork" of just that trait. Versions are taxonomy-wide.
- **Auto-merge of drafts**: drafts are mutable but releasing one means rejecting concurrent drafts; merge resolution is human.
- **Schema-of-schema evolution**: Trait.dataType set still requires Prisma migration; this RFC versions the *data*, not the *shape*.

## Proposed design

### 1. New `TaxonomyVersion` model

```prisma
enum TaxonomyVersionStatus {
  draft       // Active mutation target; mutable.
  released    // Immutable snapshot; pinnable by Game runtime.
  retired     // Soft-archived; not returned in default listings.
}

model TaxonomyVersion {
  id          String                @id @default(cuid())
  // Semver-ish tag, e.g. "v1.2.0", "v2.0.0-rc1". Unique.
  tag         String                @unique
  status      TaxonomyVersionStatus @default(draft)
  description String?
  releasedAt  DateTime?
  releasedBy  String?
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt

  // Only one row may have status='draft' at any time. Enforced by partial
  // unique index (see migration SQL below).
  traits      Trait[]
  biomes      Biome[]
  species     Species[]
  ecosystems  Ecosystem[]

  @@index([status, releasedAt])
}
```

Partial unique index (Postgres only):
```sql
CREATE UNIQUE INDEX "TaxonomyVersion_single_draft_idx"
  ON "TaxonomyVersion" ((1))
  WHERE status = 'draft';
```

### 2. Copy-on-write snapshot model (revised 2026-05-21 per Codex P1)

**Initial design rejected**: a single nullable `versionId` FK on each master table would mean UPDATEs retag the row in-place, **destroying the released snapshot**. Codex P1 caught this on first review (`docs/rfc/2026-05-21-schema-versioning.md:100`, see PR #143 comment).

**Revised design — separate snapshot tables**:

```prisma
// Master `Trait` table stays as-is: holds the CURRENT latest-released row
// (or, equivalently, the working copy of the active draft). One row per
// slug. Existing FKs (SpeciesTrait, etc.) continue to point here.
model Trait {
  // ... existing fields unchanged
  // Implicit: latestVersionId = id of the most-recent TaxonomyVersion this
  // trait was modified under. Computed via join, NOT stored on Trait.
}

// NEW: snapshot table, append-only on release. One row per
// (trait, version) pair. Captures all scalar fields at release time.
model TraitVersion {
  id              String           @id @default(cuid())
  traitId         String
  trait           Trait            @relation(fields: [traitId], references: [id], onDelete: Cascade)
  versionId       String
  version         TaxonomyVersion  @relation(fields: [versionId], references: [id])

  // Frozen copy of all Trait scalar fields at release time
  slug            String
  name            String
  description     String?
  category        String?
  unit            String?
  dataType        TraitDataType
  allowedValues   Json?
  rangeMin        Float?
  rangeMax        Float?
  // ... rest of Trait scalars verbatim

  capturedAt      DateTime         @default(now())

  @@unique([traitId, versionId])
  @@index([versionId])
}

// Mirror: BiomeVersion, SpeciesVersion, EcosystemVersion per spec.
```

This gives **true immutability**: once a `TaxonomyVersion.status` flips from `draft` to `released`, the corresponding `TraitVersion` rows for that versionId are frozen. Subsequent `Trait` UPDATEs only mutate the master row and (if a draft is active) write a new `TraitVersion` row under the draft's versionId.

### 3. Migration strategy (3 phases — revised)

**Phase A (this RFC's PR)**: schema additions only.
- Add `TaxonomyVersion` table + seed initial `v1.0.0` row with `status='released'`, `description='Baseline pre-versioning snapshot'`.
- Add 4 snapshot tables (`TraitVersion`, `BiomeVersion`, `SpeciesVersion`, `EcosystemVersion`).
- Backfill: for each existing master row, INSERT a snapshot row into the matching `*Version` table with `versionId = v1.0.0`. Run in 1000-row chunks with progress log.
- Master tables UNTOUCHED — no `versionId` column added. Existing API behavior unchanged.

**Phase B (separate PR, 1-2 sprint later)**: write-path adoption.
- Mutations require an active `draft` version. On every CREATE/UPDATE that lands on a master row, ALSO append a row to the matching `*Version` table tagged with the current draft's versionId. Master row continues to reflect the working draft state.
- DELETEs on master cascade to `*Version` for that traitId via FK `onDelete: Cascade`. Released snapshots survive because their parent master row still exists (DELETE only removes the master). **Edge case**: hard-delete of a master also drops its snapshot history. Soft-delete pattern (a `deletedAt` column on master) may be needed — flagged as open question #7.
- Dashboard UI: "Versione attiva: v1.1.0-draft" indicator + version-management panel.
- New endpoints: `GET /api/taxonomy/versions`, `POST /api/taxonomy/versions`, `POST /api/taxonomy/versions/:tag/release`, `POST /api/taxonomy/versions/:tag/retire`.

**Phase C (separate PR, after Phase B stabilizes)**: read-path version awareness.
- `GET /api/traits?versionId=v1.0.0` joins to `TraitVersion` and returns the snapshot rows for that version.
- `GET /api/traits` without versionId returns master rows (current working state).
- Game runtime env var `EVO_TAXONOMY_VERSION` consumed in `/api/traits/glossary`.

### 4. API contract changes (Phase B+C)

```
POST   /api/taxonomy/versions                  — create draft (requires admin)
GET    /api/taxonomy/versions                  — list, default sort releasedAt desc
GET    /api/taxonomy/versions/:tag             — single version meta + entity counts
POST   /api/taxonomy/versions/:tag/release     — flip draft → released (admin)
POST   /api/taxonomy/versions/:tag/retire      — flip released → retired (admin)
```

```
GET    /api/traits?versionId=v1.2.0            — Phase C: filter by version
                                                 (omitted = latest released)
GET    /api/traits/glossary?versionId=v1.2.0   — Game-runtime consumer hook
```

### 5. Game-side impact (Phase C, cross-repo)

Game's `apps/backend/services/traitRepository.js` (or equivalent) currently fetches `/api/traits/glossary` unconditionally. After Phase C:

```js
const TAXONOMY_VERSION = process.env.EVO_TAXONOMY_VERSION || '';
const url = TAXONOMY_VERSION
  ? `${API_BASE}/traits/glossary?versionId=${encodeURIComponent(TAXONOMY_VERSION)}`
  : `${API_BASE}/traits/glossary`;
```

Backward-compat: env unset → no `versionId` param → Game-Database returns latest released → behavior unchanged.

**This cross-repo touch is RFC-gated**: coordinator session reviews + Eduardo signs off before the Game-side patch lands. Documented per spec § "Cross-repo coordination" Fase 3.

## Sequencing + dependency

```
Phase A (schema add + seed v1.0.0 + backfill)
   │
   ├──→ Phase B (write-path: tag mutations, version mgmt endpoints + UI)
   │
   └──→ Phase C (read-path: ?versionId= filter + Game env consumer)
```

Phase A is **prerequisite-free** and self-contained — can ship without Phase B/C.
Phase B/C each open a separate RFC + PR chain.

## Open questions (for Eduardo + coordinator)

1. **Initial seed tag**: `v1.0.0` (this RFC) vs `v0.1.0` (signals pre-release)?
2. **Draft enforcement**: single-draft via partial unique index (this RFC) vs allow N concurrent drafts with explicit "active draft" pointer (more flexible but more complex)?
3. **Per-entity version vs taxonomy-wide**: this RFC scopes versions to *all 4 masters as a set*. Should Trait versions be independent of Biome versions? (Probably not v1; flag for v2 thought.)
4. **Audit interaction**: each version-release event should log to AuditLog with entity=`TaxonomyVersion`. The `_revertedFrom` chain (PR #130/#133) extends naturally.
5. **Records entity**: NOT versioned in this RFC since Record is per-user artistic schede, not bilanciamento data. Explicit non-goal — confirm?
6. **`@db.VarChar(80)` slug constraint deferral**: still pending from PR-α follow-up. Should it be part of Phase A migration or stay separate?
7. **Hard-delete of master row drops snapshot history** (added 2026-05-21 per Codex P1 design revision): if we keep `onDelete: Cascade`, deleting Trait X destroys all its TraitVersion rows including released snapshots. Options: (a) add `deletedAt` soft-delete column to master tables; (b) change FK to `onDelete: SetNull` and keep orphaned snapshots; (c) accept this loss with explicit warning in delete UI. Recommend (a) for v1, but flag for review.

## Risk matrix

| Risk | Severity | Mitigation |
|---|---|---|
| Backfill UPDATE slow on large existing dataset | Med | Run in chunks of 1000 rows with progress log; benchmark on production-sized seed first |
| `versionId` NULL ambiguity ("missing" vs "all-versions") | Med | Constraint: after Phase A backfill, schema gains NOT NULL on production via separate migration once verified zero NULLs |
| Phase B mutation auto-tagging breaks existing tests | Low | Tests refreshed in same PR; existing audit assertions unaffected since AuditLog.payload already captures full row |
| Phase C Game env consumer regression if VERSION env malformed | Low | Server-side validate `versionId` matches existing TaxonomyVersion.tag; 400 if not. Phase C PR adds test. |
| Cross-repo Phase C PR coordination drift | Med | RFC-gated. Coordinator owns sync. Game-side patch waits for Game-Database Phase C merge. |

## Acceptance criteria (for Phase A landing)

- [ ] `TaxonomyVersion` model + enum in `prisma/schema.prisma`
- [ ] Migration SQL: CREATE TABLE + partial unique index + 4 ALTER TABLE ADD COLUMN versionId
- [ ] Seed file inserts `v1.0.0` released + backfills all existing rows
- [ ] `docs/schema-reference.md` regenerated (CI gate)
- [ ] 5+ unit tests on TaxonomyVersion uniqueness, single-draft enforcement, FK constraint
- [ ] Existing 217 backend tests still verde (zero regression)
- [ ] Spec doc updated with Phase A merge SHA + status flip to IN-PROGRESS

## Follow-up RFCs

- **RFC #2 — Branch/staging** (Fase 3 deliverable 2): parallel-branch development beyond linear semver
- **RFC #3 — Semantic search** (Fase 3 deliverable 3): pg_trgm + tsvector
- **RFC #4 — Bidirectional sync** (Fase 3 deliverable 4): Game-side YAML exported FROM DB instead of imported into DB. Highest-risk, Eduardo-sovereign gate.

## References

- Spec: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` § Fase 3 schema versioning
- Audit endpoint (related): PR #122 (`91d5007`)
- Revert endpoint (related): PR #130 (`a04db35`)
- Schema doc auto-gen (will re-trigger on Phase A): PR-γ #121 (`6fe6719`)
- Game contract: `Game/packages/contracts/schemas/glossary.schema.json`

## Coordinator + Eduardo review checklist

- [ ] Confirm goals + non-goals are correct scope
- [ ] Decide open question #1 (initial tag)
- [ ] Decide open question #2 (single vs N draft policy)
- [ ] Decide open question #3 (per-entity vs taxonomy-wide)
- [ ] Decide open question #5 (Records inclusion)
- [ ] Decide open question #6 (slug constraint folding)
- [ ] Approve Phase A migration approach
- [ ] Sign off on the cross-repo Phase C contract
