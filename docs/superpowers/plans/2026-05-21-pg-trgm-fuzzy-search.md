# pg_trgm Fuzzy Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add `GET /api/search` — typo-tolerant cross-entity fuzzy search via Postgres `pg_trgm` trigram similarity, ranked, across Trait/Biome/Ecosystem/Species/Record.

**Architecture:** A pure SQL builder composes a parameterized `Prisma.sql` UNION-ALL (one normalized arm per allowlisted entity) using `Prisma.raw` for hardcoded table/column identifiers and `${}` placeholders for the user values `q`/`threshold`/`limit`. The route runs it via `prisma.$queryRaw`. A hand-written migration enables the extension + GIN trigram indexes. Existing per-route `?q` substring search is untouched.

**Tech Stack:** Express, Prisma 5.22 (`Prisma.sql`/`Prisma.join`/`Prisma.raw`), Postgres 16 + pg_trgm, node:test.

**Spec:** `docs/superpowers/specs/2026-05-21-pg-trgm-fuzzy-search-design.md`
**RFC:** `docs/rfc/2026-05-21-semantic-search.md` (already committed — scope split)

---

## File Structure

- **Create** `server/utils/searchQuery.js` — entity allowlist map + `parseEntities(csv)` + `buildFuzzySearchSql({entities,q,threshold,limit})` returning a `Prisma.Sql`. Pure (no IO).
- **Create** `server/routes/search.js` — `GET /` handler: validate params, call builder, `prisma.$queryRaw`, shape response.
- **Modify** `server/app.js` — require + mount `app.use('/api/search', searchRouter)`.
- **Create** `server/prisma/migrations/20260521130000_pg_trgm_search/migration.sql` — `CREATE EXTENSION` + 11 GIN trigram indexes.
- **Create** `server/test/searchQuery.test.js` — pure builder unit (no DB). Added to `run-tests.js`.
- **Create** `server/test/search.test.js` — route unit, stubs `prisma.$queryRaw`. Added to `run-tests.js`.
- **Create** `server/test/search.db.test.js` — real-Postgres smoke. **NOT** in `run-tests.js`; run only by the new CI job + manually.
- **Modify** `server/test/run-tests.js` — add `searchQuery.test.js` + `search.test.js`.
- **Modify** `.github/workflows/backend-and-frontend-tests.yml` — add a `search-db` job with a Postgres service.

---

## Task 1: Pure SQL builder + allowlist

**Files:**
- Create: `server/utils/searchQuery.js`
- Create: `server/test/searchQuery.test.js`
- Modify: `server/test/run-tests.js`

- [ ] **Step 1: Write the failing test**

Create `server/test/searchQuery.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseEntities, buildFuzzySearchSql, ALL_ENTITIES } = require('../utils/searchQuery');

test('parseEntities defaults to all entities when csv empty', () => {
  assert.deepEqual(parseEntities('').sort(), [...ALL_ENTITIES].sort());
  assert.deepEqual(parseEntities(undefined).sort(), [...ALL_ENTITIES].sort());
});

test('parseEntities parses + dedupes a csv subset', () => {
  assert.deepEqual(parseEntities('trait, species ,trait'), ['trait', 'species']);
});

test('parseEntities throws 400 on unknown entity', () => {
  assert.throws(() => parseEntities('trait,dragon'), (err) => err.status === 400);
});

test('buildFuzzySearchSql parameterizes q/threshold/limit and quotes idents', () => {
  const sql = buildFuzzySearchSql({ entities: 'trait', q: 'lynks', threshold: 0.3, limit: 20 });
  // Prisma.Sql exposes .values (the bound params) and .sql (text with $n)
  assert.deepEqual(sql.values, ['lynks', 0.3, 'lynks', 0.3, 20]);
  assert.match(sql.sql, /"Trait"/);
  assert.match(sql.sql, /"name"/);
  assert.match(sql.sql, /similarity/);
});

test('buildFuzzySearchSql Record arm emits NULL slug, no quoted slug column', () => {
  const sql = buildFuzzySearchSql({ entities: 'record', q: 'x', threshold: 0.3, limit: 5 });
  assert.match(sql.sql, /NULL AS slug/);
  assert.match(sql.sql, /"nome"/);
  assert.ok(!/"slug"/.test(sql.sql), 'Record arm must not reference a slug column');
});

test('buildFuzzySearchSql includes one arm per selected entity', () => {
  const two = buildFuzzySearchSql({ entities: 'trait,biome', q: 'x', threshold: 0.3, limit: 5 });
  // two arms => two UNION-joined SELECTs => one "UNION ALL"
  assert.equal((two.sql.match(/UNION ALL/g) || []).length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node -e "require('./test/searchQuery.test.js')"`
