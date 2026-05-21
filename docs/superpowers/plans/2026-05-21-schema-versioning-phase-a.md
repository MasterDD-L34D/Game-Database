# Schema Versioning — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `TaxonomyVersion` model + 4 copy-on-write snapshot tables (`TraitVersion`, `BiomeVersion`, `SpeciesVersion`, `EcosystemVersion`), seed a baseline `v1.0.0` released version, and backfill one snapshot row per existing master row — with **zero changes to master tables** and zero changes to existing API behavior.

**Architecture:** Schema-only additions. Master tables (`Trait`/`Biome`/`Species`/`Ecosystem`) are untouched (no `versionId` column, no `deletedAt`). A separate `*Version` snapshot table per master freezes all scalar fields under a `(<entity>Id, versionId)` unique pair, giving true immutability once a `TaxonomyVersion` flips `draft → released`. Phase A only **adds + backfills**; the write-path (Phase B) and read-path (Phase C) adoption are out of scope (separate RFCs/PRs). Backfill is an idempotent Node script (chunked, progress-logged) run after seed.

**Tech Stack:** Prisma 5 + PostgreSQL 16, Express, `node:test`. Migrations are hand-finished SQL (the single-draft partial unique index and the enum-typed seed INSERT are appended to the Prisma-generated migration, since Prisma cannot express a partial unique index).

