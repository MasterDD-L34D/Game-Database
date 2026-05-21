# Schema Versioning Phase B1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the taxonomy version lifecycle (create draft → release → retire/delete) with a full-snapshot-on-release write-path, so an admin can cut a named immutable `vX.Y.Z` snapshot of the current taxonomy.

**Architecture:** A shared `versionSnapshot.js` util holds the master→snapshot field mapping + chunked copy logic, reused by the Phase A backfill script AND the new release endpoint (one frozen-field source). A new `taxonomyVersions.js` Express router exposes 6 endpoints under `/api/taxonomy/versions`; release runs `snapshotAllMasters` inside a `$transaction`. No schema/migration change (Phase A already added the tables + single-draft partial index). No per-mutation tagging, no soft-delete, no UI, no read-path filter (those are B2/B3/Phase C).

**Tech Stack:** Express 4, Prisma 5 + PostgreSQL 16, `node:test`. Mocked route tests run in the `checks` CI job (no PG); a real-Postgres lifecycle test runs in the `search-db` job.

**Spec:** `docs/superpowers/specs/2026-05-21-schema-versioning-phase-b1-design.md`.

---

## File Structure

- **Create** `server/utils/versionSnapshot.js` — `FIELD_MAP` + `snapshotEntity` + `snapshotAllMasters` + `baselineSnapshotCount`. Single source of the frozen field lists + chunked master→snapshot copy.
- **Modify** `server/scripts/backfill-v1-snapshots.js` — import the above instead of defining them locally (behavior unchanged).
- **Create** `server/routes/taxonomyVersions.js` — the 6 lifecycle endpoints.
- **Modify** `server/app.js` — mount the router at `/api/taxonomy/versions`.
- **Modify** `server/test/utils.js` — extend the taxonomy test context with a `taxonomyVersion` store + `$transaction` + `*Version.createMany`/`count` so the route is testable without Postgres.
- **Create** `server/test/taxonomyVersions.test.js` — mocked lifecycle tests; register in `server/test/run-tests.js`.
- **Modify** `server/test/run-tests.js` — add the mocked test file.
- **Create** `server/test/taxonomyVersions.db.test.js` — real-Postgres lifecycle + parity test.
- **Modify** `.github/workflows/backend-and-frontend-tests.yml` — run the new DB test in the `search-db` job.

---

## Task 1: Shared `versionSnapshot.js` util + backfill refactor

**Files:**
- Create: `server/utils/versionSnapshot.js`
- Modify: `server/scripts/backfill-v1-snapshots.js`

- [ ] **Step 1: Create the shared util**

Create `server/utils/versionSnapshot.js` with the exact content below. `FIELD_MAP`, `snapshotEntity`, and `baselineSnapshotCount` are moved verbatim from the backfill script; `snapshotAllMasters` is the new shared entry point used by both backfill and the release endpoint.

```js
'use strict';
// Shared taxonomy-version snapshot logic: the master->snapshot field mapping
// plus the chunked copy used by BOTH the Phase A backfill script and the
// Phase B1 release endpoint. One frozen-field source avoids drift.

const CHUNK = 1000;

// Frozen v1.0.0 scalar field set. Do NOT sync this to future schema changes:
// a snapshot must capture the columns as they existed at release time.
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

// Copy every row of one master into its *Version table under versionId, in
// CHUNK-sized batches. `client` is the prisma singleton OR a $transaction tx.
// `log` is an optional progress callback. Returns the inserted-row count.
async function snapshotEntity(client, versionId, cfg, log = () => {}) {
  let skip = 0;
  let total = 0;
  for (;;) {
    const rows = await client[cfg.delegate].findMany({ skip, take: CHUNK, orderBy: { id: 'asc' } });
    if (rows.length === 0) break;
    const data = rows.map((row) => {
      const snap = { [cfg.fk]: row.id, versionId };
      for (const f of cfg.fields) snap[f] = row[f];
      return snap;
    });
    const res = await client[cfg.snapshot].createMany({ data, skipDuplicates: true });
    total += res.count;
    skip += rows.length;
    log(`  ${cfg.delegate}: processed ${skip}, inserted ${total} (skipped ${skip - total} existing)`);
    if (rows.length < CHUNK) break;
  }
  return total;
}

// Snapshot all 4 masters into versionId. Returns { trait, biome, species, ecosystem } counts.
async function snapshotAllMasters(client, versionId, log = () => {}) {
  const summary = {};
  for (const key of Object.keys(FIELD_MAP)) {
    summary[key] = await snapshotEntity(client, versionId, FIELD_MAP[key], log);
  }
  return summary;
}

// Total existing snapshot rows for a version, across all 4 snapshot tables.
async function baselineSnapshotCount(client, versionId) {
  const counts = await Promise.all(
    Object.values(FIELD_MAP).map((cfg) => client[cfg.snapshot].count({ where: { versionId } })),
  );
  return counts.reduce((sum, n) => sum + n, 0);
}

module.exports = { CHUNK, FIELD_MAP, snapshotEntity, snapshotAllMasters, baselineSnapshotCount };
```

