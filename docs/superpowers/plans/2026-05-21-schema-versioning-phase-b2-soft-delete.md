# Schema Versioning Phase B2 — Soft-Delete + Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hard-delete of the 4 versioned masters (Trait/Biome/Species/Ecosystem) with soft-delete (`deletedAt`), add a restore path, hide soft-deleted rows from all read surfaces by default, and remove Phase B1's interim hard-delete guard.

**Architecture:** Add a nullable `deletedAt` column + index to the 4 masters. A tiny `liveFilter(req)` helper injects `{ deletedAt: null }` (unless `?includeDeleted=true`) into master list/get queries; glossary/search/dashboard always exclude deleted. `DELETE` becomes `update deletedAt=now`; a new `POST /:id/restore` clears it. The audit-revert endpoint is repointed to restore (clear `deletedAt`) when a soft-deleted row still exists. Slug stays `@unique` so restore is collision-free.

**Tech Stack:** Express 4, Prisma 5 + PostgreSQL 16, `node:test`. Mocked tests in the `checks` CI job; real-PG test in `search-db`. **Migrations are non-interactive per issue #159** (`migrate dev --create-only --name ...` to author, `migrate deploy` to apply — never bare `migrate dev`).

**Spec:** `docs/superpowers/specs/2026-05-21-schema-versioning-phase-b2-soft-delete-design.md`.

---

## File Structure

- **Modify** `server/prisma/schema.prisma` — `deletedAt DateTime?` + `@@index([deletedAt])` on Trait/Biome/Species/Ecosystem (+ migration).
- **Create** `server/utils/softDelete.js` — `liveFilter(req)`.
- **Modify** `server/routes/{traits,biomes,species,ecosystems}.js` — soft-delete + restore + list/get filter (traits also: glossary filter).
- **Modify** `server/utils/searchQuery.js` — exclude soft-deleted in fuzzy SQL.
- **Modify** `server/routes/dashboard.js` — exclude soft-deleted in master + orphan counts.
- **Modify** `server/routes/audit.js` — revert reconciliation (restore soft-deleted instead of recreate).
- **Modify** `server/utils/taxonomyValidation.js` — remove `assertNotInReleasedVersion`.
- **Modify** `server/test/utils.js` — master mock gains `deletedAt`.
- **Create** `server/test/softDelete.test.js` (mocked) + register in `run-tests.js`.
- **Modify** `server/test/versionImmutability.test.js` — flip semantics to soft-delete.
- **Create** `server/test/softDelete.db.test.js` (real-PG) + CI wiring.
- **Modify** `CLAUDE.md` (Anti-Pattern entry for #159) + `docs/rfc/2026-05-21-schema-versioning.md` (B1 merged + B2).

---

## Task 1: Schema migration (deletedAt + index)

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/<ts>_soft_delete_masters/migration.sql`
- Modify: `docs/schema-reference.md` (regen)

- [ ] **Step 1: Add `deletedAt` + index to the 4 master models**

In `server/prisma/schema.prisma`, add to **each** of `model Trait`, `model Biome`, `model Species`, `model Ecosystem`, a `deletedAt` scalar (place it after `updatedAt`) and a `@@index([deletedAt])` (with the other block directives). Example for Trait — its block currently ends:
```prisma
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  speciesValues SpeciesTrait[]
  versions      TraitVersion[]

  // pg_trgm fuzzy search (PR #151, /api/search). See Record model for rationale.
  @@index([name(ops: raw("gin_trgm_ops"))], type: Gin, map: "Trait_name_trgm_idx")
  @@index([slug(ops: raw("gin_trgm_ops"))], type: Gin, map: "Trait_slug_trgm_idx")
}
```
Change to add `deletedAt DateTime?` after `updatedAt` and `@@index([deletedAt])` after the gin indexes:
```prisma
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  deletedAt     DateTime?

  speciesValues SpeciesTrait[]
  versions      TraitVersion[]

  // pg_trgm fuzzy search (PR #151, /api/search). See Record model for rationale.
  @@index([name(ops: raw("gin_trgm_ops"))], type: Gin, map: "Trait_name_trgm_idx")
  @@index([slug(ops: raw("gin_trgm_ops"))], type: Gin, map: "Trait_slug_trgm_idx")
  @@index([deletedAt])
}
```
Do the same for Biome, Species, Ecosystem (add `deletedAt DateTime?` after their `updatedAt`, add `@@index([deletedAt])` to their directive block). Do NOT add it to Record or any junction.

- [ ] **Step 2: Validate the schema**

Run from `server`: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid`.

