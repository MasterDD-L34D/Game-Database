# RFC: Schema versioning for taxonomy entities

**Date**: 2026-05-21
**Author**: parallel-#2 session (Ryzen, Claude opus-4.7)
**Status**: IN-PROGRESS — Phase A merged `1f642ee` (#154), Phase B1 (version lifecycle) merged `617215f` (#158), Phase B2 (soft-delete + restore) merged `4c85f49` (#160) + PUT-on-deleted guard `b2fa883` (#161). Eduardo ratified all 7 recommended resolutions (2026-05-21). **Phase C split**: **C-DB read-path** (`GET /api/traits` + `/glossary` `?versionId=<tag>` snapshot filter — `versionRead.js` + handler branch + 7 real-PG tests) implemented on branch `feat/schema-versioning-phase-c-cdb` (in-PR; design `docs/superpowers/specs/2026-05-21-schema-versioning-phase-c-cdb-design.md`). **C-Game** env consumer (`EVO_TAXONOMY_VERSION` pin) remains cross-repo, Eduardo-gated, separate RFC/PR.
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
                                                 (omitted = live current glossary,
                                                  NOT a snapshot — shipped C-DB)
GET    /api/traits/glossary?versionId=v1.2.0   — Game-runtime consumer hook
```

### 5. Game-side impact (Phase C, cross-repo)

The real HTTP consumer is **`apps/backend/services/catalog.js`** (ADR-2026-04-14 Alternative B), NOT `traitRepository.js` (which is a local file store with its own `_versions/` snapshotting and never calls Game-Database). `catalog.js` `fetchRemoteGlossary()` fetches `${httpBase}/api/traits/glossary` when `GAME_DATABASE_ENABLED` is on. After Phase C-Game, an `EVO_TAXONOMY_VERSION` env threads `index.js → app.js → catalog.js` and the fetch appends `?versionId=`:

```js
const versionId = process.env.EVO_TAXONOMY_VERSION || ''; // index.js, into gameDatabase options
const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : '';
const url = `${httpBase}/api/traits/glossary${query}`;     // catalog.js fetchRemoteGlossary
```

Backward-compat: env unset → no `versionId` → Game-Database returns the **live current glossary** (NOT a snapshot) → behavior unchanged (Game already consumes the live glossary today).

**Fail-loud on pin**: when `versionId` is set and the fetch fails (4xx bad/unreleased pin, or 5xx/timeout DB down), `catalog.js` does NOT fall back to the local file — a pinned build serving stale local data hides a misconfiguration, so it fails visibly. Unpinned fetches keep today's local fallback.

**This cross-repo touch is RFC-gated**: coordinator session reviews + Eduardo signs off before the Game-side patch lands. Design: `docs/superpowers/specs/2026-05-26-cgame-version-consumer-design.md`.

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

## Recommended resolutions (DRAFT 2026-05-21 — for Eduardo + coordinator ratification)

Research-backed recommendations for the 7 open questions. Not yet binding —
ratify or override. Rationale leans YAGNI + "Phase A stays minimal".

| # | Question | Recommended | Rationale |
|---|---|---|---|
| 1 | Initial seed tag | **`v1.0.0` released** | The data is already production-canonical (Game consumes it live via `/api/traits/glossary`). `v0.x` would falsely signal pre-release. Major=1 = stable baseline. |
| 2 | Draft enforcement | **Single draft (partial unique index)** | N concurrent drafts needs an "active draft" pointer + merge resolution with zero current demand (YAGNI). Single draft = simplest correct; multi-draft is RFC #2 (branch/staging) territory. |
| 3 | Per-entity vs taxonomy-wide | **Taxonomy-wide (4 masters as a set)** | A version = a coherent balance snapshot; independent per-entity versions explode the combination matrix and Game pins ONE taxonomy version. Per-entity = explicit v2 non-goal. |
| 4 | Audit interaction | **Log version lifecycle to AuditLog `entity='TaxonomyVersion'`** (create/release/retire); **log-only, NOT revertable** | `logAudit` + the audit endpoint are already generic over the entity string. Gives free release history. `TaxonomyVersion` must NOT join `REVERTABLE_ENTITY_MODELS` (release/retire are state flips, not row resurrections). |
| 5 | Records inclusion | **Exclude — confirmed non-goal** | Record = per-user artistic schede, not balance taxonomy; Game does not consume Records. Snapshot tables cover **4** masters (Trait/Biome/Species/Ecosystem), not 5. |
| 6 | `@db.VarChar(80)` slug constraint | **Separate PR (PR-α2), NOT Phase A** | The schema currently has unconstrained `slug String @unique` (no length). The constraint mirrors app-level `normalizeSlug` max-80 — an orthogonal PR-α follow-up. Folding it into the versioning migration couples two concerns. Keep Phase A focused. |
| 7 | Hard-delete drops snapshot history | **App-layer guard in Phase A; soft-delete `deletedAt` in Phase B** | True immutability needs the master row to survive; (b) SetNull orphans break FK semantics, (c) accept-loss violates the immutability goal. **Correction (PR #154 review):** the original "no deletes occur in Phase A" premise was wrong — the live DELETE endpoints (`prisma.<master>.delete`) predate Phase A, so once v1.0.0 is backfilled a normal DELETE cascades into released snapshots. Phase A therefore ships an **application-layer guard** (`assertNotInReleasedVersion`): hard-deleting a master captured in a released version returns `409 VERSION_IMMUTABLE`. FK stays `onDelete: Cascade` (unchanged). Full soft-delete (`deletedAt`, cross-cutting: every GET filters `deletedAt IS NULL`) still lands with Phase B write-path adoption. |

### Knock-on design clarifications

- **Scope**: with #5 confirmed, the design's "5 entities" references should read **4** (Record excluded). The §1/§2 model text already lists 4 snapshot tables — consistent.
- **Phase A minimality**: #6 + #7 both defer cross-cutting changes out of Phase A. Phase A = `TaxonomyVersion` model + enum + 4 snapshot tables + seed `v1.0.0` + backfill. No master-table column changes, no `deletedAt`, no slug constraint.

## Risk matrix

| Risk | Severity | Mitigation |
|---|---|---|
| Backfill UPDATE slow on large existing dataset | Med | Run in chunks of 1000 rows with progress log; benchmark on production-sized seed first |
| `versionId` NULL ambiguity ("missing" vs "all-versions") | Med | Constraint: after Phase A backfill, schema gains NOT NULL on production via separate migration once verified zero NULLs |
| Phase B mutation auto-tagging breaks existing tests | Low | Tests refreshed in same PR; existing audit assertions unaffected since AuditLog.payload already captures full row |
| Phase C Game env consumer regression if VERSION env malformed | Low | Server-side validate `versionId` matches existing TaxonomyVersion.tag; 400 if not. Phase C PR adds test. |
| Cross-repo Phase C PR coordination drift | Med | RFC-gated. Coordinator owns sync. Game-side patch waits for Game-Database Phase C merge. |

## Acceptance criteria (for Phase A landing)

Updated 2026-05-21 to match the copy-on-write snapshot design (§2) and the
recommended resolutions above — the prior `ADD COLUMN versionId` wording
predated the Codex P1 revision and is superseded.

- [x] `TaxonomyVersion` model + `TaxonomyVersionStatus` enum in `prisma/schema.prisma`
- [x] 4 snapshot models: `TraitVersion`, `BiomeVersion`, `SpeciesVersion`, `EcosystemVersion` (Record excluded per Q5)
- [x] Migration SQL: CREATE TABLE (TaxonomyVersion + 4 snapshot tables) + partial unique index on `status='draft'`. **No** master-table column changes (no `versionId` on masters, no `deletedAt`, no slug constraint — Q6/Q7 deferred)
- [x] Seed/data migration inserts `v1.0.0` (status `released`) + backfills one snapshot row per existing master row, in 1000-row chunks with progress log (`server/scripts/backfill-v1-snapshots.js`)
- [x] `docs/schema-reference.md` regenerated (CI gate)
- [x] 6 DB tests (`server/test/taxonomyVersion.db.test.js`): `TaxonomyVersion.tag` uniqueness, single-draft partial-unique enforcement, snapshot FK constraint, backfill row-count parity, idempotent re-run — wired into the `search-db` CI job
- [x] Existing backend suite green (zero regression) — all 16 mocked test files pass
- [x] Spec doc updated with Phase A merge SHA (`1f642ee`) + status flip to IN-PROGRESS

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

Recommended resolutions are in the "Recommended resolutions" section above —
ratify (✓) or override each.

- [x] Confirm goals + non-goals are correct scope
- [x] Q1 initial tag — `v1.0.0` (ratified 2026-05-21)
- [x] Q2 single vs N draft — single draft (ratified)
- [x] Q3 per-entity vs taxonomy-wide — taxonomy-wide (ratified)
- [x] Q4 audit interaction — log lifecycle, non-revertable (ratified; no write-path in Phase A)
- [x] Q5 Records inclusion — exclude, 4 snapshot tables (ratified)
- [x] Q6 slug constraint folding — separate PR, done in #153 (ratified)
- [x] Q7 hard-delete cascade — Phase A app-layer guard (`409 VERSION_IMMUTABLE`); soft-delete `deletedAt` in Phase B (ratified; guard added in PR #154 review after the "no deletes in Phase A" premise was falsified)
- [x] Approve Phase A migration approach (snapshot tables, no master changes)
- [ ] Sign off on the cross-repo Phase C contract (deferred — Phase C, not this PR)