- [ ] **Step 2: Refactor the backfill script to import from the util**

Replace the top of `server/scripts/backfill-v1-snapshots.js` (the `CHUNK`/`FIELD_MAP`/`snapshotEntity`(named `backfillEntity`)/`baselineSnapshotCount` definitions) so it imports them. The full new file content:

```js
#!/usr/bin/env node
'use strict';
// RFC #1 Phase A backfill: copy every master row into its *Version snapshot
// table under the baseline v1.0.0 version. Idempotent (createMany +
// skipDuplicates), chunked, line-buffered progress log.
//
// Runs once: if the v1.0.0 baseline already holds any snapshot, the backfill is
// skipped. Otherwise re-running after new master rows were created (e.g.
// `dev:setup` re-invokes this script) would append those newer rows into the
// *released* baseline, mutating what v1.0.0 means. The first run defines
// v1.0.0; later runs are no-ops.

const { FIELD_MAP, snapshotAllMasters, baselineSnapshotCount } = require('../utils/versionSnapshot');

const BASELINE_TAG = 'v1.0.0';

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

async function backfillV1Snapshots(prisma) {
  const baseline = await prisma.taxonomyVersion.findUnique({ where: { tag: BASELINE_TAG } });
  if (!baseline) {
    throw new Error(`Baseline version ${BASELINE_TAG} not found -- run prisma migrate deploy first.`);
  }
  const zeroSummary = Object.fromEntries(Object.keys(FIELD_MAP).map((key) => [key, 0]));

  const existing = await baselineSnapshotCount(prisma, baseline.id);
  if (existing > 0) {
    log(`Baseline ${BASELINE_TAG} already holds ${existing} snapshot(s); skipping backfill to keep the released baseline immutable.`);
    return zeroSummary;
  }

  log(`Backfilling snapshots into ${BASELINE_TAG} (${baseline.id})...`);
  const summary = await snapshotAllMasters(prisma, baseline.id, log);
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

- [ ] **Step 3: Verify the refactor is behavior-preserving (ASCII + backfill + existing DB test)**

Run from `C:/dev/Game-Database/server`:
```
node -e "['utils/versionSnapshot.js','scripts/backfill-v1-snapshots.js'].forEach(f=>console.log(f, /[^\x00-\x7F]/.test(require('fs').readFileSync(f,'utf8'))?'NON-ASCII':'ASCII-OK'))"
node scripts/backfill-v1-snapshots.js
node -e "require('./test/taxonomyVersion.db.test.js')"
```
Expected: both files `ASCII-OK`; backfill prints `already holds N snapshot(s); skipping` (baseline already populated locally); `taxonomyVersion.db.test.js` → `pass 6 / fail 0`.

- [ ] **Step 4: Commit**

```
git add server/utils/versionSnapshot.js server/scripts/backfill-v1-snapshots.js
git commit -m "refactor(db): extract versionSnapshot util shared by backfill + release"
```

---

## Task 2: Extend the taxonomy test context with version mocks

**Files:**
- Modify: `server/test/utils.js`

> The route is tested without Postgres in the `checks` job. The existing context (`createTaxonomyTestContext`) already mocks masters + a released-guard `*Version.count`. This task adds: a `taxonomyVersion` store (CRUD/find/count), a `$transaction` passthrough, and `*Version.createMany` + a `versionId`-aware `*Version.count`, so the create/release/retire/delete/list/get paths run in-memory.

- [ ] **Step 1: Add version + snapshot stores and counter**

In `server/test/utils.js`, inside `createTaxonomyTestContext()`, locate the `releasedSnapshots` declaration (added in commit 79ad565):

```js
  const releasedSnapshots = {
    species: new Set(),
    trait: new Set(),
    biome: new Set(),
    ecosystem: new Set(),
  };
```

Immediately after it, add:

```js
  // Phase B1: in-memory TaxonomyVersion rows + snapshot rows for route tests.
  const versionStore = new Map(); // id -> version row
  let versionCounter = 1;
  const snapshotRows = {
    traitVersion: [],
    biomeVersion: [],
    speciesVersion: [],
    ecosystemVersion: [],
  };