**Ratified decisions (RFC #1, 2026-05-21):** Q1 seed tag `v1.0.0` released · Q2 single draft (partial unique index) · Q3 taxonomy-wide (4 masters as a set) · Q4 audit = log-only non-revertable (no write-path in Phase A, so no audit code yet) · Q5 Records excluded (4 snapshot tables, not 5) · Q6 slug VarChar(80) already done separately (#153) · Q7 soft-delete deferred to Phase B.

**Source spec/RFC:** `docs/rfc/2026-05-21-schema-versioning.md` (§2 revised design, §3 Phase A, Acceptance criteria).

---

## File Structure

- **Modify** `server/prisma/schema.prisma` — add `TaxonomyVersionStatus` enum, `TaxonomyVersion` model, 4 `*Version` snapshot models, and a back-relation field on each of the 4 master models. No scalar columns added to masters.
- **Create** `server/prisma/migrations/<ts>_taxonomy_versioning/migration.sql` — Prisma-generated CREATE TABLE / CREATE TYPE / unique+index DDL, then hand-appended: (a) single-draft partial unique index, (b) baseline `v1.0.0` INSERT.
- **Create** `server/scripts/backfill-v1-snapshots.js` — idempotent, chunked (1000-row) backfill that copies every master row into its `*Version` table under `v1.0.0`. Exports `backfillV1Snapshots(prisma)` and runs as a CLI when invoked directly.
- **Create** `server/test/taxonomyVersion.db.test.js` — real-Postgres test suite (tag uniqueness, single-draft enforcement, snapshot FK constraint, backfill parity, backfill idempotency).
- **Modify** `server/package.json` — `dev:setup` script appends the backfill step.
- **Modify** `.github/workflows/backend-and-frontend-tests.yml` — `search-db` job gains a backfill step + a step running the new DB test.
- **Modify** `docs/schema-reference.md` — regenerated via `npm run schema:doc` (CI-gated, do not hand-edit).
- **Modify** `docs/rfc/2026-05-21-schema-versioning.md` — flip Status to IN-PROGRESS, record Phase A merge SHA (SHA filled post-merge).

---

## Task 1: Schema models + enum

**Files:**
- Modify: `server/prisma/schema.prisma` (append new enum + 5 models; add one back-relation line to each of the 4 master models)

- [ ] **Step 1: Add the status enum**

In `server/prisma/schema.prisma`, after the existing `enum Role { ... }` block (around line 81), add:

```prisma
enum TaxonomyVersionStatus {
  draft
  released
  retired
}
```

- [ ] **Step 2: Add a back-relation field to each master model**

These are virtual relation fields — **no database column is added**, so the "no master-table changes" constraint holds. Add the indicated line inside each model:

In `model Trait { ... }`, after `speciesValues SpeciesTrait[]`:
```prisma
  versions      TraitVersion[]
```

In `model Biome { ... }`, after `ecosystems  EcosystemBiome[]`:
```prisma
  versions    BiomeVersion[]
```

In `model Species { ... }`, after `ecosystems     EcosystemSpecies[]`:
```prisma
  versions       SpeciesVersion[]
```

In `model Ecosystem { ... }`, after `species     EcosystemSpecies[]`:
```prisma
  versions    EcosystemVersion[]
```

- [ ] **Step 3: Add the `TaxonomyVersion` model**

Append at the end of `server/prisma/schema.prisma`:

```prisma
model TaxonomyVersion {
  id          String                @id @default(cuid())
  tag         String                @unique
  status      TaxonomyVersionStatus @default(draft)
  description String?
  releasedAt  DateTime?
  releasedBy  String?
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt

  traitVersions     TraitVersion[]
  biomeVersions     BiomeVersion[]
  speciesVersions   SpeciesVersion[]
  ecosystemVersions EcosystemVersion[]

  @@index([status, releasedAt])
}
```

- [ ] **Step 4: Add the 4 snapshot models**

Append at the end of `server/prisma/schema.prisma`. Each freezes the master's scalar fields verbatim (same names/types) plus FK to master (cascade) and to version.

```prisma
model TraitVersion {
  id        String          @id @default(cuid())
  traitId   String
  trait     Trait           @relation(fields: [traitId], references: [id], onDelete: Cascade)
  versionId String
  version   TaxonomyVersion @relation(fields: [versionId], references: [id])

  slug                      String        @db.VarChar(80)
  name                      String
  description               String?
  category                  String?
  unit                      String?
  dataType                  TraitDataType
  allowedValues             Json?
  rangeMin                  Float?
  rangeMax                  Float?
  tier                      String?
  familyType                String?
  energyMaintenance         String?
  slotProfile               Json?
  usageTags                 Json?
  synergies                 Json?
  conflicts                 Json?
  environmentalRequirements Json?
  inducedMutation           String?
  functionalUse             String?
  selectiveDrive            String?
  weakness                  String?

  capturedAt DateTime       @default(now())

  @@unique([traitId, versionId])
  @@index([versionId])
}

model BiomeVersion {
  id        String          @id @default(cuid())
  biomeId   String
  biome     Biome           @relation(fields: [biomeId], references: [id], onDelete: Cascade)
  versionId String
  version   TaxonomyVersion @relation(fields: [versionId], references: [id])

  slug          String   @db.VarChar(80)
  name          String
  description   String?
  climate       String?
  parentId      String?
  summary       String?
  climateTags   Json?
  hazard        Json?
  ecology       Json?
  roleTemplates Json?
  sizeMin       Int?
  sizeMax       Int?

  capturedAt DateTime @default(now())

  @@unique([biomeId, versionId])
  @@index([versionId])
}

model SpeciesVersion {
  id        String          @id @default(cuid())
  speciesId String
  species   Species         @relation(fields: [speciesId], references: [id], onDelete: Cascade)
  versionId String
  version   TaxonomyVersion @relation(fields: [versionId], references: [id])

  slug                String   @db.VarChar(80)
  scientificName      String
  commonName          String?
  kingdom             String?
  phylum              String?
  class               String?
  order               String?
  family              String?
  genus               String?
  epithet             String?
  status              String?
  description         String?
  displayName         String?
  trophicRole         String?
  functionalTags      Json?
  flags               Json?
  balance             Json?
  playableUnit        Boolean?
  morphotype          String?
  vcCoefficients      Json?
  spawnRules          Json?
  environmentAffinity Json?
  jobsBias            Json?
  telemetry           Json?

  capturedAt DateTime @default(now())

  @@unique([speciesId, versionId])
  @@index([versionId])
}

model EcosystemVersion {
  id          String          @id @default(cuid())
  ecosystemId String
  ecosystem   Ecosystem       @relation(fields: [ecosystemId], references: [id], onDelete: Cascade)
  versionId   String
  version     TaxonomyVersion @relation(fields: [versionId], references: [id])

  slug        String  @db.VarChar(80)
  name        String
  description String?
  region      String?
  climate     String?

  capturedAt DateTime @default(now())

  @@unique([ecosystemId, versionId])
  @@index([versionId])
}
```

- [ ] **Step 5: Validate the schema parses**

Run: `cd server && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 6: Generate the migration WITHOUT applying it**

Local docker Postgres must be up on 5433 (`docker compose up -d` from repo root if not).

Run: `cd server && npx prisma migrate dev --name taxonomy_versioning --create-only`
Expected: prints `Prisma Migrate created the following migration ... migrations/<timestamp>_taxonomy_versioning` and does NOT apply it. Note the exact directory name printed.

- [ ] **Step 7: Append the partial unique index + baseline seed to the generated migration**

Open the generated `server/prisma/migrations/<timestamp>_taxonomy_versioning/migration.sql`. Append these two statements to the **end** of the file (after the Prisma-generated DDL):

```sql
-- RFC #1 Q2: single mutable draft enforced via partial unique index
-- (Prisma cannot express partial unique indexes in schema).
CREATE UNIQUE INDEX "TaxonomyVersion_single_draft_idx"
  ON "TaxonomyVersion" ((1))
  WHERE "status" = 'draft'::"TaxonomyVersionStatus";

-- RFC #1 Q1: baseline released version. The live data is already
-- production-canonical (Game consumes /api/traits/glossary), so major=1.
INSERT INTO "TaxonomyVersion" ("id", "tag", "status", "description", "releasedAt", "createdAt", "updatedAt")
VALUES (
  'taxver_v1_0_0_baseline',
  'v1.0.0',
  'released'::"TaxonomyVersionStatus",
  'Baseline pre-versioning snapshot',
  now(), now(), now()
);
```

- [ ] **Step 8: Apply the migration + regenerate the client**

Run: `cd server && npx prisma migrate dev`
Expected: applies `<timestamp>_taxonomy_versioning`, ends with `Already in sync` / `Your database is now in sync with your schema.` and regenerates the Prisma client (so `prisma.taxonomyVersion`, `prisma.traitVersion`, etc. exist).

- [ ] **Step 9: Sanity-check the baseline row + partial index landed**

Run:
```bash
cd server && node -e "const p=require('./db/prisma');p.taxonomyVersion.findUnique({where:{tag:'v1.0.0'}}).then(v=>{console.log('baseline:',v&&v.status);return p.\$disconnect();})"
```
Expected: `baseline: released`

- [ ] **Step 10: Commit**

```bash
git add server/prisma/schema.prisma "server/prisma/migrations"
git commit -m "feat(db): add TaxonomyVersion + 4 snapshot tables (RFC #1 Phase A)"
```

---

## Task 2: Idempotent chunked backfill script

**Files:**
- Create: `server/scripts/backfill-v1-snapshots.js`
- Modify: `server/package.json:24` (the `dev:setup` script)

- [ ] **Step 1: Write the backfill script**

Create `server/scripts/backfill-v1-snapshots.js`:

```js
#!/usr/bin/env node
'use strict';
// RFC #1 Phase A backfill: copy every master row into its *Version snapshot
// table under the baseline v1.0.0 version. Idempotent (createMany +
// skipDuplicates against the (<entity>Id, versionId) unique pair), chunked at
// 1000 rows, line-buffered progress log. Safe to re-run.

const CHUNK = 1000;
const BASELINE_TAG = 'v1.0.0';

// Master scalar field lists — kept in sync with prisma/schema.prisma. Each
// listed field is copied verbatim from the master row into the snapshot row.
const FIELD_MAP = {
  trait: {
    delegate: 'trait',
    snapshot: 'traitVersion',
    fk: 'traitId',
    fields: [
      'slug', 'name', 'description', 'category', 'unit', 'dataType',
      'allowedValues', 'rangeMin', 'rangeMax', 'tier', 'familyType',
      'energyMaintenance', 'slotProfile', 'usageTags', 'synergies',
      'conflicts', 'environmentalRequirements', 'inducedMutation',
      'functionalUse', 'selectiveDrive', 'weakness',
    ],
  },
  biome: {
    delegate: 'biome',
    snapshot: 'biomeVersion',
    fk: 'biomeId',
    fields: [
      'slug', 'name', 'description', 'climate', 'parentId', 'summary',
      'climateTags', 'hazard', 'ecology', 'roleTemplates', 'sizeMin', 'sizeMax',
    ],
  },
  species: {
    delegate: 'species',
    snapshot: 'speciesVersion',
    fk: 'speciesId',
    fields: [
      'slug', 'scientificName', 'commonName', 'kingdom', 'phylum', 'class',
      'order', 'family', 'genus', 'epithet', 'status', 'description',
      'displayName', 'trophicRole', 'functionalTags', 'flags', 'balance',
      'playableUnit', 'morphotype', 'vcCoefficients', 'spawnRules',
      'environmentAffinity', 'jobsBias', 'telemetry',
    ],
  },
  ecosystem: {
    delegate: 'ecosystem',
    snapshot: 'ecosystemVersion',
    fk: 'ecosystemId',
    fields: ['slug', 'name', 'description', 'region', 'climate'],
  },
};

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

async function backfillEntity(prisma, versionId, cfg) {
  let skip = 0;
  let total = 0;
  for (;;) {
    const rows = await prisma[cfg.delegate].findMany({
      skip,
      take: CHUNK,
      orderBy: { id: 'asc' },
    });
    if (rows.length === 0) break;
    const data = rows.map((row) => {
      const snap = { [cfg.fk]: row.id, versionId };
      for (const f of cfg.fields) snap[f] = row[f];
      return snap;
    });
    const res = await prisma[cfg.snapshot].createMany({ data, skipDuplicates: true });
    total += res.count;
    skip += rows.length;
    log(`  ${cfg.delegate}: processed ${skip}, inserted ${total} (skipped ${skip - total} existing)`);
    if (rows.length < CHUNK) break;
  }
  return total;
}

async function backfillV1Snapshots(prisma) {
  const baseline = await prisma.taxonomyVersion.findUnique({ where: { tag: BASELINE_TAG } });
  if (!baseline) {
    throw new Error(`Baseline version ${BASELINE_TAG} not found — run prisma migrate deploy first.`);
  }
  log(`Backfilling snapshots into ${BASELINE_TAG} (${baseline.id})...`);
  const summary = {};
  for (const key of Object.keys(FIELD_MAP)) {
    summary[key] = await backfillEntity(prisma, baseline.id, FIELD_MAP[key]);
  }
  log(`Backfill complete: ${JSON.stringify(summary)}`);
  return summary;
}

module.exports = { backfillV1Snapshots };

if (require.main === module) {
  const prisma = require('../db/prisma');
  backfillV1Snapshots(prisma)
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
```

- [ ] **Step 2: Run the backfill against the local DB**

The DB was seeded during earlier dev setup. If unsure, run `cd server && npx prisma db seed` first, then:

Run: `cd server && node scripts/backfill-v1-snapshots.js`
Expected: progress lines per entity ending with `Backfill complete: {"trait":4,"biome":4,"species":3,"ecosystem":3}` (counts match the seed: 4 traits, 4 biomes, 3 species, 3 ecosystems).

- [ ] **Step 3: Verify idempotency — run it again**

Run: `cd server && node scripts/backfill-v1-snapshots.js`
Expected: same progress lines but `inserted 0 (skipped N existing)` per entity, ending `Backfill complete: {"trait":0,"biome":0,"species":0,"ecosystem":0}`.

- [ ] **Step 4: Wire backfill into `dev:setup`**

In `server/package.json`, change the `dev:setup` script (line 24) from:
```json
    "dev:setup": "prisma generate && prisma migrate deploy && prisma db seed",
```
to:
```json
    "dev:setup": "prisma generate && prisma migrate deploy && prisma db seed && node scripts/backfill-v1-snapshots.js",
```

- [ ] **Step 5: Commit**

```bash
git add server/scripts/backfill-v1-snapshots.js server/package.json
git commit -m "feat(db): idempotent chunked v1.0.0 snapshot backfill script"
```

---

## Task 3: Real-Postgres DB test suite

**Files:**
- Create: `server/test/taxonomyVersion.db.test.js`

> These tests require a real Postgres (migrated + seeded + backfilled). They run in the CI `search-db` job (Task 4), NOT the mocked `checks` job. Run locally against the docker DB on 5433.

- [ ] **Step 1: Write the failing test file**

Create `server/test/taxonomyVersion.db.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../db/prisma');
const { backfillV1Snapshots } = require('../scripts/backfill-v1-snapshots');

// Requires a real Postgres (DATABASE_URL), migrated + seeded + backfilled.
// Baseline version v1.0.0 is created by the taxonomy_versioning migration.

const TEST_DRAFT_PREFIX = 'test-draft-';

test.after(async () => {
  await prisma.taxonomyVersion.deleteMany({ where: { tag: { startsWith: TEST_DRAFT_PREFIX } } });
  await prisma.$disconnect();
});

test('baseline v1.0.0 exists and is released', async () => {
  const v = await prisma.taxonomyVersion.findUnique({ where: { tag: 'v1.0.0' } });
  assert.ok(v, 'v1.0.0 must exist');
  assert.equal(v.status, 'released');
});

test('tag uniqueness rejects a duplicate v1.0.0', async () => {
  await assert.rejects(
    () => prisma.taxonomyVersion.create({ data: { tag: 'v1.0.0', status: 'retired' } }),
    (err) => err.code === 'P2002',
    'duplicate tag must violate the unique constraint',
  );
});

test('single-draft partial index allows one draft but rejects a second', async () => {
  await prisma.taxonomyVersion.deleteMany({ where: { tag: { startsWith: TEST_DRAFT_PREFIX } } });
  const first = await prisma.taxonomyVersion.create({
    data: { tag: `${TEST_DRAFT_PREFIX}a`, status: 'draft' },
  });
  assert.equal(first.status, 'draft');
  await assert.rejects(
    () => prisma.taxonomyVersion.create({ data: { tag: `${TEST_DRAFT_PREFIX}b`, status: 'draft' } }),
    (err) => err.code === 'P2002' || /unique/i.test(String(err.message)),
    'a second draft must violate the single-draft partial unique index',
  );
  // cleanup so other runs / tests can create a draft
  await prisma.taxonomyVersion.deleteMany({ where: { tag: { startsWith: TEST_DRAFT_PREFIX } } });
});

test('snapshot FK rejects an unknown versionId', async () => {
  const trait = await prisma.trait.findFirst({ orderBy: { id: 'asc' } });
  assert.ok(trait, 'seed must provide at least one trait');
  await assert.rejects(
    () => prisma.traitVersion.create({
      data: {
        traitId: trait.id,
        versionId: 'does-not-exist',
        slug: trait.slug,
        name: trait.name,
        dataType: trait.dataType,
      },
    }),
    (err) => err.code === 'P2003' || /foreign key/i.test(String(err.message)),
    'unknown versionId must violate the FK constraint',
  );
});

test('backfill produced row-count parity per entity under v1.0.0', async () => {
  const baseline = await prisma.taxonomyVersion.findUnique({ where: { tag: 'v1.0.0' } });
  const pairs = [
    ['trait', 'traitVersion'],
    ['biome', 'biomeVersion'],
    ['species', 'speciesVersion'],
    ['ecosystem', 'ecosystemVersion'],
  ];
  for (const [master, snapshot] of pairs) {
    const masterCount = await prisma[master].count();
    const snapCount = await prisma[snapshot].count({ where: { versionId: baseline.id } });
    assert.equal(snapCount, masterCount, `${snapshot} count must equal ${master} count`);
  }
});

test('re-running backfill is a no-op (idempotent)', async () => {
  const baseline = await prisma.taxonomyVersion.findUnique({ where: { tag: 'v1.0.0' } });
  const before = await prisma.traitVersion.count({ where: { versionId: baseline.id } });
  const summary = await backfillV1Snapshots(prisma);
  const after = await prisma.traitVersion.count({ where: { versionId: baseline.id } });
  assert.equal(after, before, 'snapshot count must not change on re-run');
  assert.equal(summary.trait, 0, 'second backfill must insert zero trait snapshots');
});
```

- [ ] **Step 2: Run the suite against the local DB**

Run: `cd server && node -e "require('./test/taxonomyVersion.db.test.js')"`
Expected: all 6 tests pass (`# pass 6`, `# fail 0`).

- [ ] **Step 3: Commit**

```bash
git add server/test/taxonomyVersion.db.test.js
git commit -m "test(db): TaxonomyVersion constraints + backfill parity DB suite"
```

---

## Task 4: Schema doc regen + CI wiring + full-suite green

**Files:**
- Modify: `docs/schema-reference.md` (regenerated, not hand-edited)
- Modify: `.github/workflows/backend-and-frontend-tests.yml:70` (search-db job)

- [ ] **Step 1: Regenerate the schema reference doc**

Run: `cd server && npm run schema:doc`
Expected: `Wrote .../docs/schema-reference.md (... chars)`. The doc now lists `TaxonomyVersion` + the 4 `*Version` models + the `TaxonomyVersionStatus` enum.

- [ ] **Step 2: Verify the doc-sync gate passes**

Run: `cd server && npm run schema:doc:check`
Expected: `schema-reference.md is up-to-date`

- [ ] **Step 3: Add backfill + DB-test steps to the CI `search-db` job**

In `.github/workflows/backend-and-frontend-tests.yml`, the `search-db` job currently ends with the `Run fuzzy-search DB smoke` step (line ~71-73). Append two steps after it (same indentation, after the `Seed database` step so masters exist):

```yaml
      - name: Backfill v1.0.0 snapshots
        working-directory: server
        run: node scripts/backfill-v1-snapshots.js
      - name: Run taxonomy-version DB tests
        working-directory: server
        run: node -e "require('./test/taxonomyVersion.db.test.js')"
```

Place these immediately after the existing `Seed database` step and before (or after) the `Run fuzzy-search DB smoke` step — order is fine as long as backfill runs after seed. Recommended: put backfill right after `Seed database`, and the DB-test step last.

- [ ] **Step 4: Run the full mocked backend suite — assert zero regression**

Run: `cd server && npm test`
Expected: every test file in `test/run-tests.js` passes, no drop from the current `test()` count. (Pre-existing `records.test.js` undici `AbortSignal` failures, if present locally, are a known env issue per the handoff — confirm the count/behavior is unchanged from `main`, not newly broken by this work.)

- [ ] **Step 5: Commit**

```bash
git add docs/schema-reference.md .github/workflows/backend-and-frontend-tests.yml
git commit -m "ci(db): regen schema doc + run snapshot backfill/tests in search-db job"
```

---

## Task 5: RFC status flip + open the PR

**Files:**
- Modify: `docs/rfc/2026-05-21-schema-versioning.md` (Status line + Acceptance criteria checkboxes)

- [ ] **Step 1: Flip RFC status to IN-PROGRESS and tick the Phase A acceptance criteria**

In `docs/rfc/2026-05-21-schema-versioning.md`:
- Change the `**Status**:` line (line 5) to: `**Status**: IN-PROGRESS — Phase A landing (merge SHA: <fill post-merge>)`
- In the "Acceptance criteria (for Phase A landing)" section, change each `- [ ]` to `- [x]` for the criteria this PR satisfies (model + enum; 4 snapshot models; migration SQL with partial index, no master changes; seed v1.0.0 + chunked backfill; schema-reference regen; 5+ unit tests; existing suite green). Leave "Phase A merge SHA" note to fill after merge.

- [ ] **Step 2: Commit**

```bash
git add docs/rfc/2026-05-21-schema-versioning.md
git commit -m "docs(rfc): RFC #1 status IN-PROGRESS, Phase A acceptance ticked"
```

- [ ] **Step 3: Push the branch and open the PR**

> **Pre-merge protocol (CLAUDE.md, MANDATORY):** after CI runs, before squash-merge, triage inline review comments via
> `gh api repos/MasterDD-L34D/Game-Database/pulls/<N>/comments --jq '.[] | "[\(.user.login)] \(.path):\(.line // "?") :: \(.body)"'`
> Fix P1/P2 on the same branch, re-run CI, then merge. Do not merge without checking comments.

```bash
git push -u origin HEAD
gh pr create --title "feat(db): schema versioning Phase A — TaxonomyVersion + snapshot tables (RFC #1)" --body "..."
```

- [ ] **Step 4: Post-merge — fill the merge SHA**

After squash-merge, update `docs/rfc/2026-05-21-schema-versioning.md` Status line with the actual merge SHA, and update the spec `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` § Fase 3 schema-versioning with the Phase A merge SHA + status flip to IN-PROGRESS (per acceptance criteria final bullet). Commit `docs(spec): RFC #1 Phase A merged <sha>`.

---

## Self-Review

**Spec coverage (RFC Acceptance criteria → task):**
- `TaxonomyVersion` model + `TaxonomyVersionStatus` enum → Task 1 Steps 1, 3 ✓
- 4 snapshot models (Record excluded) → Task 1 Step 4 ✓
- Migration: CREATE TABLE + partial unique index, no master column changes → Task 1 Steps 6-7 (Prisma DDL + appended partial index; back-relations are virtual, no columns) ✓
- Seed v1.0.0 released + chunked backfill with progress log → Task 1 Step 7 (INSERT) + Task 2 (chunked script, 1000-row, line-logged) ✓
- `docs/schema-reference.md` regenerated (CI gate) → Task 4 Steps 1-2 ✓
- 5+ unit tests (tag uniqueness, single-draft, snapshot FK, parity) → Task 3 (6 tests) ✓
- Existing backend suite green (no drop) → Task 4 Step 4 ✓
- Spec doc updated with merge SHA + IN-PROGRESS → Task 5 Steps 1, 4 ✓

**Placeholder scan:** PR `--body "..."` in Task 5 Step 3 is the only intentional placeholder (PR description is author-written at creation time); merge SHA is genuinely unknown pre-merge. No code-step placeholders.

**Type consistency:** Snapshot field lists in `FIELD_MAP` (Task 2) match the snapshot model scalars (Task 1 Step 4) and the master scalars in `schema.prisma` exactly. FK names (`traitId`/`biomeId`/`speciesId`/`ecosystemId`) and snapshot delegate names (`traitVersion` etc.) are consistent across the backfill script (Task 2), the test suite (Task 3), and the schema (Task 1). `backfillV1Snapshots(prisma)` signature matches its import in the test (Task 3 Step 1) and CLI wrapper (Task 2 Step 1).

**Risk notes:**
- The partial unique index uses `((1)) WHERE "status" = 'draft'` — a constant-expression index that permits at most one row matching the predicate. Verified against RFC §1 SQL.
- `onDelete: Cascade` on snapshot→master is intentional for Phase A (no deletes occur — masters untouched). The hard-delete-drops-history concern (Q7) is explicitly deferred to Phase B soft-delete; do not add `deletedAt` here.
- Backfill idempotency relies on `@@unique([<entity>Id, versionId])` + `skipDuplicates: true`. Both must be present for re-runs to be no-ops.
