# Schema Versioning Phase C (C-DB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve a released taxonomy version's frozen trait snapshot via `?versionId=<tag>` on the trait list and glossary endpoints, leaving the live read path untouched.

**Architecture:** A new pure-ish module `server/utils/versionRead.js` resolves a release tag to its version row and maps a `TraitVersion` snapshot row into the master trait shape (reusing `versionSnapshot.FIELD_MAP.trait.fields`). The two trait GET handlers branch at the top: with `?versionId=` they read from the snapshot table, otherwise the existing live path runs unchanged.

**Tech Stack:** Express, Prisma, PostgreSQL. Tests: node:test. Mapper unit test runs in the mocked `checks` CI job; resolver + handler integration runs in the real-Postgres `search-db` CI job.

**Spec:** `docs/superpowers/specs/2026-05-21-schema-versioning-phase-c-cdb-design.md`

**Branch:** `feat/schema-versioning-phase-c-cdb` (already created).

---

## Conventions (read before starting)

- Run all `npm`/`node`/`prisma` commands from `server/` (the repo root resolves a different prisma binary).
- ASCII-only in source/docs bodies (no em-dash, no smart quotes). Verify with `perl -ne 'exit 1 if /[^\x00-\x7F]/' <file>`.
- commit-msg hook: subject `<=72` chars; the text after the `type(scope):` prefix must start lowercase; description body first letter lowercase; NO `Co-Authored-By` trailer.
- Required commit trailers (global ADR-0011): `Coding-Agent: claude-opus-4.7` and `Trace-Id: <uuid-v7>`. Generate a fresh uuid-v7 per commit:
  ```bash
  node -e "const b=require('crypto').randomBytes(16);const t=Date.now();b[0]=(t/2**40)&0xff;b[1]=(t/2**32)&0xff;b[2]=(t/2**24)&0xff;b[3]=(t/2**16)&0xff;b[4]=(t/2**8)&0xff;b[5]=t&0xff;b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');console.log(h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20))"
  ```
- DB tests assume a seeded + backfilled local Postgres on 5433 with the baseline released version `v1.0.0` already populated (Phase A `node scripts/backfill-v1-snapshots.js`).

## File Structure

- Create `server/utils/versionRead.js` -- tag resolver + snapshot-row mapper. One responsibility: translate a version request into readable trait rows. Depends on `db/prisma`, `utils/httpErrors` (AppError), `utils/versionSnapshot` (FIELD_MAP).
- Create `server/test/versionRead.test.js` -- pure unit test for the mapper (no DB; runs in `checks` job).
- Modify `server/routes/traits.js` -- add the `versionId` branch to `GET /` and `GET /glossary`.
- Create `server/test/traitVersionRead.db.test.js` -- real-Postgres integration suite (7 tests).
- Modify `.github/workflows/backend-and-frontend-tests.yml` -- add a step running the new DB test.

---

### Task 1: versionRead util (mapper + resolver)

**Files:**
- Create: `server/utils/versionRead.js`
- Test: `server/test/versionRead.test.js`

- [ ] **Step 1: Write the failing unit test for the mapper**

Create `server/test/versionRead.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { traitVersionToTrait } = require('../utils/versionRead');

test('traitVersionToTrait maps snapshot row to master trait shape', () => {
  const row = {
    id: 'snap-row-id',
    traitId: 'master-trait-id',
    versionId: 'ver-id',
    capturedAt: new Date('2026-01-01T00:00:00Z'),
    slug: 'speed',
    name: 'Speed',
    description: 'how fast',
    category: 'movement',
    unit: 'm/s',
    dataType: 'NUMERIC',
    allowedValues: null,
    rangeMin: 0,
    rangeMax: 10,
    tier: 'T1',
    familyType: 'kinetic',
    energyMaintenance: 'low',
    slotProfile: { a: 1 },
    usageTags: ['x'],
    synergies: null,
    conflicts: null,
    environmentalRequirements: null,
    inducedMutation: null,
    functionalUse: null,
    selectiveDrive: null,
    weakness: null,
  };
  const out = traitVersionToTrait(row);
  // id is the stable master id, not the snapshot row id
  assert.equal(out.id, 'master-trait-id');
  // frozen fields are copied through
  assert.equal(out.slug, 'speed');
  assert.equal(out.name, 'Speed');
  assert.equal(out.dataType, 'NUMERIC');
  assert.deepEqual(out.slotProfile, { a: 1 });
  // snapshot-only columns are dropped
  assert.equal('versionId' in out, false);
  assert.equal('capturedAt' in out, false);
  assert.equal('traitId' in out, false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd server && node --test test/versionRead.test.js`