```

- [ ] **Step 2: Capture originals for restore**

In the same function, find the `original` object literal that begins:

```js
  const original = {
    auditLog: {
      create: prisma.auditLog?.create,
    },
    traitVersion: { count: prisma.traitVersion?.count },
    biomeVersion: { count: prisma.biomeVersion?.count },
    speciesVersion: { count: prisma.speciesVersion?.count },
    ecosystemVersion: { count: prisma.ecosystemVersion?.count },
```

Change those four `*Version` lines to also capture `create`/`createMany`, and add a `taxonomyVersion` + `$transaction` capture. Replace the five lines above (the four `*Version` lines) with:

```js
    traitVersion: { count: prisma.traitVersion?.count, createMany: prisma.traitVersion?.createMany },
    biomeVersion: { count: prisma.biomeVersion?.count, createMany: prisma.biomeVersion?.createMany },
    speciesVersion: { count: prisma.speciesVersion?.count, createMany: prisma.speciesVersion?.createMany },
    ecosystemVersion: { count: prisma.ecosystemVersion?.count, createMany: prisma.ecosystemVersion?.createMany },
    taxonomyVersion: {
      create: prisma.taxonomyVersion?.create,
      findUnique: prisma.taxonomyVersion?.findUnique,
      findFirst: prisma.taxonomyVersion?.findFirst,
      findMany: prisma.taxonomyVersion?.findMany,
      update: prisma.taxonomyVersion?.update,
      delete: prisma.taxonomyVersion?.delete,
    },
    $transaction: prisma.$transaction,
```

- [ ] **Step 3: Replace `createVersionMock` with a version-aware mock**

Find the existing `createVersionMock` function (added in 79ad565):

```js
  function createVersionMock(model) {
    const fk = `${model}Id`;
    const delegate = `${model}Version`;
    prisma[delegate] = prisma[delegate] || {};
    prisma[delegate].count = async ({ where = {} } = {}) => {
      const isReleased = where.version && where.version.status === 'released';
      const masterId = where[fk];
      return isReleased && masterId != null && releasedSnapshots[model].has(masterId) ? 1 : 0;
    };
  }
```

Replace it with (adds `createMany` + makes `count` handle the `where.versionId` shape used by the release/get paths, while preserving the released-guard shape):

```js
  function createVersionMock(model) {
    const fk = `${model}Id`;
    const delegate = `${model}Version`;
    prisma[delegate] = prisma[delegate] || {};
    prisma[delegate].count = async ({ where = {} } = {}) => {
      if (where.versionId !== undefined) {
        return snapshotRows[delegate].filter((r) => r.versionId === where.versionId).length;
      }
      const isReleased = where.version && where.version.status === 'released';
      const masterId = where[fk];
      return isReleased && masterId != null && releasedSnapshots[model].has(masterId) ? 1 : 0;
    };
    prisma[delegate].createMany = async ({ data = [] } = {}) => {
      for (const row of data) snapshotRows[delegate].push(row);
      return { count: data.length };
    };
  }
```

- [ ] **Step 4: Add a `taxonomyVersion` delegate mock + `$transaction` passthrough**

In the `mock()` function, find where the version mocks are created:

```js
    createVersionMock('species');
    createVersionMock('trait');
    createVersionMock('biome');
    createVersionMock('ecosystem');
```

Immediately after those four lines, add:

```js
    prisma.$transaction = async (fn) => fn(prisma);
    prisma.taxonomyVersion = prisma.taxonomyVersion || {};
    prisma.taxonomyVersion.create = async ({ data }) => {
      if ([...versionStore.values()].some((v) => v.tag === data.tag)) {
        const err = new Error('Unique constraint failed');
        err.code = 'P2002';
        err.meta = { target: ['tag'] };
        throw err;
      }
      const id = `ver-${versionCounter}`;
      versionCounter += 1;
      const row = {
        id,
        tag: data.tag,
        status: data.status || 'draft',
        description: data.description ?? null,
        releasedAt: data.releasedAt ?? null,
        releasedBy: data.releasedBy ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      versionStore.set(id, { ...row });
      return { ...row };
    };
    prisma.taxonomyVersion.findUnique = async ({ where = {} } = {}) => {
      if (where.id) return versionStore.has(where.id) ? { ...versionStore.get(where.id) } : null;
      if (where.tag) {
        const found = [...versionStore.values()].find((v) => v.tag === where.tag);
        return found ? { ...found } : null;
      }
      return null;
    };
    prisma.taxonomyVersion.findFirst = async ({ where = {} } = {}) => {
      const found = [...versionStore.values()].find((v) => !where.status || v.status === where.status);
      return found ? { ...found } : null;
    };
    prisma.taxonomyVersion.findMany = async ({ where = {} } = {}) => {
      let rows = [...versionStore.values()];
      if (where.status && where.status.not) rows = rows.filter((v) => v.status !== where.status.not);
      rows.sort((a, b) => {
        const av = a.releasedAt ? a.releasedAt.getTime() : Infinity;
        const bv = b.releasedAt ? b.releasedAt.getTime() : Infinity;
        return bv - av; // releasedAt desc, nulls (drafts) first
      });
      return rows.map((v) => ({ ...v }));
    };
    prisma.taxonomyVersion.update = async ({ where = {}, data = {} } = {}) => {
      const row = versionStore.get(where.id);
      if (!row) {
        const err = new Error('Record to update not found.');
        err.code = 'P2025';
        throw err;
      }
      const updated = { ...row, ...data, updatedAt: new Date() };
      versionStore.set(where.id, updated);
      return { ...updated };
    };
    prisma.taxonomyVersion.delete = async ({ where = {} } = {}) => {
      const row = versionStore.get(where.id);
      if (!row) {
        const err = new Error('Record to delete does not exist.');
        err.code = 'P2025';
        throw err;
      }
      versionStore.delete(where.id);
      return { ...row };
    };
```

- [ ] **Step 5: Restore + reset the new mocks**

In `restore()`, find the loop that restores `*Version.count`:

```js
    for (const delegate of ['traitVersion', 'biomeVersion', 'speciesVersion', 'ecosystemVersion']) {
      if (original[delegate] && original[delegate].count) prisma[delegate].count = original[delegate].count;
      else if (prisma[delegate]) delete prisma[delegate].count;
    }
```

Replace it with (also restores `createMany`, `taxonomyVersion`, and `$transaction`):

```js
    for (const delegate of ['traitVersion', 'biomeVersion', 'speciesVersion', 'ecosystemVersion']) {
      if (original[delegate] && original[delegate].count) prisma[delegate].count = original[delegate].count;
      else if (prisma[delegate]) delete prisma[delegate].count;
      if (original[delegate] && original[delegate].createMany) prisma[delegate].createMany = original[delegate].createMany;
      else if (prisma[delegate]) delete prisma[delegate].createMany;
    }
    if (original.$transaction) prisma.$transaction = original.$transaction;
    if (prisma.taxonomyVersion) {
      for (const op of ['create', 'findUnique', 'findFirst', 'findMany', 'update', 'delete']) {
        if (original.taxonomyVersion && original.taxonomyVersion[op]) prisma.taxonomyVersion[op] = original.taxonomyVersion[op];
        else delete prisma.taxonomyVersion[op];
      }
    }
```

In `reset()`, find the `releasedSnapshots.*.clear()` lines:

```js
    releasedSnapshots.species.clear();
    releasedSnapshots.trait.clear();
    releasedSnapshots.biome.clear();
    releasedSnapshots.ecosystem.clear();
```

Immediately after them, add:

```js
    versionStore.clear();
    versionCounter = 1;
    snapshotRows.traitVersion.length = 0;
    snapshotRows.biomeVersion.length = 0;
    snapshotRows.speciesVersion.length = 0;
    snapshotRows.ecosystemVersion.length = 0;
```

- [ ] **Step 6: Verify the existing mocked suite still passes (no regression from the mock changes)**

Run from `server`: `node -e "require('./test/versionImmutability.test.js')"`
Expected: `pass 8 / fail 0` (the released-guard `*Version.count` shape still works).

- [ ] **Step 7: Commit**

```
git add server/test/utils.js
git commit -m "test(db): extend taxonomy test context with TaxonomyVersion mocks"
```

---

## Task 3: Router scaffold + GET endpoints + POST create-draft

**Files:**
- Create: `server/routes/taxonomyVersions.js`
- Modify: `server/app.js`
- Create: `server/test/taxonomyVersions.test.js`
- Modify: `server/test/run-tests.js`

- [ ] **Step 1: Write the failing mocked test (create + list + get + auth)**

Create `server/test/taxonomyVersions.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, closeServer, createTaxonomyTestContext } = require('./utils');

const taxonomy = createTaxonomyTestContext();
taxonomy.mock();

if (typeof test.after === 'function') test.after(() => taxonomy.restore());
else process.on('exit', taxonomy.restore);
if (typeof test.beforeEach === 'function') test.beforeEach(() => taxonomy.reset());

const ADMIN = { 'X-Roles': 'admin', 'Content-Type': 'application/json' };
const WRITER = { 'X-Roles': 'taxonomy:write', 'Content-Type': 'application/json' };

async function createDraft(baseUrl, tag, headers = ADMIN) {
  return fetch(`${baseUrl}/api/taxonomy/versions`, {
    method: 'POST', headers, body: JSON.stringify({ tag }),
  });
}

test('POST creates a draft with a valid semver tag', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const res = await createDraft(baseUrl, 'v1.1.0');
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.version.tag, 'v1.1.0');
    assert.equal(body.version.status, 'draft');
  } finally { await closeServer(server); }
});