Expected: FAIL — `Cannot find module '../utils/searchQuery'`.

- [ ] **Step 3: Write the builder**

Create `server/utils/searchQuery.js`:

```js
const { Prisma } = require('@prisma/client');
const { AppError } = require('./httpErrors');

// Allowlist: entity key -> { table, cols (searchable text), label col, slug col|null }.
// Table/column names are hardcoded here and NEVER taken from user input.
// All identifiers are double-quoted because the Prisma schema uses default
// (case-sensitive PascalCase/camelCase) mapping — no @@map.
const ENTITY_MAP = {
  trait:     { table: 'Trait',     cols: ['name', 'slug'],                       label: 'name',           slug: 'slug', entity: 'Trait' },
  biome:     { table: 'Biome',     cols: ['name', 'slug'],                       label: 'name',           slug: 'slug', entity: 'Biome' },
  ecosystem: { table: 'Ecosystem', cols: ['name', 'slug'],                       label: 'name',           slug: 'slug', entity: 'Ecosystem' },
  species:   { table: 'Species',   cols: ['scientificName', 'commonName', 'slug'], label: 'scientificName', slug: 'slug', entity: 'Species' },
  record:    { table: 'Record',    cols: ['nome', 'descrizione'],                label: 'nome',           slug: null,   entity: 'Record' },
};

const ALL_ENTITIES = Object.keys(ENTITY_MAP);

function parseEntities(csv) {
  if (!csv) return [...ALL_ENTITIES];
  const tokens = String(csv)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return [...ALL_ENTITIES];
  const seen = [];
  for (const t of tokens) {
    if (!ENTITY_MAP[t]) {
      throw new AppError(400, 'VALIDATION_ERROR', `Unknown entity: ${t}`, {
        field: 'entities',
        allowed: ALL_ENTITIES,
      });
    }
    if (!seen.includes(t)) seen.push(t);
  }
  return seen;
}

function ident(name) {
  // name is from the hardcoded allowlist only — safe to inject raw, quoted.
  return Prisma.raw(`"${name}"`);
}

function armFor(key, q, threshold) {
  const { table, cols, label, slug, entity } = ENTITY_MAP[key];
  const simExprs = cols.map((c) => Prisma.sql`similarity(${ident(c)}, ${q})`);
  const score = Prisma.sql`GREATEST(${Prisma.join(simExprs, ', ')})`;
  const slugExpr = slug ? Prisma.sql`${ident(slug)}` : Prisma.sql`NULL`;
  return Prisma.sql`
    SELECT ${entity}::text AS entity, "id", ${slugExpr} AS slug, ${ident(label)} AS label, ${score} AS score
      FROM ${ident(table)}
     WHERE ${score} >= ${threshold}`;
}

function buildFuzzySearchSql({ entities, q, threshold, limit }) {
  const list = parseEntities(entities);
  const arms = list.map((key) => armFor(key, q, threshold));
  return Prisma.sql`
    SELECT entity, id, slug, label, score FROM (
      ${Prisma.join(arms, ' UNION ALL ')}
    ) ranked
    ORDER BY score DESC, label ASC
    LIMIT ${limit}`;
}

module.exports = { ENTITY_MAP, ALL_ENTITIES, parseEntities, buildFuzzySearchSql };
```