Expected: FAIL -- `Cannot find module '../utils/versionRead'`.

- [ ] **Step 3: Implement the module**

Create `server/utils/versionRead.js`:

```js
'use strict';
// Read-side counterpart to versionSnapshot.js. Resolves a release tag to its
// version row and maps a snapshot row back into the master trait shape. Pure
// mapper + a single prisma read; no audit, no side effects.

const prisma = require('../db/prisma');
const { AppError } = require('./httpErrors');
const { FIELD_MAP } = require('./versionSnapshot');

// Resolve a release tag to a readable version row.
// 404 if unknown, 400 if still a draft. Released or retired both serve the
// snapshot (retired stays readable as historical data).
async function resolveReleasedVersion(tag) {
  const version = await prisma.taxonomyVersion.findUnique({ where: { tag } });
  if (!version) {
    throw new AppError(404, 'VERSION_NOT_FOUND', 'Version not found', { tag });
  }
  if (version.status === 'draft') {
    throw new AppError(400, 'VERSION_NOT_RELEASED', 'Version is a draft and has no snapshot', { tag });
  }
  return version;
}

// Map a TraitVersion snapshot row into the master trait shape. id is the
// stable master traitId; snapshot-only columns are dropped.
function traitVersionToTrait(row) {
  const out = { id: row.traitId };
  for (const f of FIELD_MAP.trait.fields) out[f] = row[f];
  return out;
}

module.exports = { resolveReleasedVersion, traitVersionToTrait };
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `cd server && node --test test/versionRead.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Verify ASCII-clean**