test('POST rejects an invalid tag (400)', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const res = await createDraft(baseUrl, 'not-semver');
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'VALIDATION_ERROR');
  } finally { await closeServer(server); }
});

test('POST rejects a duplicate tag (409 TAG_EXISTS)', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    // release the first so the duplicate fails on tag, not on single-draft
    await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0/release`, { method: 'POST', headers: ADMIN });
    const res = await createDraft(baseUrl, 'v1.1.0');
    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, 'TAG_EXISTS');
  } finally { await closeServer(server); }
});

test('POST rejects a second draft (409 DRAFT_EXISTS)', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    const res = await createDraft(baseUrl, 'v1.2.0');
    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, 'DRAFT_EXISTS');
  } finally { await closeServer(server); }
});

test('POST requires admin (403 for taxonomy:write)', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const res = await createDraft(baseUrl, 'v1.1.0', WRITER);
    assert.equal(res.status, 403);
  } finally { await closeServer(server); }
});

test('GET / lists versions and hides retired by default', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0/release`, { method: 'POST', headers: ADMIN });
    await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0/retire`, { method: 'POST', headers: ADMIN });
    const def = await (await fetch(`${baseUrl}/api/taxonomy/versions`)).json();
    assert.equal(def.versions.length, 0, 'retired hidden by default');
    const all = await (await fetch(`${baseUrl}/api/taxonomy/versions?includeRetired=true`)).json();
    assert.equal(all.versions.length, 1);
  } finally { await closeServer(server); }
});

test('GET /:tag returns version + per-entity counts', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    const res = await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.version.tag, 'v1.1.0');
    assert.deepEqual(body.counts, { trait: 0, biome: 0, species: 0, ecosystem: 0 });
  } finally { await closeServer(server); }
});

test('GET /:tag 404 for unknown tag', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/taxonomy/versions/v9.9.9`);
    assert.equal(res.status, 404);
  } finally { await closeServer(server); }
});
```

- [ ] **Step 2: Register the test + run it to confirm it fails**

In `server/test/run-tests.js`, add `'taxonomyVersions.test.js',` to the `testFiles` array (place it right after `'versionImmutability.test.js',`).

Run from `server`: `node -e "require('./test/taxonomyVersions.test.js')"`
Expected: FAIL (routes don't exist yet → 404s / assertion failures).

- [ ] **Step 3: Create the router (GET list, GET :tag, POST create) — release/retire/delete added in later tasks but include them now as the full file**

Create `server/routes/taxonomyVersions.js`:

```js
const express = require('express');
const prisma = require('../db/prisma');
const { requireRole } = require('../middleware/permissions');
const { logAudit } = require('../utils/audit');
const { AppError, sendError, handleError } = require('../utils/httpErrors');
const { assertString } = require('../utils/validation');
const { snapshotAllMasters, FIELD_MAP } = require('../utils/versionSnapshot');