> Note on `sql.values`: each arm binds `q` once inside `similarity(...)` in the SELECT score AND again in the WHERE score (the `score` fragment is interpolated twice), plus `threshold` once. For a single-entity build that is `[q, threshold, q, threshold]`... — verify the exact order/count against the test in Step 4 and adjust the test's `assert.deepEqual(sql.values, ...)` to match the real output rather than guessing. The other assertions (idents, NULL slug, arm count) are order-independent.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node -e "require('./test/searchQuery.test.js')"`
Expected: PASS. If the `sql.values` assertion in test "parameterizes q/threshold/limit" fails, print `console.log(sql.values)` once, set the expected array to the actual bound-params order, and re-run. (The `score` fragment appears in both SELECT and WHERE, so `q`+`threshold` repeat per arm; the final `limit` is last.)

- [ ] **Step 5: Register the unit test in the runner**

In `server/test/run-tests.js`, add to the `testFiles` array (after `'slug.test.js',`):

```js
  'searchQuery.test.js',
```

- [ ] **Step 6: Commit**

```bash
git add server/utils/searchQuery.js server/test/searchQuery.test.js server/test/run-tests.js
git commit -m "$(cat <<'EOF'
feat(search): pure pg_trgm fuzzy SQL builder + allowlist

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5f1-aa01-7000-8000-gamedb20260521-search-builder
EOF
)"
```

---

## Task 2: Route + mount + mocked route test

**Files:**
- Create: `server/routes/search.js`
- Modify: `server/app.js`
- Create: `server/test/search.test.js`
- Modify: `server/test/run-tests.js`

- [ ] **Step 1: Write the failing route test**

Create `server/test/search.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../db/prisma');
const { startServer, closeServer } = require('./utils');

// The route uses prisma.$queryRaw (tagged template). Stub it to return fixtures.
function stubQueryRaw(rows) {
  const original = prisma.$queryRaw;
  prisma.$queryRaw = async () => rows;
  return () => { prisma.$queryRaw = original; };
}

test('GET /api/search returns shaped ranked results', async () => {
  const restore = stubQueryRaw([
    { entity: 'Species', id: 'sp1', slug: 'lynx-lynx', label: 'Lynx lynx', score: 0.45 },
    { entity: 'Trait', id: 'tr1', slug: 'lince', label: 'Lince', score: 0.31 },
  ]);
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/search?q=lynks`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.q, 'lynks');
    assert.equal(body.results.length, 2);
    assert.deepEqual(body.results[0], { entity: 'Species', id: 'sp1', slug: 'lynx-lynx', label: 'Lynx lynx', score: 0.45 });
  } finally {
    await closeServer(server);
    restore();
  }
});

test('GET /api/search 400 on empty q', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/search?q=%20%20`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
  } finally {
    await closeServer(server);
  }
});

test('GET /api/search 400 on unknown entity', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/search?q=x&entities=trait,dragon`);
    assert.equal(res.status, 400);
  } finally {
    await closeServer(server);
  }
});