Run: `cd server && perl -ne 'exit 1 if /[^\x00-\x7F]/' utils/versionRead.js test/versionRead.test.js && echo OK`
Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add server/utils/versionRead.js server/test/versionRead.test.js
TRACE=$(node -e "const b=require('crypto').randomBytes(16);const t=Date.now();b[0]=(t/2**40)&0xff;b[1]=(t/2**32)&0xff;b[2]=(t/2**24)&0xff;b[3]=(t/2**16)&0xff;b[4]=(t/2**8)&0xff;b[5]=t&0xff;b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');console.log(h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20))")
git commit -m "$(printf 'feat(api): versionRead util for phase C snapshot reads\n\nresolveReleasedVersion (404 unknown / 400 draft) + traitVersionToTrait\nmapper reusing FIELD_MAP.trait.fields. mapper unit-tested.\n\nCoding-Agent: claude-opus-4.7\nTrace-Id: %s\n' "$TRACE")"
```

---

### Task 2: Branch the two trait handlers

**Files:**
- Modify: `server/routes/traits.js` (imports near top; `GET /` at lines 99-106; `GET /glossary` at lines 108-124)

- [ ] **Step 1: Add the import**

In `server/routes/traits.js`, after the existing `const { normalizeSlug } = require('../utils/slug');` line, add:

```js
const { resolveReleasedVersion, traitVersionToTrait } = require('../utils/versionRead');
```

- [ ] **Step 2: Branch `GET /` (list)**

Replace the existing list handler:

```js
router.get('/', async (req, res) => {
  try {
    const payload = await fetchPaginatedTraits(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});
```

with:

```js
router.get('/', async (req, res) => {
  try {
    const versionId = (req.query.versionId || '').trim();
    if (versionId) {
      const version = await resolveReleasedVersion(versionId);
      const { page, pageSize } = assertPagination(req.query);
      const q = (req.query.q || '').trim();
      const where = {
        versionId: version.id,
        ...(q ? { OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
        ] } : {}),
      };
      const [total, rows] = await Promise.all([
        prisma.traitVersion.count({ where }),
        prisma.traitVersion.findMany({ where, skip: page * pageSize, take: pageSize, orderBy: { name: 'asc' } }),
      ]);
      return res.json({ items: rows.map(traitVersionToTrait), page, pageSize, total, _version: version.tag });
    }
    const payload = await fetchPaginatedTraits(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});
```

- [ ] **Step 3: Branch `GET /glossary`**

Replace the existing glossary handler:

```js
router.get('/glossary', async (req, res) => {
  try {
    const allTraits = await prisma.trait.findMany({
      where: { deletedAt: null },
      select: { slug: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
    const traits = allTraits.map((t) => ({
      _id: t.slug,
      labels: { it: t.name, en: t.name },
      descriptions: { it: t.description || null, en: t.description || null },
    }));
    return res.json({ traits });
  } catch (error) {
    return handleError(res, error);
  }
});
```

with:

```js
router.get('/glossary', async (req, res) => {
  try {
    const versionId = (req.query.versionId || '').trim();
    if (versionId) {
      const version = await resolveReleasedVersion(versionId);
      const rows = await prisma.traitVersion.findMany({
        where: { versionId: version.id },
        select: { slug: true, name: true, description: true },
        orderBy: { name: 'asc' },
      });
      const traits = rows.map((t) => ({
        _id: t.slug,
        labels: { it: t.name, en: t.name },
        descriptions: { it: t.description || null, en: t.description || null },
      }));
      return res.json({ traits });
    }
    const allTraits = await prisma.trait.findMany({
      where: { deletedAt: null },
      select: { slug: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
    const traits = allTraits.map((t) => ({
      _id: t.slug,
      labels: { it: t.name, en: t.name },
      descriptions: { it: t.description || null, en: t.description || null },
    }));
    return res.json({ traits });
  } catch (error) {
    return handleError(res, error);
  }
});
```

- [ ] **Step 4: Run the mocked suite to confirm no live-path regression**

Run: `cd server && npm test`
Expected: PASS (same green set as before; the live trait paths are unchanged). Pre-existing `records.test.ts` undici AbortSignal failures, if present, are NOT a regression (they fail on base main too).

- [ ] **Step 5: Verify ASCII-clean**

Run: `cd server && perl -ne 'exit 1 if /[^\x00-\x7F]/' routes/traits.js && echo OK`
Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add server/routes/traits.js
TRACE=$(node -e "const b=require('crypto').randomBytes(16);const t=Date.now();b[0]=(t/2**40)&0xff;b[1]=(t/2**32)&0xff;b[2]=(t/2**24)&0xff;b[3]=(t/2**16)&0xff;b[4]=(t/2**8)&0xff;b[5]=t&0xff;b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');console.log(h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20))")
git commit -m "$(printf 'feat(api): serve versioned trait reads via ?versionId=\n\nbranch GET /api/traits and /glossary on ?versionId=; snapshot path\nfilters TraitVersion by resolved release id, live path untouched.\nglossary shape stays schema-identical (no version marker).\n\nCoding-Agent: claude-opus-4.7\nTrace-Id: %s\n' "$TRACE")"
```

---

### Task 3: Real-Postgres integration test suite

**Files:**
- Create: `server/test/traitVersionRead.db.test.js`

This suite exercises `resolveReleasedVersion` + both handler branches against the seeded `v1.0.0` snapshot. It uses the same `startServer`/`closeServer` + real `fetch` pattern as `server/test/taxonomyVersions.db.test.js`.

- [ ] **Step 1: Write the failing DB test**

Create `server/test/traitVersionRead.db.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, closeServer } = require('./utils');
const prisma = require('../db/prisma');

// Requires a real Postgres (migrated + seeded + backfilled) with the baseline
// released version v1.0.0 populated. Exercises the versioned trait read path.

const TAG = 'v1.0.0';
const DRAFT_TAG = 'v9.9.6-cdraft';

test.after(async () => {
  // best-effort cleanup of the throwaway draft, then disconnect
  try {
    const d = await prisma.taxonomyVersion.findUnique({ where: { tag: DRAFT_TAG } });
    if (d) await prisma.taxonomyVersion.delete({ where: { id: d.id } });
  } finally {
    await prisma.$disconnect();
  }
});

test('versioned list: items mapped, _version set, id is master traitId', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: TAG } });
    assert.ok(version, 'v1.0.0 must exist (seeded + backfilled)');
    const sampleSnap = await prisma.traitVersion.findFirst({ where: { versionId: version.id }, orderBy: { name: 'asc' } });
    assert.ok(sampleSnap, 'v1.0.0 must have trait snapshots');

    const res = await fetch(`${baseUrl}/api/traits?versionId=${TAG}&pageSize=1&page=0`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body._version, TAG);
    assert.equal(typeof body.total, 'number');
    assert.ok(body.total >= 1);
    assert.equal(body.items.length, 1);
    // id is the master traitId, not the snapshot row id
    assert.equal(body.items[0].id, sampleSnap.traitId);
    assert.equal(body.items[0].slug, sampleSnap.slug);
    // snapshot-only columns are not leaked
    assert.equal('versionId' in body.items[0], false);
    assert.equal('capturedAt' in body.items[0], false);
  } finally {
    await closeServer(server);
  }
});

test('versioned glossary: schema-identical shape, parity with snapshot count', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: TAG } });
    const snapCount = await prisma.traitVersion.count({ where: { versionId: version.id } });

    const res = await fetch(`${baseUrl}/api/traits/glossary?versionId=${TAG}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(Object.keys(body), ['traits']); // no version marker (schema lock)
    assert.equal(body.traits.length, snapCount);
    const first = body.traits[0];
    assert.deepEqual(Object.keys(first).sort(), ['_id', 'descriptions', 'labels']);
    assert.equal(typeof first._id, 'string');
    assert.ok('it' in first.labels && 'en' in first.labels);
  } finally {
    await closeServer(server);
  }
});

test('unknown tag -> 404 VERSION_NOT_FOUND', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/traits?versionId=v0.0.0-nope`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).code, 'VERSION_NOT_FOUND');
  } finally {
    await closeServer(server);
  }
});

test('draft tag -> 400 VERSION_NOT_RELEASED', async () => {
  const { server, baseUrl } = await startServer();
  try {
    // ensure a clean draft exists; single-draft index may already hold one, so
    // delete any existing draft first, then create ours
    const existingDraft = await prisma.taxonomyVersion.findFirst({ where: { status: 'draft' } });
    if (existingDraft) await prisma.taxonomyVersion.delete({ where: { id: existingDraft.id } });
    await prisma.taxonomyVersion.create({ data: { tag: DRAFT_TAG, status: 'draft' } });

    const res = await fetch(`${baseUrl}/api/traits?versionId=${DRAFT_TAG}`);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'VERSION_NOT_RELEASED');
  } finally {
    await closeServer(server);
  }
});

test('q filter on versioned list returns a correct subset', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: TAG } });
    const sample = await prisma.traitVersion.findFirst({ where: { versionId: version.id }, orderBy: { name: 'asc' } });
    const term = sample.name.slice(0, 3);

    const res = await fetch(`${baseUrl}/api/traits?versionId=${TAG}&q=${encodeURIComponent(term)}&pageSize=100&page=0`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.total >= 1);
    for (const item of body.items) {
      const hay = `${item.name} ${item.slug}`.toLowerCase();
      assert.ok(hay.includes(term.toLowerCase()));
    }
  } finally {
    await closeServer(server);
  }
});

test('no versionId -> live path unchanged (regression guard)', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/traits?pageSize=1&page=0`);
    assert.equal(res.status, 200);
    const body = await res.json();
    // live shape has no _version marker
    assert.equal('_version' in body, false);
    assert.deepEqual(Object.keys(body).sort(), ['items', 'page', 'pageSize', 'total']);
  } finally {
    await closeServer(server);
  }
});

test('frozen snapshot ignores a later soft-delete of the live master', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: TAG } });
    const snap = await prisma.traitVersion.findFirst({ where: { versionId: version.id }, orderBy: { name: 'asc' } });
    // soft-delete the live master this snapshot points at
    await prisma.trait.update({ where: { id: snap.traitId }, data: { deletedAt: new Date() } });
    try {
      const res = await fetch(`${baseUrl}/api/traits?versionId=${TAG}&q=${encodeURIComponent(snap.slug)}&pageSize=100&page=0`);
      assert.equal(res.status, 200);
      const body = await res.json();
      const ids = body.items.map((i) => i.id);
      assert.ok(ids.includes(snap.traitId), 'frozen snapshot still includes the soft-deleted master');
    } finally {
      // always restore the live master so DB state is clean for other tests
      await prisma.trait.update({ where: { id: snap.traitId }, data: { deletedAt: null } });
    }
  } finally {
    await closeServer(server);
  }
});
```

- [ ] **Step 2: Run it to verify the suite passes against local Postgres**

Run: `cd server && node -e "require('./test/traitVersionRead.db.test.js')"`
Expected: PASS (7 tests). Requires local Postgres on 5433 seeded + backfilled (`npm run dev:setup` then `node scripts/backfill-v1-snapshots.js` if not already done).

If a prior failed run left `v9.9.6-cdraft` behind, the draft test deletes any existing draft first, so a re-run is safe.

- [ ] **Step 3: Verify ASCII-clean**

Run: `cd server && perl -ne 'exit 1 if /[^\x00-\x7F]/' test/traitVersionRead.db.test.js && echo OK`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add server/test/traitVersionRead.db.test.js
TRACE=$(node -e "const b=require('crypto').randomBytes(16);const t=Date.now();b[0]=(t/2**40)&0xff;b[1]=(t/2**32)&0xff;b[2]=(t/2**24)&0xff;b[3]=(t/2**16)&0xff;b[4]=(t/2**8)&0xff;b[5]=t&0xff;b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');console.log(h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20))")
git commit -m "$(printf 'test(api): real-PG suite for versioned trait reads\n\n7 tests: list mapping, glossary parity, 404/400 resolve, q filter,\nlive-path regression guard, frozen-snapshot ignores soft-delete.\n\nCoding-Agent: claude-opus-4.7\nTrace-Id: %s\n' "$TRACE")"
```