const router = express.Router();
const requireAdmin = requireRole('admin');
const SEMVER_RE = /^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

function validateTag(body) {
  const tag = assertString(body.tag, 'tag', { required: true });
  if (!SEMVER_RE.test(tag)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'tag must be semver-like (e.g. v1.2.0, v2.0.0-rc1)', { field: 'tag', location: 'body' });
  }
  return tag;
}

async function snapshotCounts(versionId) {
  const entries = await Promise.all(
    Object.entries(FIELD_MAP).map(async ([key, cfg]) => [key, await prisma[cfg.snapshot].count({ where: { versionId } })]),
  );
  return Object.fromEntries(entries);
}

router.get('/', async (req, res) => {
  try {
    const includeRetired = req.query.includeRetired === 'true';
    const where = includeRetired ? {} : { status: { not: 'retired' } };
    const versions = await prisma.taxonomyVersion.findMany({
      where,
      orderBy: { releasedAt: { sort: 'desc', nulls: 'first' } },
    });
    return res.json({ versions });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tag', async (req, res) => {
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: req.params.tag } });
    if (!version) return sendError(res, 404, 'NOT_FOUND', 'Version not found', { tag: req.params.tag });
    const counts = await snapshotCounts(version.id);
    return res.json({ version, counts });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const tag = validateTag(req.body);
    const description = assertString(req.body.description, 'description') ?? null;

    const existingDraft = await prisma.taxonomyVersion.findFirst({ where: { status: 'draft' } });
    if (existingDraft) {
      return sendError(res, 409, 'DRAFT_EXISTS', `A draft (${existingDraft.tag}) already exists; release or delete it first`);
    }

    let created;
    try {
      created = await prisma.taxonomyVersion.create({ data: { tag, description, status: 'draft' } });
    } catch (err) {
      if (err.code === 'P2002') return sendError(res, 409, 'TAG_EXISTS', 'Version tag already exists', { tag });
      throw err;
    }

    await logAudit(req, 'TaxonomyVersion', created.id, 'CREATE', { tag, status: 'draft' });
    return res.status(201).json({ version: created });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:tag/release', requireAdmin, async (req, res) => {
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: req.params.tag } });
    if (!version) return sendError(res, 404, 'NOT_FOUND', 'Version not found', { tag: req.params.tag });
    if (version.status !== 'draft') {
      return sendError(res, 409, 'INVALID_STATE', `Only a draft can be released (status=${version.status})`);
    }
    const releasedBy = req.user || null;
    const counts = await prisma.$transaction(async (tx) => {
      const c = await snapshotAllMasters(tx, version.id);
      await tx.taxonomyVersion.update({
        where: { id: version.id },
        data: { status: 'released', releasedAt: new Date(), releasedBy },
      });
      return c;
    });
    const updated = await prisma.taxonomyVersion.findUnique({ where: { id: version.id } });
    await logAudit(req, 'TaxonomyVersion', version.id, 'UPDATE', { tag: version.tag, status: 'released', counts });
    return res.json({ version: updated, counts });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:tag/retire', requireAdmin, async (req, res) => {
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: req.params.tag } });
    if (!version) return sendError(res, 404, 'NOT_FOUND', 'Version not found', { tag: req.params.tag });
    if (version.status !== 'released') {
      return sendError(res, 409, 'INVALID_STATE', `Only a released version can be retired (status=${version.status})`);
    }
    const updated = await prisma.taxonomyVersion.update({ where: { id: version.id }, data: { status: 'retired' } });
    await logAudit(req, 'TaxonomyVersion', version.id, 'UPDATE', { tag: version.tag, status: 'retired' });
    return res.json({ version: updated });
  } catch (error) {
    return handleError(res, error);
  }
});