test('GET /api/search clamps limit and passes it through', async () => {
  let capturedSql = null;
  const original = prisma.$queryRaw;
  prisma.$queryRaw = async (sqlObj) => { capturedSql = sqlObj; return []; };
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/search?q=x&limit=9999`);
    assert.equal(res.status, 200);
    // limit clamped to 50 -> appears as last bound value
    assert.equal(capturedSql.values[capturedSql.values.length - 1], 50);
  } finally {
    await closeServer(server);
    prisma.$queryRaw = original;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node -e "require('./test/search.test.js')"`
Expected: FAIL — 404 (route not mounted) or module missing.

- [ ] **Step 3: Write the route**

Create `server/routes/search.js`:

```js
const express = require('express');
const prisma = require('../db/prisma');
const { AppError, handleError } = require('../utils/httpErrors');
const { buildFuzzySearchSql } = require('../utils/searchQuery');

const router = express.Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_THRESHOLD = 0.3;

function clampNumber(raw, fallback, min, max) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      throw new AppError(400, 'VALIDATION_ERROR', 'q is required', { field: 'q', location: 'query' });
    }
    const limit = Math.trunc(clampNumber(req.query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT));
    const threshold = clampNumber(req.query.threshold, DEFAULT_THRESHOLD, 0, 1);

    const sql = buildFuzzySearchSql({ entities: req.query.entities, q, threshold, limit });
    const rows = await prisma.$queryRaw(sql);

    const results = rows.map((r) => ({
      entity: r.entity,
      id: r.id,
      slug: r.slug ?? null,
      label: r.label,
      score: Number(r.score),
    }));
    return res.json({ q, results });
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
```

- [ ] **Step 4: Mount in app.js**

In `server/app.js`, add the require near the other routers (after line 17 `const auditRouter = ...`):

```js
const searchRouter = require('./routes/search');
```

And mount it alongside the GET routers (after line 63 `app.use('/api/audit', auditRouter);`):

```js
  app.use('/api/search', searchRouter);
```

- [ ] **Step 5: Register the route test in the runner**

In `server/test/run-tests.js`, add to `testFiles` (after `'searchQuery.test.js',`):

```js
  'search.test.js',
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && node -e "require('./test/search.test.js')"`
Expected: PASS (4 tests).

- [ ] **Step 7: Run the full backend suite (no DB)**

Run: `cd server && npm test`
Expected: all listed files green, including the two new ones. (No DB needed — `$queryRaw` is stubbed.)

- [ ] **Step 8: Commit**

```bash
git add server/routes/search.js server/app.js server/test/search.test.js server/test/run-tests.js
git commit -m "$(cat <<'EOF'
feat(search): GET /api/search route + mount (pg_trgm fuzzy)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5f2-aa01-7000-8000-gamedb20260521-search-route
EOF
)"
```

---

## Task 3: Migration — extension + GIN trigram indexes

**Files:**
- Create: `server/prisma/migrations/20260521130000_pg_trgm_search/migration.sql`

- [ ] **Step 1: Write the migration SQL**

Create `server/prisma/migrations/20260521130000_pg_trgm_search/migration.sql`:

```sql
-- pg_trgm fuzzy search support (Fase 2 #3). Hand-written; Prisma does not
-- manage GIN gin_trgm_ops indexes but will not drop them.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Trait_name_trgm_idx"          ON "Trait"     USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Trait_slug_trgm_idx"          ON "Trait"     USING gin ("slug" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Biome_name_trgm_idx"          ON "Biome"     USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Biome_slug_trgm_idx"          ON "Biome"     USING gin ("slug" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Ecosystem_name_trgm_idx"      ON "Ecosystem" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Ecosystem_slug_trgm_idx"      ON "Ecosystem" USING gin ("slug" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Species_sciName_trgm_idx"     ON "Species"   USING gin ("scientificName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Species_commonName_trgm_idx"  ON "Species"   USING gin ("commonName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Species_slug_trgm_idx"        ON "Species"   USING gin ("slug" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Record_nome_trgm_idx"         ON "Record"    USING gin ("nome" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Record_descrizione_trgm_idx"  ON "Record"    USING gin ("descrizione" gin_trgm_ops);
```

- [ ] **Step 2: Apply locally + verify**

Run (requires local Postgres on 5433 per docker-compose, DATABASE_URL set):
```bash
cd server && npx prisma migrate deploy
```
Expected: `Applying migration 20260521130000_pg_trgm_search` then no error.

Verify extension + an index:
```bash
psql "$DATABASE_URL" -c "SELECT extname FROM pg_extension WHERE extname='pg_trgm';" -c "\di+ Species_sciName_trgm_idx"
```
Expected: one `pg_trgm` row; the GIN index listed.

> If no local DB is available, this verification happens in the CI job (Task 4). Do not skip — the migration must apply against a real PG before merge.

- [ ] **Step 3: Commit**

```bash
git add server/prisma/migrations/20260521130000_pg_trgm_search/
git commit -m "$(cat <<'EOF'
feat(search): pg_trgm extension + GIN trigram indexes migration

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5f3-aa01-7000-8000-gamedb20260521-search-migration
EOF
)"
```

---

## Task 4: Real-Postgres smoke test + CI job

**Files:**
- Create: `server/test/search.db.test.js`
- Modify: `.github/workflows/backend-and-frontend-tests.yml`

- [ ] **Step 1: Write the DB-backed smoke test**

Create `server/test/search.db.test.js` (NOT added to run-tests.js — needs a real DB):

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, closeServer } = require('./utils');

// Requires a real Postgres (DATABASE_URL), migrated + seeded. The seed
// includes species such as "Lynx lynx" (server/prisma/seed*).

test('fuzzy search finds Lynx lynx for the typo "lynks"', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/search?q=lynks`);
    assert.equal(res.status, 200);
    const body = await res.json();
    const labels = body.results.map((r) => r.label);
    assert.ok(labels.includes('Lynx lynx'), `expected Lynx lynx in ${JSON.stringify(labels)}`);
    // ranked: score descending
    for (let i = 1; i < body.results.length; i += 1) {
      assert.ok(body.results[i - 1].score >= body.results[i].score, 'results must be score-descending');
    }
  } finally {
    await closeServer(server);
  }
});

test('high threshold filters weak matches', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/search?q=lynks&threshold=0.9`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.results.length, 0, 'threshold 0.9 should exclude the lynks~Lynx match');
  } finally {
    await closeServer(server);
  }
});