---

### Task 4: Wire the DB test into CI

**Files:**
- Modify: `.github/workflows/backend-and-frontend-tests.yml` (after the existing line 80-82 "Run taxonomy-version lifecycle DB tests" step)

- [ ] **Step 1: Add the CI step**

In `.github/workflows/backend-and-frontend-tests.yml`, after this existing step:

```yaml
      - name: Run taxonomy-version lifecycle DB tests
        working-directory: server
        run: node -e "require('./test/taxonomyVersions.db.test.js')"
```

add:

```yaml
      - name: Run versioned-read DB tests
        working-directory: server
        run: node -e "require('./test/traitVersionRead.db.test.js')"
```

- [ ] **Step 2: Verify the YAML parses**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/backend-and-frontend-tests.yml','utf8'); require('child_process'); console.log(y.includes('traitVersionRead.db.test.js') ? 'STEP-PRESENT' : 'MISSING')"`
Expected: `STEP-PRESENT`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/backend-and-frontend-tests.yml
TRACE=$(node -e "const b=require('crypto').randomBytes(16);const t=Date.now();b[0]=(t/2**40)&0xff;b[1]=(t/2**32)&0xff;b[2]=(t/2**24)&0xff;b[3]=(t/2**16)&0xff;b[4]=(t/2**8)&0xff;b[5]=t&0xff;b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');console.log(h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20))")
git commit -m "$(printf 'ci: run versioned-read DB tests in search-db job\n\nadd the traitVersionRead.db.test.js step after the lifecycle DB tests.\n\nCoding-Agent: claude-opus-4.7\nTrace-Id: %s\n' "$TRACE")"
```

---

### Task 5: Final verification + RFC status + PR

**Files:**
- Modify: `docs/rfc/2026-05-21-schema-versioning.md` (Phase C status line)

- [ ] **Step 1: Full mocked suite green**

Run: `cd server && npm test`
Expected: PASS (no new failures vs base; pre-existing `records.test.ts` undici failures are not a regression).

- [ ] **Step 2: Full DB suite green**

Run: `cd server && node -e "require('./test/traitVersionRead.db.test.js')"`
Expected: PASS (7 tests).

- [ ] **Step 3: Flip the RFC Phase C status**

Open `docs/rfc/2026-05-21-schema-versioning.md`, find the Phase C row/line, and mark it implemented (mirror the wording already used for Phase A/B1/B2 -- e.g. change a `planned`/`pending` marker to `merged` with the PR number once known). Keep it ASCII.

- [ ] **Step 4: Verify ASCII-clean on the RFC**

Run: `perl -ne 'exit 1 if /[^\x00-\x7F]/' docs/rfc/2026-05-21-schema-versioning.md && echo OK`
Expected: `OK`.

- [ ] **Step 5: Commit + push + open PR**

```bash
git add docs/rfc/2026-05-21-schema-versioning.md
TRACE=$(node -e "const b=require('crypto').randomBytes(16);const t=Date.now();b[0]=(t/2**40)&0xff;b[1]=(t/2**32)&0xff;b[2]=(t/2**24)&0xff;b[3]=(t/2**16)&0xff;b[4]=(t/2**8)&0xff;b[5]=t&0xff;b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');console.log(h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20))")
git commit -m "$(printf 'docs(rfc): mark phase C C-DB versioned read implemented\n\nCoding-Agent: claude-opus-4.7\nTrace-Id: %s\n' "$TRACE")"
git push -u origin feat/schema-versioning-phase-c-cdb
gh pr create --title "feat(api): Phase C C-DB versioned trait reads (?versionId=)" --body "$(cat <<'BODY'
## Summary
- `?versionId=<tag>` on `GET /api/traits` and `/glossary` serves a released version's frozen snapshot.
- New `server/utils/versionRead.js`: `resolveReleasedVersion` (404 unknown / 400 draft) + `traitVersionToTrait` mapper (reuses `FIELD_MAP.trait.fields`).
- Live read path untouched. Glossary stays schema-identical (no version marker; `additionalProperties:false`).