- [ ] **Step 3: Generate the migration NON-INTERACTIVELY (issue #159)**

Local docker Postgres must be up (5433). Run from `server`:
`npx prisma migrate dev --create-only --name soft_delete_masters`
Expected: creates `migrations/<ts>_soft_delete_masters/migration.sql` WITHOUT prompting (the `--name` flag supplies the name) and WITHOUT applying. **Never** run bare `npx prisma migrate dev` (it hangs on the interactive prompt in automation — issue #159).

- [ ] **Step 4: Inspect the generated SQL**

Open the generated `migration.sql`. Confirm it contains ONLY `ALTER TABLE "Trait"/"Biome"/"Species"/"Ecosystem" ADD COLUMN "deletedAt" TIMESTAMP(3);` and `CREATE INDEX "..._deletedAt_idx" ON "..."("deletedAt");` (4 each). It must NOT contain any `DROP INDEX` (the GIN indexes are modeled per #155, so the diff is clean) and no changes to other tables. If you see unexpected statements, STOP and report.

- [ ] **Step 5: Apply the migration NON-INTERACTIVELY**

Run from `server`: `npx prisma migrate deploy`
Expected: applies `<ts>_soft_delete_masters`. Then `npx prisma generate` (so the client has `deletedAt`). Expected: `Generated Prisma Client`.

- [ ] **Step 6: Regenerate schema-doc + verify**

Run from `server`: `npm run schema:doc && npm run schema:doc:check`
Expected: `Wrote ...schema-reference.md` then `schema-reference.md is up-to-date`.

- [ ] **Step 7: Commit**

```
git add server/prisma/schema.prisma "server/prisma/migrations" docs/schema-reference.md
git commit -m "feat(db): add deletedAt soft-delete column to taxonomy masters"
```

---

## Task 2: `liveFilter` util + test-context deletedAt support

**Files:**
- Create: `server/utils/softDelete.js`
- Modify: `server/test/utils.js`

- [ ] **Step 1: Create `server/utils/softDelete.js`**

```js
'use strict';
// Returns a Prisma where-fragment hiding soft-deleted rows, unless the caller
// opts in with ?includeDeleted=true. Spread into master where-clauses:
//   { ...liveFilter(req), ...otherConditions }
function liveFilter(req) {
  const includeDeleted = req && req.query && req.query.includeDeleted === 'true';
  return includeDeleted ? {} : { deletedAt: null };
}

module.exports = { liveFilter };
```

- [ ] **Step 2: Add `deletedAt` to the mocked master creators**

In `server/test/utils.js`, each of `createTrait`/`createBiome`/`createSpecies`/`createEcosystem` builds a `record` object. Add `deletedAt: data.deletedAt ?? null,` as a field on each of those four `record` literals (so a freshly-created mock master has `deletedAt: null` and thus matches a `{ deletedAt: null }` filter; tests can also seed a deleted row via `createTrait({ deletedAt: new Date() })`). For example in `createTrait`, change:
```js
    const record = {
      id,
      slug,
      name,
      description: data.description ?? null,
      category: data.category ?? null,
      unit: data.unit ?? null,
      dataType: data.dataType ?? 'TEXT',
      allowedValues: data.allowedValues ?? null,
      rangeMin: data.rangeMin ?? null,
      rangeMax: data.rangeMax ?? null,
    };
```
to add the `deletedAt` line:
```js
    const record = {
      id,
      slug,
      name,
      description: data.description ?? null,
      category: data.category ?? null,
      unit: data.unit ?? null,
      dataType: data.dataType ?? 'TEXT',
      allowedValues: data.allowedValues ?? null,
      rangeMin: data.rangeMin ?? null,
      rangeMax: data.rangeMax ?? null,
      deletedAt: data.deletedAt ?? null,
    };
```
Add the same `deletedAt: data.deletedAt ?? null,` line to the `record` literals in `createBiome`, `createSpecies`, and `createEcosystem`. (The existing `createModelMock` `count`/`findMany` already filter via `matchesWhere`, and its `update` merges `data`, so `{ deletedAt: null }` filtering and `update({ data: { deletedAt } })` work once the field exists on the records.)

- [ ] **Step 3: Verify the mocked suite still passes (no regression from the field add)**

Run from `server`: `npm test`
Expected: exit 0, all files pass (the new field is inert until routes use it).

- [ ] **Step 4: Commit**

```
git add server/utils/softDelete.js server/test/utils.js
git commit -m "feat(db): add liveFilter helper + deletedAt in test masters"
```

---

## Task 3: Soft-delete + restore + read-filter on the 4 master routes

**Files:**
- Modify: `server/routes/traits.js`, `server/routes/biomes.js`, `server/routes/species.js`, `server/routes/ecosystems.js`

> The four routes get the same four edits. Trait is shown in full; the per-file deltas follow. **Traits only** has a `/glossary` endpoint and `notifyGameCacheInvalidation()`. Biomes/Species/Ecosystems have neither.

- [ ] **Step 1: traits.js — import `liveFilter`, drop the guard import**

Change the imports line:
```js
const { findExistingByIdOrSlug, assertNotInReleasedVersion } = require('../utils/taxonomyValidation');
```
to:
```js
const { findExistingByIdOrSlug } = require('../utils/taxonomyValidation');
const { liveFilter } = require('../utils/softDelete');
```

- [ ] **Step 2: traits.js — filter the list query**

`buildWhere(req)` returns the search where. Make the list hide soft-deleted by merging `liveFilter`. Change `buildWhere`:
```js
function buildWhere(req) {
  const q = (req.query.q || '').trim();
  return q
    ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] }
    : {};
}
```
to:
```js
function buildWhere(req) {
  const q = (req.query.q || '').trim();
  const search = q
    ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] }
    : {};
  return { ...liveFilter(req), ...search };
}
```

- [ ] **Step 3: traits.js — filter glossary (always, no includeDeleted)**

Change the glossary `findMany`:
```js
    const allTraits = await prisma.trait.findMany({
      select: { slug: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
```
to:
```js
    const allTraits = await prisma.trait.findMany({
      where: { deletedAt: null },
      select: { slug: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
```

- [ ] **Step 4: traits.js — hide soft-deleted on get-by-id**

Change the get-by-id handler body:
```js
    const id = assertIdParam(req.params);
    const item = await findExistingByIdOrSlug(prisma.trait, id, res, 'Trait not found');
    if (!item) return null;
    return res.json(item);
```
to:
```js
    const id = assertIdParam(req.params);
    const item = await findExistingByIdOrSlug(prisma.trait, id, res, 'Trait not found');
    if (!item) return null;
    if (item.deletedAt && req.query.includeDeleted !== 'true') {
      return sendError(res, 404, 'NOT_FOUND', 'Trait not found', { identifier: id });
    }
    return res.json(item);
```

- [ ] **Step 5: traits.js — replace hard-delete with soft-delete + add restore**

Replace the entire `router.delete('/:id', ...)` handler:
```js
router.delete('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const existing = await findExistingByIdOrSlug(prisma.trait, id, res, 'Trait not found');
    if (!existing) return null;

    await assertNotInReleasedVersion(prisma.traitVersion, 'traitId', existing.id, 'trait');
    await prisma.trait.delete({ where: { id: existing.id } });
    await logAudit(req, 'Trait', existing.id, 'DELETE', existing);
    notifyGameCacheInvalidation();

    return res.json({ success: true, id: existing.id });
  } catch (error) {
    return handleError(res, error);
  }
});
```
with the soft-delete handler PLUS a new restore handler:
```js
router.delete('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const existing = await findExistingByIdOrSlug(prisma.trait, id, res, 'Trait not found');
    if (!existing) return null;
    if (existing.deletedAt) {
      return sendError(res, 409, 'ALREADY_DELETED', 'Trait is already deleted', { id: existing.id });
    }

    const deleted = await prisma.trait.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await logAudit(req, 'Trait', existing.id, 'DELETE', existing);
    notifyGameCacheInvalidation();

    return res.json({ success: true, id: deleted.id });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/restore', requireTaxonomyWrite, async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const existing = await findExistingByIdOrSlug(prisma.trait, id, res, 'Trait not found');
    if (!existing) return null;
    if (!existing.deletedAt) {
      return sendError(res, 409, 'NOT_DELETED', 'Trait is not deleted', { id: existing.id });
    }

    const restored = await prisma.trait.update({ where: { id: existing.id }, data: { deletedAt: null } });
    await logAudit(req, 'Trait', existing.id, 'UPDATE', { restored: true });
    notifyGameCacheInvalidation();

    return res.json({ success: true, id: restored.id });
  } catch (error) {
    return handleError(res, error);
  }
});
```

- [ ] **Step 6: biomes.js / species.js / ecosystems.js — apply the same edits (minus glossary + notify)**

For each of `biomes.js`, `species.js`, `ecosystems.js`:
- **Imports**: same change as Step 1 — drop `assertNotInReleasedVersion` from the `taxonomyValidation` import, add `const { liveFilter } = require('../utils/softDelete');`.
- **List**: each has a `buildWhere(req)` with the same shape — wrap its result with `{ ...liveFilter(req), ...search }` exactly as Step 2.
- **Get-by-id**: add the same `if (item.deletedAt && req.query.includeDeleted !== 'true') return sendError(res, 404, 'NOT_FOUND', '<Entity> not found', { identifier: id });` line before `return res.json(item)` (use the entity's not-found message already used in that file).
- **Delete → soft-delete**: in the `router.delete('/:id', ...)` handler, remove the `await assertNotInReleasedVersion(prisma.<entity>Version, '<entity>Id', existing.id, '<entity>');` line, replace `await prisma.<entity>.delete({ where: { id: existing.id } });` with an `existing.deletedAt` 409 `ALREADY_DELETED` guard + `await prisma.<entity>.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });`. Keep the existing `logAudit(... 'DELETE', existing)`. These files do NOT call `notifyGameCacheInvalidation()` — don't add it.
- **Restore**: add a `router.post('/:id/restore', requireTaxonomyWrite, ...)` handler mirroring Step 5's restore (use the file's prisma delegate + `logAudit(req, '<Entity>', existing.id, 'UPDATE', { restored: true })`; no notify). Per-file values: biomes → `prisma.biome` / `'Biome'`; species → `prisma.species` / `'Species'`; ecosystems → `prisma.ecosystem` / `'Ecosystem'`.

- [ ] **Step 7: Sanity-check the app still boots (no syntax errors)**

Run from `server`: `node -e "require('./app')(); console.log('app loads OK')"`
Expected: `app loads OK` (the app factory builds without throwing).

- [ ] **Step 8: Commit**

```
git add server/routes/traits.js server/routes/biomes.js server/routes/species.js server/routes/ecosystems.js
git commit -m "feat(api): soft-delete + restore for taxonomy masters"
```

---

## Task 4: Search + dashboard exclude soft-deleted

**Files:**
- Modify: `server/utils/searchQuery.js`, `server/routes/dashboard.js`

- [ ] **Step 1: searchQuery.js — mark soft-deletable entities + filter the arm**

Add `softDeletable: true` to the trait/biome/ecosystem/species entries of `ENTITY_MAP` (NOT record). E.g.:
```js
  trait:     { table: 'Trait',     cols: ['name', 'slug'], label: 'name', slug: 'slug', entity: 'Trait', softDeletable: true },
```
(do the same for `biome`, `ecosystem`, `species`; leave `record` unchanged). Then in `armFor`, append a live filter to the WHERE for soft-deletable tables. Change the return:
```js
  return Prisma.sql`
    SELECT ${entity}::text AS entity, "id", ${slugExpr} AS slug, ${ident(label)} AS label, ${score} AS score
      FROM ${ident(table)}
     WHERE (${whereMatch})`;
```
to:
```js
  const live = ENTITY_MAP[key].softDeletable ? Prisma.sql` AND "deletedAt" IS NULL` : Prisma.empty;
  return Prisma.sql`
    SELECT ${entity}::text AS entity, "id", ${slugExpr} AS slug, ${ident(label)} AS label, ${score} AS score
      FROM ${ident(table)}
     WHERE (${whereMatch})${live}`;
```

- [ ] **Step 2: dashboard.js — exclude soft-deleted in master + orphan counts**

In `computeDashboardStats`, change the 4 master total counts and the 4 orphan counts to filter `deletedAt: null`:
```js
    client.trait.count(),
    client.biome.count(),
    client.species.count(),
    client.ecosystem.count(),
```
→
```js
    client.trait.count({ where: { deletedAt: null } }),
    client.biome.count({ where: { deletedAt: null } }),
    client.species.count({ where: { deletedAt: null } }),
    client.ecosystem.count({ where: { deletedAt: null } }),
```
and the orphan counts:
```js
    client.trait.count({ where: { speciesValues: { none: {} } } }),
    client.biome.count({ where: { species: { none: {} }, ecosystems: { none: {} } } }),
    client.species.count({ where: { traits: { none: {} }, biomes: { none: {} }, ecosystems: { none: {} } } }),
    client.ecosystem.count({ where: { biomes: { none: {} }, species: { none: {} } } }),
```
→
```js
    client.trait.count({ where: { deletedAt: null, speciesValues: { none: {} } } }),
    client.biome.count({ where: { deletedAt: null, species: { none: {} }, ecosystems: { none: {} } } }),
    client.species.count({ where: { deletedAt: null, traits: { none: {} }, biomes: { none: {} }, ecosystems: { none: {} } } }),
    client.ecosystem.count({ where: { deletedAt: null, biomes: { none: {} }, species: { none: {} } } }),
```
(Record + junction counts unchanged.)

- [ ] **Step 2b: Run the dashboard mocked test**

Run from `server`: `node -e "require('./test/dashboard.test.js')"`
Expected: pass / fail 0 (the mock masters default `deletedAt: null`, so filtered counts equal the previous counts — no behavior change for live data).

- [ ] **Step 3: Commit**

```
git add server/utils/searchQuery.js server/routes/dashboard.js
git commit -m "feat(api): exclude soft-deleted from search + dashboard counts"
```

---

## Task 5: Audit-revert reconciliation + remove the obsolete guard

**Files:**
- Modify: `server/routes/audit.js`, `server/utils/taxonomyValidation.js`

- [ ] **Step 1: audit.js — restore a soft-deleted master instead of recreating**

The revert handler currently has an existence check that 409s if the row exists, then later `prisma[modelKey].create({ data: projected })`. Insert a soft-delete-restore branch at the existence check. Change:
```js
    // Check entity doesn't already exist (resurrection conflict on id)
    const existing = await prisma[modelKey].findUnique({ where: { id: projected.id } });
    if (existing) {
      return sendError(res, 409, 'CONFLICT',
        `Entity ${auditEntry.entity}:${projected.id} already exists — nothing to revert`,
        { field: 'id', value: projected.id });
    }
```
to:
```js
    // Soft-deletable masters: a deleted DELETE-audit row still EXISTS (deletedAt
    // set). Reverting it = clear deletedAt (restore), not recreate (Phase B2).
    const SOFT_DELETABLE = new Set(['trait', 'biome', 'species', 'ecosystem']);
    const existing = await prisma[modelKey].findUnique({ where: { id: projected.id } });
    if (existing) {
      if (SOFT_DELETABLE.has(modelKey) && existing.deletedAt) {
        const restored = await prisma[modelKey].update({
          where: { id: existing.id },
          data: { deletedAt: null },
        });
        await logAudit(req, auditEntry.entity, restored.id, 'UPDATE', { _revertedFrom: logId, restored: true });
        return res.json({ success: true, id: restored.id, entity: auditEntry.entity, revertedFrom: logId, restored: true });
      }
      return sendError(res, 409, 'CONFLICT',
        `Entity ${auditEntry.entity}:${projected.id} already exists — nothing to revert`,
        { field: 'id', value: projected.id });
    }
```
(The `else`/absent-row path keeps the existing slug-collision check + `.create()` recreate for legacy pre-B2 hard-delete tombstones.)

- [ ] **Step 2: taxonomyValidation.js — remove the obsolete guard**

Delete the `assertNotInReleasedVersion` function (the block with its RFC #1 comment) and remove it from `module.exports`. The exports become:
```js
module.exports = {
  buildIdOrSlugWhere,
  findByIdOrSlug,
  findExistingByIdOrSlug,
};
```

- [ ] **Step 3: Verify nothing still imports the removed guard**

Run from repo root: `grep -rn "assertNotInReleasedVersion" server/ || echo "NO REFERENCES"`
Expected: `NO REFERENCES` (Task 3 removed all route imports/calls; if any remain, fix them).

- [ ] **Step 4: Run the audit mocked test**

Run from `server`: `node -e "require('./test/audit.test.js')"`
Expected: pass / fail 0 (existing revert tests use legacy recreate path on absent rows — unaffected; the new branch only triggers when a row exists + is soft-deleted).

- [ ] **Step 5: Commit**

```
git add server/routes/audit.js server/utils/taxonomyValidation.js
git commit -m "feat(api): revert restores soft-deleted master; drop interim guard"
```

---

## Task 6: Flip versionImmutability test + add soft-delete mocked tests

**Files:**
- Modify: `server/test/versionImmutability.test.js`
- Create: `server/test/softDelete.test.js`
- Modify: `server/test/run-tests.js`

- [ ] **Step 1: Rewrite `versionImmutability.test.js` to assert soft-delete preserves history**

Replace the whole file content with:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, closeServer, createTaxonomyTestContext } = require('./utils');

// RFC #1 Phase B2: a master captured in a released version is no longer
// hard-delete-blocked — DELETE soft-deletes it (row + released snapshots
// survive). Immutability of released history is preserved by the row surviving,
// not by blocking the delete.

const taxonomy = createTaxonomyTestContext();
taxonomy.mock();

if (typeof test.after === 'function') test.after(() => taxonomy.restore());
else process.on('exit', taxonomy.restore);
if (typeof test.beforeEach === 'function') test.beforeEach(() => taxonomy.reset());

const CASES = [
  { entity: 'trait', path: 'traits', create: (t) => t.createTrait({ name: 'Versioned trait' }) },
  { entity: 'biome', path: 'biomes', create: (t) => t.createBiome({ name: 'Versioned biome' }) },
  { entity: 'species', path: 'species', create: (t) => t.createSpecies({ scientificName: 'Versioned sp.' }) },
  { entity: 'ecosystem', path: 'ecosystems', create: (t) => t.createEcosystem({ name: 'Versioned eco' }) },
];

for (const { entity, path, create } of CASES) {
  test(`DELETE /api/${path}/:id soft-deletes even when captured in a released version`, async () => {
    taxonomy.reset();
    const master = create(taxonomy);
    taxonomy.markReleased(entity, master.id);

    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/api/${path}/${master.id}`, {
        method: 'DELETE',
        headers: { 'X-Roles': 'taxonomy:write' },
      });
      assert.equal(res.status, 200);
      assert.equal((await res.json()).success, true);

      // Hidden from the default get, still fetchable with includeDeleted.
      const hidden = await fetch(`${baseUrl}/api/${path}/${master.id}`);
      assert.equal(hidden.status, 404);
      const shown = await fetch(`${baseUrl}/api/${path}/${master.id}?includeDeleted=true`);
      assert.equal(shown.status, 200);
    } finally {
      await closeServer(server);
    }
  });
}
```
(The `markReleased`/`releasedSnapshots`/released-guard mock branch in `utils.js` is now unused by this test but still exercised by B1's `taxonomyVersion.db.test.js` only at the DB level; leaving the mock branch in place is harmless. Do not remove it in this task to keep the diff focused.)

- [ ] **Step 2: Create `server/test/softDelete.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, closeServer, createTaxonomyTestContext } = require('./utils');

const taxonomy = createTaxonomyTestContext();
taxonomy.mock();

if (typeof test.after === 'function') test.after(() => taxonomy.restore());
else process.on('exit', taxonomy.restore);
if (typeof test.beforeEach === 'function') test.beforeEach(() => taxonomy.reset());

const WRITE = { 'X-Roles': 'taxonomy:write' };

const CASES = [
  { path: 'traits', create: (t) => t.createTrait({ name: 'Soft trait' }) },
  { path: 'biomes', create: (t) => t.createBiome({ name: 'Soft biome' }) },
  { path: 'species', create: (t) => t.createSpecies({ scientificName: 'Soft sp.' }) },
  { path: 'ecosystems', create: (t) => t.createEcosystem({ name: 'Soft eco' }) },
];

for (const { path, create } of CASES) {
  test(`${path}: soft-delete hides from list; includeDeleted shows; restore brings back`, async () => {
    taxonomy.reset();
    const m = create(taxonomy);
    const { server, baseUrl } = await startServer();
    try {
      // delete
      const del = await fetch(`${baseUrl}/api/${path}/${m.id}`, { method: 'DELETE', headers: WRITE });
      assert.equal(del.status, 200);

      // list hides it
      const list = await (await fetch(`${baseUrl}/api/${path}`)).json();
      assert.ok(!list.items.some((x) => x.id === m.id), 'soft-deleted hidden from list');

      // includeDeleted shows it
      const listAll = await (await fetch(`${baseUrl}/api/${path}?includeDeleted=true`)).json();
      assert.ok(listAll.items.some((x) => x.id === m.id), 'includeDeleted reveals it');

      // double-delete -> 409
      const del2 = await fetch(`${baseUrl}/api/${path}/${m.id}`, { method: 'DELETE', headers: WRITE });
      assert.equal(del2.status, 409);
      assert.equal((await del2.json()).code, 'ALREADY_DELETED');

      // restore
      const res = await fetch(`${baseUrl}/api/${path}/${m.id}/restore`, { method: 'POST', headers: WRITE });
      assert.equal(res.status, 200);
      const back = await (await fetch(`${baseUrl}/api/${path}`)).json();
      assert.ok(back.items.some((x) => x.id === m.id), 'restored back into list');

      // restore again -> 409 NOT_DELETED
      const res2 = await fetch(`${baseUrl}/api/${path}/${m.id}/restore`, { method: 'POST', headers: WRITE });
      assert.equal(res2.status, 409);
      assert.equal((await res2.json()).code, 'NOT_DELETED');
    } finally {
      await closeServer(server);
    }
  });
}
```

- [ ] **Step 3: Register `softDelete.test.js` in `run-tests.js`**

Add `'softDelete.test.js',` to the `testFiles` array (place after `'versionImmutability.test.js',`).

- [ ] **Step 4: Run both test files**

Run from `server`: `node --test test/versionImmutability.test.js test/softDelete.test.js`
Expected: all pass / fail 0 (versionImmutability = 4, softDelete = 4).

- [ ] **Step 5: Commit**

```
git add server/test/versionImmutability.test.js server/test/softDelete.test.js server/test/run-tests.js
git commit -m "test(api): soft-delete/restore coverage; flip immutability semantics"
```

---

## Task 7: Real-Postgres soft-delete test + CI wiring

**Files:**
- Create: `server/test/softDelete.db.test.js`
- Modify: `.github/workflows/backend-and-frontend-tests.yml`

- [ ] **Step 1: Create `server/test/softDelete.db.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, closeServer } = require('./utils');
const prisma = require('../db/prisma');

// Requires real Postgres (migrated + seeded + backfilled). Verifies soft-delete
// hides a master from glossary while its released snapshots survive, and that
// restore + audit-revert bring it back.

const ADMIN = { 'X-Roles': 'admin', 'Content-Type': 'application/json' };
const WRITE = { 'X-Roles': 'taxonomy:write' };
const TAG = 'v9.9.6-b2test';

async function cleanupVersion(tag) {
  const v = await prisma.taxonomyVersion.findUnique({ where: { tag } });
  if (!v) return;
  await prisma.traitVersion.deleteMany({ where: { versionId: v.id } });
  await prisma.biomeVersion.deleteMany({ where: { versionId: v.id } });
  await prisma.speciesVersion.deleteMany({ where: { versionId: v.id } });
  await prisma.ecosystemVersion.deleteMany({ where: { versionId: v.id } });
  await prisma.taxonomyVersion.delete({ where: { id: v.id } });
}

test.after(async () => {
  try { await cleanupVersion(TAG); } finally { await prisma.$disconnect(); }
});

test('soft-delete a versioned trait: hidden from glossary, snapshot survives, restore brings back', async () => {
  const { server, baseUrl } = await startServer();
  try {
    await cleanupVersion(TAG);
    // pick a seeded trait
    const trait = await prisma.trait.findFirst({ where: { deletedAt: null }, orderBy: { slug: 'asc' } });
    assert.ok(trait, 'a live trait must exist');

    // release a version so the trait is captured in a released snapshot
    await fetch(`${baseUrl}/api/taxonomy/versions`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ tag: TAG }) });
    await fetch(`${baseUrl}/api/taxonomy/versions/${TAG}/release`, { method: 'POST', headers: ADMIN });
    const versionRow = await prisma.taxonomyVersion.findUnique({ where: { tag: TAG } });
    const snapBefore = await prisma.traitVersion.count({ where: { versionId: versionRow.id, traitId: trait.id } });
    assert.equal(snapBefore, 1, 'trait captured in released snapshot');

    // soft-delete the trait
    const del = await fetch(`${baseUrl}/api/traits/${trait.id}`, { method: 'DELETE', headers: WRITE });
    assert.equal(del.status, 200);

    // glossary excludes it; its released snapshot survives
    const glossary = await (await fetch(`${baseUrl}/api/traits/glossary`)).json();
    assert.ok(!glossary.traits.some((t) => t._id === trait.slug), 'soft-deleted trait absent from glossary');
    const snapAfter = await prisma.traitVersion.count({ where: { versionId: versionRow.id, traitId: trait.id } });
    assert.equal(snapAfter, 1, 'released snapshot survives soft-delete');

    // restore
    const res = await fetch(`${baseUrl}/api/traits/${trait.id}/restore`, { method: 'POST', headers: WRITE });
    assert.equal(res.status, 200);
    const glossary2 = await (await fetch(`${baseUrl}/api/traits/glossary`)).json();
    assert.ok(glossary2.traits.some((t) => t._id === trait.slug), 'trait back in glossary after restore');
  } finally {
    await closeServer(server);
  }
});
```

- [ ] **Step 2: Run it against local DB**

Run from `server`: `node --test test/softDelete.db.test.js`
Expected: pass 1 / fail 0. (Local DB migrated+seeded+backfilled. The test restores the trait, so it leaves seed data live; it cleans up its version in `after`.)

- [ ] **Step 3: Wire into the CI `search-db` job**

In `.github/workflows/backend-and-frontend-tests.yml`, in the `search-db` job, after the `Run taxonomy-version lifecycle DB tests` step, add:
```yaml
      - name: Run soft-delete DB tests
        working-directory: server
        run: node -e "require('./test/softDelete.db.test.js')"
```

- [ ] **Step 4: Commit**

```
git add server/test/softDelete.db.test.js .github/workflows/backend-and-frontend-tests.yml
git commit -m "test(db): real-PG soft-delete + snapshot survival + CI wiring"
```

---

## Task 8: Docs (CLAUDE.md #159 rule + RFC) + full-suite verify + PR

**Files:**
- Modify: `CLAUDE.md`, `docs/rfc/2026-05-21-schema-versioning.md`

- [ ] **Step 1: Add the non-interactive-migrate anti-pattern to CLAUDE.md (closes #159's doc ask)**

In `C:/dev/Game-Database/CLAUDE.md`, append a short subsection under the existing guidance (e.g. after the "Port allocation" or near the Prisma/commands area — place it as a new `## Migration discipline` section near the end). Content:
```markdown
## Migration discipline (issue #159)

`prisma migrate dev` is **interactive** (prompts for the migration name + confirmations); run in an agent/CI context with no TTY it hangs forever (a real run hung ~5.4h). In any automated path:

- Author: `npx prisma migrate dev --create-only --name <name>` (supplies the name, no prompt; does not apply).
- Apply: `npx prisma migrate deploy` (non-interactive).
- Diff only: `npx prisma migrate diff ...` (read-only).

NEVER run bare `npx prisma migrate dev` in automation.
```

- [ ] **Step 2: Update RFC #1 status (B1 merged + B2)**

In `docs/rfc/2026-05-21-schema-versioning.md`, update the `**Status**:` line to note Phase B1 merged `617215f` (#158) and Phase B2 in progress (soft-delete). Keep it one line.

- [ ] **Step 3: Full mocked suite + doc-sync + ASCII scan**

Run from `server`: `npm test` → expect exit 0, all files pass (including the new `softDelete.test.js` + flipped `versionImmutability.test.js`).
Run from `server`: `npm run schema:doc:check` → `schema-reference.md is up-to-date`.
Run from repo root the ASCII scan over all new/modified executable files:
```
node -e "['server/utils/softDelete.js','server/routes/traits.js','server/routes/biomes.js','server/routes/species.js','server/routes/ecosystems.js','server/utils/searchQuery.js','server/routes/dashboard.js','server/routes/audit.js','server/utils/taxonomyValidation.js','server/test/utils.js','server/test/softDelete.test.js','server/test/softDelete.db.test.js','server/test/versionImmutability.test.js','.github/workflows/backend-and-frontend-tests.yml'].forEach(f=>console.log(f.split('/').pop(), /[^\x00-\x7F]/.test(require('fs').readFileSync(f,'utf8'))?'NON-ASCII':'OK'))"
```
Expected: all `OK`.

- [ ] **Step 4: Commit docs**

```
git add CLAUDE.md docs/rfc/2026-05-21-schema-versioning.md
git commit -m "docs: non-interactive migrate rule (#159) + RFC B1/B2 status"
```

- [ ] **Step 5: Push + open PR (pre-merge protocol applies)**

```
git push -u origin feat/schema-versioning-phase-b2
gh pr create --title "feat(api): schema versioning Phase B2 -- soft-delete + restore" --body "..."
```
PR body should note: closes #159 (doc rule added); replaces B1 interim hard-delete guard with soft-delete; `includeDeleted` escape hatch; glossary/search/dashboard always exclude deleted.

> **Pre-merge protocol (CLAUDE.md, MANDATORY):** triage `gh api repos/MasterDD-L34D/Game-Database/pulls/<N>/comments`; fix P1/P2, re-run CI, then merge. Update RFC post-merge.

---

## Self-Review

**Spec coverage:**
- `deletedAt` + index on 4 masters, non-interactive migrate (#159) → Task 1. ✓
- `liveFilter` helper → Task 2. ✓
- Soft-delete + restore + list/get/glossary filter (4 routes) → Task 3. ✓
- Search + dashboard exclude → Task 4. ✓
- Audit-revert reconciliation + guard removal → Task 5. ✓
- Slug stays reserved (no uniqueness migration) → confirmed (Task 1 changes no constraint). ✓
- Hide-by-default + `?includeDeleted` on list+get; glossary/search/counts always exclude → Tasks 3+4. ✓
- Tests (mocked soft-delete + flipped immutability + real-PG snapshot survival) → Tasks 6+7. ✓
- Records excluded, junctions untouched → Task 1 (only 4 masters get the column); no junction edits anywhere. ✓
- #159 doc note → Task 8. ✓

**Placeholder scan:** PR `--body "..."` (Task 8) is author-written at PR time. Task 3 Step 5 flags a deliberate "remove the stray `version: undefined`" correction — the final restore return is `{ success: true, id: restored.id }`. No code-step placeholders.

**Type consistency:** `liveFilter(req)` signature consistent (util + all routes). Error codes `ALREADY_DELETED`/`NOT_DELETED`/`NOT_FOUND`/`CONFLICT` consistent across routes, audit, and tests. `deletedAt` field name consistent across schema, mock, routes, search SQL (`"deletedAt"`), dashboard. `SOFT_DELETABLE` set in audit.js matches the 4 soft-deletable models. The restore endpoint path `/:id/restore` matches the test calls.

**Fix applied inline:** Task 3 Step 5's first-draft restore `return` had a stray `version: undefined,`; the step text explicitly instructs returning `{ success: true, id: restored.id }`.