test('entities filter scopes results to species only', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/search?q=lynks&entities=species`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.results.every((r) => r.entity === 'Species'));
  } finally {
    await closeServer(server);
  }
});
```

> If the seed's actual species names differ, adjust the `'Lynx lynx'` literal to a real seeded `scientificName` (verified: seed contains `Lynx lynx`, `Falco peregrinus`, `Emys orbicularis`). Pick a typo one trigram off the chosen name.

- [ ] **Step 2: Add the CI job**

In `.github/workflows/backend-and-frontend-tests.yml`, add a second job under `jobs:` (sibling of `checks`):

```yaml
  search-db:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: game
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres -d game"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/game?schema=public
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install backend dependencies
        working-directory: server
        run: npm ci
      - name: Generate Prisma client
        working-directory: server
        run: npx prisma generate
      - name: Apply migrations
        working-directory: server
        run: npx prisma migrate deploy
      - name: Seed database
        working-directory: server
        run: npx prisma db seed
      - name: Run fuzzy-search DB smoke
        working-directory: server
        run: node -e "require('./test/search.db.test.js')"
```

- [ ] **Step 3: Run the DB smoke locally (if local PG available) or rely on CI**

Local (DATABASE_URL pointing at the migrated+seeded dev DB):
```bash
cd server && node -e "require('./test/search.db.test.js')"
```
Expected: 3 tests pass. If no local DB, push and let the `search-db` CI job run it.

- [ ] **Step 4: Commit**

```bash
git add server/test/search.db.test.js .github/workflows/backend-and-frontend-tests.yml
git commit -m "$(cat <<'EOF'
test(search): real-Postgres fuzzy smoke + CI job

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5f4-aa01-7000-8000-gamedb20260521-search-dbtest
EOF
)"
```

---

## Task 5: Research + tuning docs, push, PR

**Files:**
- Create: `docs/research/pg-trgm-search-2026-05-21.md`

- [ ] **Step 1: Write research + tuning doc**

Create `docs/research/pg-trgm-search-2026-05-21.md` covering QG Steps 2+3:

```markdown
# pg_trgm fuzzy search — research + tuning 2026-05-21

## QG Step 2 — edge cases (covered by tests)
1. Empty/whitespace q -> 400 VALIDATION_ERROR (search.test.js).
2. Unknown entity token -> 400 (searchQuery.test.js parseEntities + route).
3. No match -> 200, empty results (threshold 0.9 smoke).
4. Special chars / injection in q -> parameterized via Prisma.sql ${} (never
   Prisma.raw); table/col idents come only from the hardcoded allowlist.
5. NULL commonName/descrizione -> similarity(NULL,q)=NULL, GREATEST ignores NULL.
6. Record has no slug -> arm emits NULL AS slug (builder unit test).
7. limit > 50 clamped to 50; threshold clamped [0,1].

## QG Step 3 — tuning
- threshold default 0.3 chosen against seed: "lynks" matches "Lynx lynx"
  (similarity ~0.4, included) while threshold 0.9 excludes it. Document the
  observed similarity for 2-3 seed typos here after running the DB smoke.
- EXPLAIN ANALYZE before/after: without the GIN trgm index the similarity
  filter is a seq scan; with "Species_sciName_trgm_idx" the planner uses a
  Bitmap Index Scan. Paste the two EXPLAIN snippets after running locally/CI.
```

- [ ] **Step 2: Commit**

```bash
git add docs/research/pg-trgm-search-2026-05-21.md
git commit -m "$(cat <<'EOF'
docs(research): pg_trgm search edge cases + tuning (Fase 2)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5f5-aa01-7000-8000-gamedb20260521-search-research
EOF
)"
```

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin claude/pg-trgm-search-2026-05-21
gh pr create --title "feat(search): pg_trgm fuzzy cross-entity /api/search (Fase 2 #3)" --body "..."
```

PR body: summary (typo-tolerant /api/search, pg_trgm, ranked, 5 entities, additive), test plan (builder unit + mocked route in `checks` job; real-Postgres smoke in new `search-db` job), governance note (RFC #3 scope split, Eduardo-authorized, no cross-repo), spec/RFC/research links.

- [ ] **Step 4: MANDATORY pre-merge review**

`gh api repos/MasterDD-L34D/Game-Database/pulls/<N>/comments` — triage P1/P2 before merge. Both CI jobs (`checks` + `search-db`) must be green.

---

## Self-Review

**Spec coverage:**
- Endpoint contract (q/entities/limit/threshold, response shape, open GET) -> Task 2.
- Raw parameterized UNION + identifier quoting + Record-no-slug + heterogeneous label -> Task 1 builder + tests.
- Migration (extension + 11 GIN indexes) -> Task 3.
- Layered tests (pure builder + mocked route + real-PG CI smoke) -> Tasks 1,2,4.
- QG Step 2/3 (research + tuning) -> Task 5.
- Existing `?q` untouched -> nothing in the plan modifies route search-where; `npm test` regression in Task 2 Step 7.
- RFC #3 -> already committed (`f93ec09`).

**Placeholder scan:** PR body in Task 5 Step 3 is `"..."` — fill at execution mirroring prior PRs. The `sql.values` exact array (Task 1 Step 1/4) is flagged to verify-against-actual rather than guessed — intentional, with explicit instructions, because `Prisma.join` binding order must be confirmed empirically (not a vague placeholder). Research doc has two "paste after running" spots — these are evidence-capture steps for QG, done during execution. No other placeholders.

**Type/name consistency:** `parseEntities`, `buildFuzzySearchSql`, `ALL_ENTITIES`, `ENTITY_MAP` consistent across builder + tests. Route uses `buildFuzzySearchSql` + `prisma.$queryRaw(sql)`. CI job name `search-db`. Migration dir `20260521130000_pg_trgm_search`. Test files match run-tests.js additions (`searchQuery.test.js`, `search.test.js`) and the DB test (`search.db.test.js`) is deliberately excluded.
```