## Test plan
- [ ] mocked suite green (`npm test`)
- [ ] real-PG DB suite green (`traitVersionRead.db.test.js`, 7 tests) in search-db CI job
- [ ] Codex inline review triaged before squash-merge
BODY
)"
```

- [ ] **Step 6: MANDATORY pre-merge -- triage Codex inline review**

Wait for Codex auto-review (posts P1/P2 a few minutes after PR open), then:

```bash
gh api repos/MasterDD-L34D/Game-Database/pulls/<N>/comments \
  --jq '.[] | "[\(.user.login)] \(.path):\(.line // "?") :: \(.body)"'
```

Triage per `CLAUDE.md` Code review protocol: P1/P2 fixed (or explicitly deferred with rationale) before squash-merge. Do NOT merge without checking comments first. Merge gated on Eduardo sign-off.

---

## Self-Review

**1. Spec coverage:**
- versionRead.js (resolver + mapper) -> Task 1.
- Branch GET / and /glossary -> Task 2.
- Contract decisions (glossary identical shape, list `_version` top-level, id=traitId, 404/400, q parity, empty versionId -> live, frozen ignores deletedAt) -> covered by Task 2 code + Task 3 tests 1-7.
- Testing (7 DB tests) -> Task 3. CI wiring -> Task 4.
- Non-goals (no schema/migration, trait-only) -> respected; no schema task exists.

**2. Placeholder scan:** No TBD/TODO. The only deferred specifics are the PR number in Task 5 (only knowable after `gh pr create`) and the exact RFC line wording (Task 5 Step 3 says to mirror the existing Phase A/B markers) -- both are concrete instructions, not placeholders.

**3. Type consistency:** `resolveReleasedVersion(tag) -> version` (has `.id`, `.tag`, `.status`); `traitVersionToTrait(row) -> { id, ...fields }` used identically in Task 2 list branch and asserted in Task 1 + Task 3. `_version` (top-level, list only) and the glossary `{ traits: [...] }` shape are consistent across spec, code, and tests. Error codes `VERSION_NOT_FOUND` / `VERSION_NOT_RELEASED` match between util, spec table, and DB tests.