router.delete('/:tag', requireAdmin, async (req, res) => {
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: req.params.tag } });
    if (!version) return sendError(res, 404, 'NOT_FOUND', 'Version not found', { tag: req.params.tag });
    if (version.status !== 'draft') {
      return sendError(res, 409, 'INVALID_STATE', `Only a draft can be deleted (status=${version.status})`);
    }
    await prisma.taxonomyVersion.delete({ where: { id: version.id } });
    await logAudit(req, 'TaxonomyVersion', version.id, 'DELETE', { tag: version.tag, status: version.status });
    return res.json({ success: true, tag: version.tag });
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
```

- [ ] **Step 4: Mount the router in `app.js`**

In `server/app.js`, add the require near the other route requires (after line `const auditRouter = require('./routes/audit');`):
```js
const taxonomyVersionsRouter = require('./routes/taxonomyVersions');
```
And add the mount in the `app.use` block (after `app.use('/api/audit', auditRouter);`):
```js
  app.use('/api/taxonomy/versions', taxonomyVersionsRouter);
```

- [ ] **Step 5: Run the test to confirm it passes**

Run from `server`: `node -e "require('./test/taxonomyVersions.test.js')"`
Expected: `pass 8 / fail 0`.

- [ ] **Step 6: Commit**

```
git add server/routes/taxonomyVersions.js server/app.js server/test/taxonomyVersions.test.js server/test/run-tests.js
git commit -m "feat(api): taxonomy version lifecycle endpoints (create/list/get)"
```

---

## Task 4: Release + retire + delete mocked tests

**Files:**
- Modify: `server/test/taxonomyVersions.test.js`

> The router already contains release/retire/delete (written whole in Task 3). This task adds the remaining mocked tests for those paths.

- [ ] **Step 1: Add the release/retire/delete tests**

Append to `server/test/taxonomyVersions.test.js` (before the file end), seeding a couple of masters via the context so release has something to snapshot:

```js
test('release flips draft -> released and snapshots masters (counts)', async () => {
  taxonomy.reset();
  taxonomy.createTrait({ name: 'T1' });
  taxonomy.createBiome({ name: 'B1' });
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    const res = await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0/release`, { method: 'POST', headers: ADMIN });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.version.status, 'released');
    assert.ok(body.version.releasedAt, 'releasedAt set');
    assert.equal(body.counts.trait, 1);
    assert.equal(body.counts.biome, 1);
  } finally { await closeServer(server); }
});

test('release on a non-draft is rejected (409 INVALID_STATE)', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0/release`, { method: 'POST', headers: ADMIN });
    const res = await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0/release`, { method: 'POST', headers: ADMIN });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, 'INVALID_STATE');
  } finally { await closeServer(server); }
});

test('retire on a non-released is rejected (409)', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    const res = await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0/retire`, { method: 'POST', headers: ADMIN });
    assert.equal(res.status, 409);
  } finally { await closeServer(server); }
});

test('DELETE removes a draft but not a released version', async () => {
  taxonomy.reset();
  const { server, baseUrl } = await startServer();
  try {
    await createDraft(baseUrl, 'v1.1.0');
    const okDel = await fetch(`${baseUrl}/api/taxonomy/versions/v1.1.0`, { method: 'DELETE', headers: ADMIN });
    assert.equal(okDel.status, 200);

    await createDraft(baseUrl, 'v1.2.0');
    await fetch(`${baseUrl}/api/taxonomy/versions/v1.2.0/release`, { method: 'POST', headers: ADMIN });
    const badDel = await fetch(`${baseUrl}/api/taxonomy/versions/v1.2.0`, { method: 'DELETE', headers: ADMIN });
    assert.equal(badDel.status, 409);
  } finally { await closeServer(server); }
});
```

- [ ] **Step 2: Run the test to confirm all pass**

Run from `server`: `node -e "require('./test/taxonomyVersions.test.js')"`
Expected: `pass 12 / fail 0`.

- [ ] **Step 3: Commit**

```
git add server/test/taxonomyVersions.test.js
git commit -m "test(api): cover version release/retire/delete paths"
```

---

## Task 5: Real-Postgres lifecycle + parity test + CI wiring

**Files:**
- Create: `server/test/taxonomyVersions.db.test.js`
- Modify: `.github/workflows/backend-and-frontend-tests.yml`

- [ ] **Step 1: Write the real-PG lifecycle test**

Create `server/test/taxonomyVersions.db.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, closeServer } = require('./utils');
const prisma = require('../db/prisma');

// Requires a real Postgres (migrated + seeded + backfilled). Exercises the full
// version lifecycle and the release snapshot parity against live masters.

const ADMIN = { 'X-Roles': 'admin', 'Content-Type': 'application/json' };
const TAG = 'v9.9.9-b1test';

test.after(async () => {
  try {
    const v = await prisma.taxonomyVersion.findUnique({ where: { tag: TAG } });
    if (v) {
      await prisma.traitVersion.deleteMany({ where: { versionId: v.id } });
      await prisma.biomeVersion.deleteMany({ where: { versionId: v.id } });
      await prisma.speciesVersion.deleteMany({ where: { versionId: v.id } });
      await prisma.ecosystemVersion.deleteMany({ where: { versionId: v.id } });
      await prisma.taxonomyVersion.delete({ where: { id: v.id } });
    }
  } finally {
    await prisma.$disconnect();
  }
});

test('full lifecycle: create draft -> release (parity) -> retire', async () => {
  const { server, baseUrl } = await startServer();
  try {
    // clean any leftover from a prior failed run
    const prior = await prisma.taxonomyVersion.findUnique({ where: { tag: TAG } });
    if (prior) {
      await prisma.traitVersion.deleteMany({ where: { versionId: prior.id } });
      await prisma.biomeVersion.deleteMany({ where: { versionId: prior.id } });
      await prisma.speciesVersion.deleteMany({ where: { versionId: prior.id } });
      await prisma.ecosystemVersion.deleteMany({ where: { versionId: prior.id } });
      await prisma.taxonomyVersion.delete({ where: { id: prior.id } });
    }

    const created = await fetch(`${baseUrl}/api/taxonomy/versions`, {
      method: 'POST', headers: ADMIN, body: JSON.stringify({ tag: TAG }),
    });
    assert.equal(created.status, 201);

    const rel = await fetch(`${baseUrl}/api/taxonomy/versions/${TAG}/release`, { method: 'POST', headers: ADMIN });
    assert.equal(rel.status, 200);
    const relBody = await rel.json();
    assert.equal(relBody.version.status, 'released');

    // parity: snapshot counts equal current master counts
    const [traits, biomes, species, ecosystems] = await Promise.all([
      prisma.trait.count(), prisma.biome.count(), prisma.species.count(), prisma.ecosystem.count(),
    ]);
    assert.equal(relBody.counts.trait, traits);
    assert.equal(relBody.counts.biome, biomes);
    assert.equal(relBody.counts.species, species);
    assert.equal(relBody.counts.ecosystem, ecosystems);

    const ret = await fetch(`${baseUrl}/api/taxonomy/versions/${TAG}/retire`, { method: 'POST', headers: ADMIN });
    assert.equal(ret.status, 200);
    assert.equal((await ret.json()).version.status, 'retired');
  } finally {
    await closeServer(server);
  }
});

test('single-draft: a second concurrent draft is rejected (409)', async () => {
  const { server, baseUrl } = await startServer();
  try {
    // v1.0.0 is released (baseline), so no draft exists; create one
    const a = await fetch(`${baseUrl}/api/taxonomy/versions`, {
      method: 'POST', headers: ADMIN, body: JSON.stringify({ tag: 'v9.9.8-b1draft' }),
    });
    assert.equal(a.status, 201);
    const b = await fetch(`${baseUrl}/api/taxonomy/versions`, {
      method: 'POST', headers: ADMIN, body: JSON.stringify({ tag: 'v9.9.7-b1draft' }),
    });
    assert.equal(b.status, 409);
    assert.equal((await b.json()).code, 'DRAFT_EXISTS');
    // cleanup the draft
    await fetch(`${baseUrl}/api/taxonomy/versions/v9.9.8-b1draft`, { method: 'DELETE', headers: ADMIN });
  } finally {
    await closeServer(server);
  }
});
```

- [ ] **Step 2: Run it against the local DB**

Run from `server`: `node -e "require('./test/taxonomyVersions.db.test.js')"`
Expected: `pass 2 / fail 0`. (Local DB is migrated+seeded+backfilled.)

- [ ] **Step 3: Wire the DB test into the `search-db` CI job**

In `.github/workflows/backend-and-frontend-tests.yml`, in the `search-db` job, after the existing `Run taxonomy-version DB tests` step (which runs `taxonomyVersion.db.test.js`), add:

```yaml
      - name: Run taxonomy-version lifecycle DB tests
        working-directory: server
        run: node -e "require('./test/taxonomyVersions.db.test.js')"
```

- [ ] **Step 4: Commit**

```
git add server/test/taxonomyVersions.db.test.js .github/workflows/backend-and-frontend-tests.yml
git commit -m "test(db): real-PG version lifecycle + release parity + CI wiring"
```

---

## Task 6: Full-suite verification + finalize branch

**Files:** none (verification only)

- [ ] **Step 1: Run the full mocked backend suite**

Run from `server`: `npm test`
Expected: exit 0; every file passes, including `versionImmutability.test.js` (8) and the new `taxonomyVersions.test.js` (12). No drop in any existing file.

- [ ] **Step 2: Regenerate schema-doc check (no schema change, must still be in sync)**

Run from `server`: `npm run schema:doc:check`
Expected: `schema-reference.md is up-to-date` (B1 added no schema; this guards against accidental drift).

- [ ] **Step 3: ASCII scan of all new/modified executable files**

Run from repo root:
```
node -e "['server/utils/versionSnapshot.js','server/routes/taxonomyVersions.js','server/test/taxonomyVersions.test.js','server/test/taxonomyVersions.db.test.js','server/test/utils.js','server/scripts/backfill-v1-snapshots.js','server/app.js'].forEach(f=>console.log(f, /[^\x00-\x7F]/.test(require('fs').readFileSync(f,'utf8'))?'NON-ASCII':'ASCII-OK'))"
```
Expected: all `ASCII-OK`.

- [ ] **Step 4: Push + open PR (pre-merge protocol applies)**

```
git push -u origin feat/schema-versioning-phase-b1
gh pr create --title "feat(api): schema versioning Phase B1 -- version lifecycle + release snapshot" --body "..."
```

> **Pre-merge protocol (CLAUDE.md, MANDATORY):** before squash-merge, triage `gh api repos/MasterDD-L34D/Game-Database/pulls/<N>/comments`; fix P1/P2, re-run CI, then merge. Do not merge without checking comments. Update RFC #1 status (Phase B1 merged) post-merge.

---

## Self-Review

**1. Spec coverage:**
- Full-snapshot-on-release → Task 1 (`snapshotAllMasters`) + Task 3 release endpoint + Task 5 parity test. ✓
- Draft-then-release lifecycle + single-draft → Task 3 create (pre-check + P2002) + Task 5 DRAFT_EXISTS DB test. ✓
- Validated semver → Task 3 `SEMVER_RE` + Task 3 invalid-tag test. ✓
- admin-only mutations, GETs open → Task 3 `requireAdmin` on POST/DELETE, open GETs + Task 3 403 test. ✓
- Endpoints (list/get/create/release/retire/delete) → Task 3 full router. ✓
- Audit non-revertable → Task 3 `logAudit('TaxonomyVersion', ...)`; no audit.js change (TaxonomyVersion absent from REVERTABLE_ENTITY_MODELS). ✓
- Errors (400/404/409 TAG_EXISTS/DRAFT_EXISTS/INVALID_STATE/403) → Task 3 router + Task 3/4 tests. ✓
- No schema change → confirmed (Task 6 Step 2 guards doc-sync). ✓
- Shared util / DRY → Task 1. ✓
- Tests (mocked + real-PG + CI) → Tasks 3/4/5. ✓

**2. Placeholder scan:** Only intentional placeholder is the PR `--body "..."` in Task 6 (author-written at PR time). No code-step placeholders.

**3. Type consistency:** `snapshotAllMasters(client, versionId, log)` signature consistent across util (Task 1), backfill (Task 1), and release endpoint (Task 3). `FIELD_MAP` keys (`trait/biome/species/ecosystem`) ↔ `snapshot` delegates (`traitVersion`...) consistent in util, route `snapshotCounts`, and the mock (`snapshotRows` keys). Version row shape (`id/tag/status/description/releasedAt/releasedBy`) consistent between the mock (Task 2) and route usage (Task 3). Error codes (`TAG_EXISTS`/`DRAFT_EXISTS`/`INVALID_STATE`/`NOT_FOUND`/`VALIDATION_ERROR`) consistent between router and tests.

**Note on test placement:** the mocked suite covers the full happy-release (via the `$transaction` passthrough + `createMany` mock) AND the state guards; the real-PG test covers release parity against live masters + the single-draft DB constraint. This matches the spec's testing section.
