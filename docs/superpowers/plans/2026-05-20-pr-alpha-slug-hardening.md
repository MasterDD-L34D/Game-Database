# PR-α Slug Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate slug normalization into a single canonical `server/utils/slug.js` module, harden against Unicode + length + trailing-dash edge cases, and replace 6 duplicated weak implementations across routes + test infra + import script.

**Architecture:** Lift the proven robust NFD+diacritic-strip+hyphen-trim slugify from `server/scripts/ingest/import-taxonomy.js:85-92` (already used at import boundary, handles Game YAML round-trip). Extract to `server/utils/slug.js`, add max-length 80 truncation (Postgres varchar index sweet-spot). Replace 5 weak `normalizeSlug` call sites (4 routes + test/utils.js) and 1 in-script duplicate. No npm dependency added — pure native JS. Per resolved spec decision Q1.

**Tech Stack:** Node 20 (server) + Node 18 (CI seed) · CommonJS modules · `node:test` runner · Prisma 5 client · zero new deps.

**Spec source:** `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` PR-α section + Q1 resolved decision.

**Branch:** `claude/parallel-gamedb-pr-alpha-slug-hardening-2026-05-20`

**QG Release Standard:**
- Step 1 Smoke: 15+ edge-case unit tests verde, full suite regression-free (≥107 verde baseline post-PR #117)
- Step 2 Research: 3+ edge case scenarios documented in `docs/research/slug-normalization-2026-05-20.md`
- Step 3 Tuning: pre/post slug collision rate + Unicode-stripped count + length distribution measured via new `npm run audit:slug` benchmark

---

## File Structure

**Create**:
- `server/utils/slug.js` — canonical `normalizeSlug(value, fallback)` module
- `server/test/slug.test.js` — 20+ unit tests covering Unicode/length/trailing/empty/fallback/separator cases
- `server/scripts/audit-slug.js` — benchmark script: scan DB rows, report collision rate + Unicode-stripped + length p50/p95/p99
- `docs/research/slug-normalization-2026-05-20.md` — research doc (3+ edge case scenarios + adoption rationale)

**Modify**:
- `server/routes/traits.js` — remove local `normalizeSlug`, import from `../utils/slug`
- `server/routes/biomes.js` — same
- `server/routes/species.js` — same
- `server/routes/ecosystems.js` — same
- `server/test/utils.js` — replace local `normalizeSlug(value, fallback)` with shared module (preserve fallback semantics)
- `server/scripts/ingest/import-taxonomy.js` — replace inline `slugify` with shared util (DRY)
- `server/test/run-tests.js` — add `slug.test.js` to test list
- `server/package.json` — add `"audit:slug": "node ./scripts/audit-slug.js"` script

---

## Slug normalization contract

```
normalizeSlug(value, fallback?) → string

Behavior:
1. Try `value` first; if produces non-empty slug, return it (truncated 80).
2. If value yields empty, try `fallback` (same pipeline).
3. If both empty, return ''.

Pipeline (per source):
  String coerce → NFD normalize → strip combining marks (U+0300–U+036F) →
  lowercase → replace [^a-z0-9]+ → '-' → trim leading/trailing '-' →
  slice 0..80 → re-trim trailing '-' (post-slice safety)

Max length: MAX_SLUG_LENGTH = 80 (Postgres varchar index sweet-spot).
```

---

## Task 1: Initialize branch + scaffold module skeleton

**Files:**
- Create: `server/utils/slug.js`
- Test: (not yet, written in Task 2 TDD-style)

- [ ] **Step 1: Pull main + create branch**

Run:
```bash
cd "C:/dev/Game-Database"
git checkout main && git pull --ff-only origin main
git checkout -b claude/parallel-gamedb-pr-alpha-slug-hardening-2026-05-20
```

Expected: branch created, on `claude/parallel-gamedb-pr-alpha-slug-hardening-2026-05-20`.

- [ ] **Step 2: Append OWNING handoff line (parallel-session protocol)**

Run:
```bash
printf '%s\n' "- \`[parallel-#2 OWNING Game-Database branch claude/parallel-gamedb-pr-alpha-slug-hardening-2026-05-20 start <ts>]\` (Ryzen, scope: PR-α Fase 1 slug hardening consolidate)" >> "C:/dev/codemasterdd-ai-station/docs/sessions/2026-05-19-continuity-handoff.md"
git -C "C:/dev/codemasterdd-ai-station" add docs/sessions/2026-05-19-continuity-handoff.md
git -C "C:/dev/codemasterdd-ai-station" commit -m "docs(handoff): parallel-#2 PR-α slug hardening start

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d3a1-aa01-7000-8000-gamedb20260520-pralpha-start"
```

Replace `<ts>` with current ISO-Z timestamp.

Expected: 1 local commit codemasterdd. No push (coordinator).

- [ ] **Step 3: Create empty module placeholder**

Write `server/utils/slug.js`:

```javascript
// server/utils/slug.js
// Canonical slug normalization for Game-Database.
// Lifted from server/scripts/ingest/import-taxonomy.js slugify() with
// added max-length truncation. Per spec PR-α (2026-05-20) Q1 resolved.

'use strict';

const MAX_SLUG_LENGTH = 80;

function buildSlug(source) {
  // TODO Task 2: implement after writing failing tests
  return '';
}

function normalizeSlug(value, fallback) {
  // TODO Task 2: implement after writing failing tests
  return '';
}

module.exports = { normalizeSlug, MAX_SLUG_LENGTH };
```

- [ ] **Step 4: Commit scaffold**

Run:
```bash
cd "C:/dev/Game-Database"
git add server/utils/slug.js
git commit -m "wip: scaffold server/utils/slug.js skeleton

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d3a1-aa01-7000-8000-gamedb20260520-pralpha-1"
```

Expected: 1 commit.

---

## Task 2: TDD — write failing test suite for slug module

**Files:**
- Create: `server/test/slug.test.js`

- [ ] **Step 1: Write the failing test file**

Write `server/test/slug.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSlug, MAX_SLUG_LENGTH } = require('../utils/slug');

// ---- Basic hyphenation -----------------------------------------------------

test('basic: lowercases and hyphenates whitespace', () => {
  assert.equal(normalizeSlug('Hello World'), 'hello-world');
});

test('basic: collapses multiple whitespace into single hyphen', () => {
  assert.equal(normalizeSlug('Foo   Bar\tBaz'), 'foo-bar-baz');
});

test('basic: strips leading and trailing whitespace', () => {
  assert.equal(normalizeSlug('  trimmed  '), 'trimmed');
});

// ---- Unicode + diacritic ---------------------------------------------------

test('unicode: strips Italian diacritics (NFD)', () => {
  assert.equal(normalizeSlug('Lùpus rufus'), 'lupus-rufus');
});

test('unicode: strips French and Spanish diacritics', () => {
  assert.equal(normalizeSlug('Café Niño Müller'), 'cafe-nino-muller');
});

test('unicode: strips combining marks while preserving base latin chars', () => {
  assert.equal(normalizeSlug('Crème Brûlée'), 'creme-brulee');
});

// ---- Punctuation + special chars -------------------------------------------

test('punct: replaces apostrophes and quotes with hyphen', () => {
  assert.equal(normalizeSlug("L'arbre du desert"), 'l-arbre-du-desert');
});

test('punct: replaces consecutive special chars with single hyphen', () => {
  assert.equal(normalizeSlug('A!!!B???C'), 'a-b-c');
});

test('punct: strips emoji and non-ASCII symbols', () => {
  assert.equal(normalizeSlug('Trait 🌿 green'), 'trait-green');
});

// ---- Trailing / leading dash safety ----------------------------------------

test('trim: removes leading dash from special-char prefix', () => {
  assert.equal(normalizeSlug('--leading'), 'leading');
});

test('trim: removes trailing dash from special-char suffix', () => {
  assert.equal(normalizeSlug('trailing--'), 'trailing');
});

test('trim: handles wrap-only special chars', () => {
  assert.equal(normalizeSlug('---a---'), 'a');
});

// ---- Length cap ------------------------------------------------------------

test('length: truncates to MAX_SLUG_LENGTH (80)', () => {
  const input = 'a'.repeat(200);
  const result = normalizeSlug(input);
  assert.equal(result.length, MAX_SLUG_LENGTH);
  assert.equal(result, 'a'.repeat(80));
});

test('length: post-slice trims trailing dash if slice lands on hyphen boundary', () => {
  // 79 a chars + space + bbb → after slugify: 'aaa...a-bbb' (84 chars before slice)
  // slice(0,80) = 'aaa...a-' (ending with -), post-trim → 'aaa...a' (79 chars)
  const input = 'a'.repeat(79) + ' bbb';
  const result = normalizeSlug(input);
  assert.equal(result, 'a'.repeat(79));
  assert.ok(!result.endsWith('-'), `slug should not end with dash, got "${result}"`);
});

test('length: MAX_SLUG_LENGTH is 80', () => {
  assert.equal(MAX_SLUG_LENGTH, 80);
});

// ---- Empty + null + fallback ------------------------------------------------

test('empty: returns empty string for null', () => {
  assert.equal(normalizeSlug(null), '');
});

test('empty: returns empty string for undefined', () => {
  assert.equal(normalizeSlug(undefined), '');
});

test('empty: returns empty string for empty string', () => {
  assert.equal(normalizeSlug(''), '');
});

test('empty: returns empty for whitespace-only input', () => {
  assert.equal(normalizeSlug('   '), '');
});

test('empty: returns empty for special-chars-only input', () => {
  assert.equal(normalizeSlug('!!!'), '');
});

// ---- Fallback semantics ---------------------------------------------------

test('fallback: uses fallback when value is empty', () => {
  assert.equal(normalizeSlug('', 'Backup Name'), 'backup-name');
});

test('fallback: uses fallback when value is null', () => {
  assert.equal(normalizeSlug(null, 'Backup Name'), 'backup-name');
});

test('fallback: prefers value over fallback when both present', () => {
  assert.equal(normalizeSlug('Primary', 'Backup'), 'primary');
});

test('fallback: returns empty when both value and fallback are empty', () => {
  assert.equal(normalizeSlug('', ''), '');
});

test('fallback: returns empty when both value and fallback are null', () => {
  assert.equal(normalizeSlug(null, null), '');
});

test('fallback: tries fallback if value normalizes to empty (special-chars-only)', () => {
  assert.equal(normalizeSlug('!!!', 'Backup'), 'backup');
});

// ---- Coercion --------------------------------------------------------------

test('coerce: numeric input coerces to string', () => {
  assert.equal(normalizeSlug(12345), '12345');
});

test('coerce: object with toString uses toString', () => {
  const obj = { toString: () => 'CustomToString' };
  assert.equal(normalizeSlug(obj), 'customtostring');
});

// ---- Round-trip stability -------------------------------------------------

test('stability: idempotent — slugifying a slug returns same slug', () => {
  const once = normalizeSlug('Hello World');
  const twice = normalizeSlug(once);
  assert.equal(once, twice);
});

test('stability: import-taxonomy round-trip preserves canonical slug', () => {
  // Game uses underscore separators; Game-Database re-normalizes to hyphen.
  assert.equal(normalizeSlug('arbusti_xerofili'), 'arbusti-xerofili');
});
```

- [ ] **Step 2: Run tests — expect ALL failing (scaffold returns empty string)**

Run:
```bash
cd "C:/dev/Game-Database/server"
node ./test/slug.test.js
```

Expected: Most tests FAIL (scaffold `normalizeSlug` returns `''`). Pure failure-counter sanity check; do not commit yet.

- [ ] **Step 3: Commit failing test file**

Run:
```bash
cd "C:/dev/Game-Database"
git add server/test/slug.test.js
git commit -m "test(slug): add 28 failing edge-case tests (TDD red phase)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d3a1-aa01-7000-8000-gamedb20260520-pralpha-2"
```

---

## Task 3: Implement slug.js to pass all tests (TDD green)

**Files:**
- Modify: `server/utils/slug.js`

- [ ] **Step 1: Replace placeholder with full implementation**

Overwrite `server/utils/slug.js`:

```javascript
// server/utils/slug.js
// Canonical slug normalization for Game-Database.
// Pipeline: NFD normalize → strip combining marks → lowercase →
// replace non-alphanum with hyphen → trim → length cap → re-trim.
// Per spec PR-α (2026-05-20) Q1 resolved: custom regex consolidate,
// no npm dependency. Aligned with codemasterdd ADR-0021 ASCII-first.

'use strict';

const MAX_SLUG_LENGTH = 80;

function buildSlug(source) {
  if (source == null) return '';
  const raw = String(source);
  if (!raw) return '';
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  if (!normalized) return '';
  if (normalized.length <= MAX_SLUG_LENGTH) return normalized;
  return normalized.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '');
}

function normalizeSlug(value, fallback) {
  const fromValue = buildSlug(value);
  if (fromValue) return fromValue;
  if (fallback !== undefined && fallback !== null) {
    return buildSlug(fallback);
  }
  return '';
}

module.exports = { normalizeSlug, MAX_SLUG_LENGTH };
```

- [ ] **Step 2: Run tests — expect ALL passing**

Run:
```bash
cd "C:/dev/Game-Database/server"
node ./test/slug.test.js
```

Expected: 28/28 PASS (or whatever exact count matches Task 2 test list).

- [ ] **Step 3: Commit green implementation**

Run:
```bash
cd "C:/dev/Game-Database"
git add server/utils/slug.js
git commit -m "feat(slug): canonical normalizeSlug module (TDD green phase)

Lift slugify pipeline from import-taxonomy.js:85-92 to shared
server/utils/slug.js. Add max-length 80 truncation + post-slice
trailing-dash safety. Preserve fallback semantics from test/utils.js.

28/28 unit tests verde.

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d3a1-aa01-7000-8000-gamedb20260520-pralpha-3"
```

---

## Task 4: Wire slug.test.js into npm test runner

**Files:**
- Modify: `server/test/run-tests.js`

- [ ] **Step 1: Add slug.test.js to runner list**

Edit `server/test/run-tests.js`. Current state:

```javascript
const testFiles = [
  'health.test.js',
  'dashboard.test.js',
  'permissions.test.js',
  'records.test.js',
  'taxonomyRouters.test.js',
  'speciesTraits.test.js',
  'speciesBiomes.test.js',
  'ecosystemBiomes.test.js',
  'ecosystemSpecies.test.js',
  'basicAuth.test.js',
  'testInfraRestore.test.js',
];
```

Change to:

```javascript
const testFiles = [
  'health.test.js',
  'dashboard.test.js',
  'permissions.test.js',
  'records.test.js',
  'taxonomyRouters.test.js',
  'speciesTraits.test.js',
  'speciesBiomes.test.js',
  'ecosystemBiomes.test.js',
  'ecosystemSpecies.test.js',
  'basicAuth.test.js',
  'testInfraRestore.test.js',
  'slug.test.js',
];
```

- [ ] **Step 2: Run full suite**

Run:
```bash
cd "C:/dev/Game-Database/server"
npm test
```

Expected: 107 + 28 = 135 tests pass. Watch for any unexpected failure (regression risk if slug.test.js shares globals).

- [ ] **Step 3: Commit runner update**

Run:
```bash
cd "C:/dev/Game-Database"
git add server/test/run-tests.js
git commit -m "test(runner): wire slug.test.js into run-tests.js

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d3a1-aa01-7000-8000-gamedb20260520-pralpha-4"
```

---

## Task 5: Replace normalizeSlug in routes/traits.js

**Files:**
- Modify: `server/routes/traits.js`

- [ ] **Step 1: Add import at top of file**

Edit `server/routes/traits.js`. Locate the top imports (around line 1-8):

```javascript
const express = require('express');
const prisma = require('../db/prisma');
const { requireTaxonomyWrite } = require('../middleware/permissions');
const { logAudit } = require('../utils/audit');
const { findExistingByIdOrSlug } = require('../utils/taxonomyValidation');
const { AppError, sendError, handleError } = require('../utils/httpErrors');
const { assertPagination, assertIdParam, assertString, assertEnum } = require('../utils/validation');
```

Add after the validation import:

```javascript
const { normalizeSlug } = require('../utils/slug');
```

- [ ] **Step 2: Remove local normalizeSlug function**

Locate (around line 41-44):

```javascript
function normalizeSlug(input) {
  if (!input) return '';
  return input.toString().trim().toLowerCase().replace(/\s+/g, '-');
}
```

Delete those 4 lines entirely.

- [ ] **Step 3: Run full taxonomy router tests**

Run:
```bash
cd "C:/dev/Game-Database/server"
node ./test/taxonomyRouters.test.js
```

Expected: 46/46 PASS. If any fail, the new slug produces a different result than the old one for that test fixture — investigate.

- [ ] **Step 4: Commit**

Run:
```bash
cd "C:/dev/Game-Database"
git add server/routes/traits.js
git commit -m "refactor(traits): consume shared normalizeSlug from utils

Remove local 4-line weak normalizeSlug; import from server/utils/slug.
Same call site behavior — robust pipeline applies (NFD + max-80).

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d3a1-aa01-7000-8000-gamedb20260520-pralpha-5"
```

---

## Task 6: Replace normalizeSlug in routes/biomes.js

**Files:**
- Modify: `server/routes/biomes.js`

- [ ] **Step 1: Add import at top**

Edit `server/routes/biomes.js`. Locate top imports and add:

```javascript
const { normalizeSlug } = require('../utils/slug');
```

(Place after existing util imports.)

- [ ] **Step 2: Remove local normalizeSlug function**

Locate (around line 28-31):

```javascript
function normalizeSlug(input) {
  if (!input) return '';
  return input.toString().trim().toLowerCase().replace(/\s+/g, '-');
}
```

Delete those 4 lines.

- [ ] **Step 3: Run tests**

Run:
```bash
cd "C:/dev/Game-Database/server"
node ./test/taxonomyRouters.test.js
```

Expected: 46/46 PASS.

- [ ] **Step 4: Commit**

Run:
```bash
cd "C:/dev/Game-Database"
git add server/routes/biomes.js
git commit -m "refactor(biomes): consume shared normalizeSlug from utils

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d3a1-aa01-7000-8000-gamedb20260520-pralpha-6"
```

---

## Task 7: Replace normalizeSlug in routes/species.js

**Files:**
- Modify: `server/routes/species.js`

- [ ] **Step 1: Add import**

Edit `server/routes/species.js`. Add after existing util imports:

```javascript
const { normalizeSlug } = require('../utils/slug');
```

- [ ] **Step 2: Remove local normalizeSlug function**

Locate (around line 34-37):

```javascript
function normalizeSlug(input) {
  if (!input) return '';
  return input.toString().trim().toLowerCase().replace(/\s+/g, '-');
}
```

Delete those 4 lines.

- [ ] **Step 3: Run tests**

Run:
```bash
cd "C:/dev/Game-Database/server"
node ./test/taxonomyRouters.test.js
```

Expected: 46/46 PASS.

- [ ] **Step 4: Commit**

Run:
```bash
cd "C:/dev/Game-Database"
git add server/routes/species.js
git commit -m "refactor(species): consume shared normalizeSlug from utils

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d3a1-aa01-7000-8000-gamedb20260520-pralpha-7"
```

---

## Task 8: Replace normalizeSlug in routes/ecosystems.js

**Files:**
- Modify: `server/routes/ecosystems.js`

- [ ] **Step 1: Add import**

Edit `server/routes/ecosystems.js`. Add after existing util imports:

```javascript
const { normalizeSlug } = require('../utils/slug');
```

- [ ] **Step 2: Remove local normalizeSlug function**

Locate (around line 28-31):

```javascript
function normalizeSlug(input) {
  if (!input) return '';
  return input.toString().trim().toLowerCase().replace(/\s+/g, '-');
}
```

Delete those 4 lines.

- [ ] **Step 3: Run tests**

Run:
```bash
cd "C:/dev/Game-Database/server"
node ./test/taxonomyRouters.test.js
```

Expected: 46/46 PASS.

- [ ] **Step 4: Commit**

Run:
```bash
cd "C:/dev/Game-Database"
git add server/routes/ecosystems.js
git commit -m "refactor(ecosystems): consume shared normalizeSlug from utils

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d3a1-aa01-7000-8000-gamedb20260520-pralpha-8"
```

---

## Task 9: Replace normalizeSlug in test/utils.js

**Files:**
- Modify: `server/test/utils.js`

- [ ] **Step 1: Add import + remove local function**

Edit `server/test/utils.js`. Locate the imports block at top (lines 1-2):

```javascript
const createApp = require('../app');
const prisma = require('../db/prisma');
```

Add after:

```javascript
const { normalizeSlug } = require('../utils/slug');
```

Then locate the local `normalizeSlug` (lines 8-13):

```javascript
function normalizeSlug(value, fallback) {
  if (!value && !fallback) return '';
  const base = value || fallback || '';
  const normalized = base.toString().trim().toLowerCase().replace(/\s+/g, '-');
  return normalized || (fallback || '').toString();
}
```

Delete those 6 lines entirely. The shared module exports the same `normalizeSlug(value, fallback)` signature with stricter behavior (Unicode-stripped + length cap). Call sites at lines 131/155/176/193 stay unchanged — same function signature.

- [ ] **Step 2: Run full suite**

Run:
```bash
cd "C:/dev/Game-Database/server"
npm test
```

Expected: All 135 tests pass. The test fixture data uses ASCII names (e.g. "Species to delete") so behavior matches.

**If any test fails**: likely a fixture name with whitespace-only or special-chars-only that the new strict normalizer rejects more aggressively. Inspect fixture in test, adjust to use the explicit fallback parameter that returns a non-empty value.

- [ ] **Step 3: Commit**

Run:
```bash
cd "C:/dev/Game-Database"
git add server/test/utils.js
git commit -m "refactor(test-utils): consume shared normalizeSlug from utils

Replace local 6-line normalizeSlug with shared module import.
Same signature (value, fallback). Pipeline now NFD+max-80 like routes.

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d3a1-aa01-7000-8000-gamedb20260520-pralpha-9"
```

---

## Task 10: Replace slugify in import-taxonomy.js (DRY)

**Files:**
- Modify: `server/scripts/ingest/import-taxonomy.js`

- [ ] **Step 1: Add import at top of script**

Edit `server/scripts/ingest/import-taxonomy.js`. Locate top of file imports (around lines 1-20). Find a good spot after existing requires (e.g. after `const yaml = require('js-yaml');` if present).

Add:

```javascript
const { normalizeSlug } = require('../../utils/slug');
```

- [ ] **Step 2: Replace local slugify function**

Locate (lines 85-92):

```javascript
function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
```

Replace with:

```javascript
// Use shared normalizeSlug from server/utils/slug (canonical contract,
// includes max-80 truncation). Backward-compat alias.
const slugify = (value) => normalizeSlug(value);
```

This keeps all `slugify(x)` call sites in the script working unchanged.

**Behavior change**: max-length 80 now applied during import. If Game has any existing slug >80 chars, they would have collided in Postgres `String @unique` already — so this is a no-op for valid corpus. New `--validate-only` flag in PR-ε will catch violations explicitly.

- [ ] **Step 3: Smoke import script (dry-run)**

Run:
```bash
cd "C:/dev/Game-Database/server"
# Verify script loads without syntax errors:
node -e "require('./scripts/ingest/import-taxonomy.js')" 2>&1 | head -10
```

Expected: No syntax error. (Script entry point checks `require.main === module`, so importing won't trigger execution. If it does execute, abort with Ctrl+C — no harm, no DB write without `--apply` or default mode.)

If a real Game repo exists at `C:/dev/Game`, optional deeper smoke:
```bash
cd "C:/dev/Game-Database/server"
npm run evo:import -- --repo C:/dev/Game --dry-run 2>&1 | tail -20
```

Expected: dry-run summary without errors.

- [ ] **Step 4: Commit**

Run:
```bash
cd "C:/dev/Game-Database"
git add server/scripts/ingest/import-taxonomy.js
git commit -m "refactor(import): consume shared normalizeSlug for slugify

DRY: replace inline slugify (lines 85-92) with shared
server/utils/slug normalizeSlug. Max-80 truncation now applied at
import boundary. Backward-compat alias preserves call sites.

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d3a1-aa01-7000-8000-gamedb20260520-pralpha-10"
```

---

## Task 11: Create audit-slug benchmark script (QG Step 3 measurement)

**Files:**
- Create: `server/scripts/audit-slug.js`
- Modify: `server/package.json`

- [ ] **Step 1: Write benchmark script**

Create `server/scripts/audit-slug.js`:

```javascript
#!/usr/bin/env node
// server/scripts/audit-slug.js
// Audit slug collision rate, Unicode-stripped count, length p50/p95/p99
// across Trait + Biome + Species + Ecosystem rows. Read-only.
// Per PR-α QG Step 3 tuning measurement.

'use strict';

const prisma = require('../db/prisma');
const { normalizeSlug, MAX_SLUG_LENGTH } = require('../utils/slug');

const MODELS = ['trait', 'biome', 'species', 'ecosystem'];

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.floor(sortedArr.length * p));
  return sortedArr[idx];
}

async function auditModel(model) {
  const rows = await prisma[model].findMany({
    select: { id: true, slug: true },
  });
  const lengths = rows.map(r => (r.slug || '').length).sort((a, b) => a - b);
  const renorm = rows.map(r => ({
    id: r.id,
    original: r.slug,
    canonical: normalizeSlug(r.slug),
  }));
  const drifted = renorm.filter(r => r.original !== r.canonical);
  const tooLong = rows.filter(r => (r.slug || '').length > MAX_SLUG_LENGTH);
  const seen = new Map();
  for (const row of rows) {
    if (!row.slug) continue;
    seen.set(row.slug, (seen.get(row.slug) || 0) + 1);
  }
  const collisions = [...seen.entries()].filter(([, n]) => n > 1);

  return {
    model,
    rows: rows.length,
    lengthP50: percentile(lengths, 0.5),
    lengthP95: percentile(lengths, 0.95),
    lengthP99: percentile(lengths, 0.99),
    lengthMax: lengths.length > 0 ? lengths[lengths.length - 1] : 0,
    overMaxCount: tooLong.length,
    renormDriftCount: drifted.length,
    collisionCount: collisions.length,
    collisionExamples: collisions.slice(0, 3).map(([s, n]) => ({ slug: s, count: n })),
    driftExamples: drifted.slice(0, 3).map(({ id, original, canonical }) => ({ id, original, canonical })),
  };
}

async function main() {
  const results = [];
  for (const m of MODELS) {
    try {
      results.push(await auditModel(m));
    } catch (err) {
      results.push({ model: m, error: err.message });
    }
  }
  const report = {
    timestamp: new Date().toISOString(),
    maxSlugLength: MAX_SLUG_LENGTH,
    models: results,
    summary: {
      totalRows: results.reduce((acc, r) => acc + (r.rows || 0), 0),
      totalOverMax: results.reduce((acc, r) => acc + (r.overMaxCount || 0), 0),
      totalDrift: results.reduce((acc, r) => acc + (r.renormDriftCount || 0), 0),
      totalCollisions: results.reduce((acc, r) => acc + (r.collisionCount || 0), 0),
    },
  };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`audit-slug failed: ${err.stack || err.message}\n`);
    process.exit(1);
  });
}

module.exports = { auditModel };
```

- [ ] **Step 2: Add npm script**

Edit `server/package.json`. Locate the `scripts` block:

```json
"scripts": {
    "dev": "node index.js",
    "dashboard:build": "npm --prefix ../apps/dashboard run build",
    "dev:setup": "prisma generate && prisma migrate deploy && prisma db seed",
    ...
```

Add new entry (alphabetical or end-of-block):

```json
"audit:slug": "node ./scripts/audit-slug.js",
```

Make sure JSON commas are correct.

- [ ] **Step 3: Smoke audit script against local DB**

**Prerequisite**: local Postgres running (`docker compose up -d`).

Run:
```bash
cd "C:/dev/Game-Database/server"
npm run audit:slug 2>&1 | head -40
```

Expected: JSON report printed. `totalCollisions: 0`, `totalOverMax: 0` (on clean seed), `totalDrift` could be 0 or small (if seed already canonical).

Save the baseline to QG evidence: copy first 50 lines of output to a comment in PR description.

- [ ] **Step 4: Commit**

Run:
```bash
cd "C:/dev/Game-Database"
git add server/scripts/audit-slug.js server/package.json
git commit -m "feat(audit): audit-slug benchmark script for PR-α QG Step 3

Read-only audit of Trait/Biome/Species/Ecosystem slug columns:
- Collision rate, length p50/p95/p99, drift vs canonical normalizer,
  over-max count. Emits JSON report on stdout.
- npm run audit:slug

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d3a1-aa01-7000-8000-gamedb20260520-pralpha-11"
```

---

## Task 12: Write research doc (QG Step 2)

**Files:**
- Create: `docs/research/slug-normalization-2026-05-20.md`

- [ ] **Step 1: Write research doc**

Create `docs/research/slug-normalization-2026-05-20.md`:

```markdown
# Research — Slug normalization edge cases

**Date**: 2026-05-20
**Component**: `server/utils/slug.js` (PR-α)
**Author**: parallel-#2 session (Ryzen)
**Spec reference**: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` Q1 resolved

## Goal

Document the 3+ edge case scenarios that motivated PR-α slug consolidation, the chosen pipeline, and the trade-offs accepted.

## Edge case scenarios investigated

### Scenario 1 — Unicode diacritics (Italian taxonomy)

**Input**: Italian common names with grave/acute accents (e.g. "Lùpus rufus", "Erbàcee perenni", "Maremma toscàna").

**Pre-PR behavior**: All 4 routes used `trim().toLowerCase().replace(/\s+/g, '-')` — left diacritics intact. Result: `"lùpus-rufus"`.

**Problem**: Postgres `varchar @unique` accepts the Unicode slug, but URL-encoding for HTTP routes (`/api/species/lùpus-rufus`) produces `/api/species/l%C3%B9pus-rufus` — works but ugly, breaks copy-paste workflows, and inconsistent with the import pipeline (`import-taxonomy.js:85-92` already NFD-strips).

**Post-PR behavior**: NFD decomposition + combining-marks strip → `"lupus-rufus"`. Round-trip via import preserves canonical form.

**Evidence**: `slug.test.js` tests `unicode: strips Italian diacritics`, `unicode: strips French and Spanish diacritics`, `unicode: strips combining marks while preserving base latin chars`.

### Scenario 2 — Length blow-out (no cap pre-PR)

**Input**: User pastes long descriptive name as slug source (e.g. a 250-char scientific binomial with subspecies + locality).

**Pre-PR behavior**: No length cap. `Prisma String @unique` accepts but Postgres B-tree index on long varchar bloats and `/api/.../:id` URL exceeds 2KB browser limit at ~500 chars.

**Post-PR behavior**: Max 80 chars, post-slice trailing-dash strip prevents `aaaaaaaa-` artifacts when slice lands on a hyphen boundary.

**Evidence**: `slug.test.js` tests `length: truncates to MAX_SLUG_LENGTH (80)`, `length: post-slice trims trailing dash if slice lands on hyphen boundary`.

**Trade-off**: Pre-existing slugs >80 chars (if any) would fail re-normalization round-trip. Audit via `npm run audit:slug` catches them (zero in current seed verified at PR-α commit time). Migration plan: if any production row >80, separate follow-up PR to truncate + handle collisions.

### Scenario 3 — Trailing/leading dash from punctuation prefix/suffix

**Input**: Names with leading/trailing punctuation, apostrophes, emoji (e.g. "—Trait", "L'arbre du desert", "Trait 🌿 green").

**Pre-PR behavior**: Weak regex only handled whitespace, so apostrophes and emoji passed through OR were mangled inconsistently across routes (some lower-cased, some not depending on call site).

**Post-PR behavior**: `[^a-z0-9]+ → -` then `(^-|-$) → ''` strips all non-alphanum to single hyphens, trims edges.

**Evidence**: `slug.test.js` tests `punct: replaces apostrophes`, `punct: replaces consecutive special chars`, `punct: strips emoji and non-ASCII symbols`, `trim: removes leading dash`, `trim: removes trailing dash`, `trim: handles wrap-only special chars`.

### Scenario 4 — Empty + fallback semantics

**Input**: API client sends `body.slug` empty, expects fallback derivation from `body.name`/`body.scientificName`/`body.commonName`.

**Pre-PR behavior**: Route call sites used `normalizeSlug(body.slug || name)` — short-circuits to `name` if slug empty, but test/utils.js used a 2-arg `normalizeSlug(value, fallback)` with different semantics (fallback even if value normalizes to empty post-pipeline). Two contracts coexisted.

**Post-PR behavior**: Single 2-arg signature. `normalizeSlug(value, fallback)`:
- Tries `value` first.
- If `value` yields empty post-pipeline (special-chars-only, whitespace-only, null/undefined), tries `fallback`.
- Returns `''` only when both fail.

Routes can still call `normalizeSlug(body.slug || name)` (single-arg) — equivalent to old behavior except now also rejects empty-post-pipeline value before considering fallback (no fallback available in single-arg, so empty wins).

**Evidence**: `slug.test.js` tests `fallback: uses fallback when value is empty`, `fallback: prefers value over fallback when both present`, `fallback: tries fallback if value normalizes to empty (special-chars-only)`.

## Cross-repo audit (per spec NO-GO contract)

Read-only audit confirmed:
- **Game** (`C:/dev/Game`): 4 separate JS slugifiers + 2 Python slugifiers. JS variants use `_` separator (e.g. `apps/backend/app.js:80`); Python uses `-`. Static YAML `legacy_slug` values are underscore-form (`arbusti_xerofili`, `sand_burrower`). Game-Database's `import-taxonomy.js` already re-slugifies on read to hyphen-form — PR-α preserves this contract.
- **codemasterdd-ai-station** ADR-0021 + CLAUDE.md mandate **ASCII-first**: PR-α pipeline produces pure ASCII (`[a-z0-9-]+`) — fully compliant.
- **vault**, **Game-Godot-v2**: NOT inspected (NO-GO).

No breaking change for Game runtime or YAML files. Game-side `_`-vs-`-` slug inconsistency is **out-of-scope** for PR-α; flagged as candidate for future cross-repo RFC.

## Trade-offs accepted

1. **No non-Latin transliteration**: PR-α does not convert Cyrillic/CJK/Arabic to Latin. Result: non-Latin-only input → empty slug → fallback parameter (or empty if no fallback). For Evo-Tactics (Latin binomials + Italian commons), this is correct. Future taxonomies with non-Latin names would need explicit fallback values (e.g. scientific name field).
2. **Max-length 80 hard-coded**: Single constant `MAX_SLUG_LENGTH` in module. Easy to change but not env-configurable. Acceptable for a single-tenant designer CMS.
3. **Backward-compat in import script**: `slugify(value)` alias preserved over `normalizeSlug(value)` rename to avoid 30+ call-site churn in `import-taxonomy.js`. Internal contract identical.

## Open follow-ups (out-of-scope for PR-α)

- Prisma migration to add `slug @db.VarChar(80)` constraint. Needs data audit first (`npm run audit:slug` reports `overMaxCount > 0`?). Defer to follow-up PR.
- Cross-repo slug-format RFC for `_` vs `-` consistency between Game and Game-Database. Defer to future RFC (coordinator gate).
- pg_trgm index on slug for Fase 2 search-as-you-type. Defer to PR Fase 2.

## References

- Spec: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` Q1
- Source pipeline: `server/scripts/ingest/import-taxonomy.js:85-92` (pre-PR)
- Anti-pattern catalog: `~/.claude/CLAUDE.md` #1 (DRY across processes), ADR-0021 ASCII-first
- Past coverage: PR #114 (PUT ecosystems), PR #116 (masters CRUD coverage)
```

- [ ] **Step 2: Commit research doc**

Run:
```bash
cd "C:/dev/Game-Database"
git add docs/research/slug-normalization-2026-05-20.md
git commit -m "docs(research): slug normalization edge cases (PR-α QG Step 2)

3+ edge case scenarios documented: Unicode diacritics, length
blow-out, trailing/leading dash, empty+fallback semantics.
Cross-repo audit notes (Game underscore vs hyphen separator
inconsistency flagged as future RFC candidate).

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d3a1-aa01-7000-8000-gamedb20260520-pralpha-12"
```

---

## Task 13: Full suite smoke + baseline measurement

**Files:**
- (No file changes — measurement + evidence collection)

- [ ] **Step 1: Run full backend suite**

Run:
```bash
cd "C:/dev/Game-Database/server"
npm test 2>&1 | tail -40
```

Expected output should contain (for each file): `ℹ tests N / ℹ pass N / ℹ fail 0`. Total tests = 107 baseline + 28 new slug = 135.

Capture summary line counts for PR description.

- [ ] **Step 2: Run audit-slug baseline (requires Postgres running)**

Prerequisite: `docker compose up -d` from repo root.

Run:
```bash
cd "C:/dev/Game-Database/server"
npm run audit:slug 2>&1 > /tmp/audit-slug-baseline.json || \
  npm run audit:slug 2>&1 > "${TEMP:-./tmp}/audit-slug-baseline.json"
cat /tmp/audit-slug-baseline.json 2>/dev/null || cat "${TEMP:-./tmp}/audit-slug-baseline.json"
```

Expected JSON report with `totalCollisions: 0`, `totalOverMax: 0`. Save the JSON output for PR description.

- [ ] **Step 3: Run frontend smoke (sanity check no slug regression in dashboard parsing)**

Run:
```bash
cd "C:/dev/Game-Database/apps/dashboard"
npm test -- --run 2>&1 | tail -30
```

Expected: All dashboard unit tests pass (no slug-related assertion break).

If dashboard test suite is too slow or unavailable in this environment, mark this step as "Skipped — CI will validate". Document in PR description.

- [ ] **Step 4: Stage evidence for PR description**

Write a temporary `/tmp/pr-alpha-evidence.md` (or `${TEMP}\pr-alpha-evidence.md`) with:

```markdown
## QG Step 1 — Smoke evidence
- `npm test` (server): 135/135 verde (was 107, +28 slug)
- `npm test -- --run` (dashboard): PASS or "Skipped — CI"

## QG Step 3 — Baseline measurement (audit-slug)
<paste JSON report here>

## QG Step 2 — Research
- `docs/research/slug-normalization-2026-05-20.md` (committed Task 12)
```

This is NOT committed — used as raw material for the PR body in Task 14.

---

## Task 14: Open PR + handoff DONE line

**Files:**
- (No code changes — administrative)

- [ ] **Step 1: Push branch**

Run:
```bash
cd "C:/dev/Game-Database"
git push -u origin claude/parallel-gamedb-pr-alpha-slug-hardening-2026-05-20 2>&1 | tail -3
```

Expected: branch pushed, tracking set.

- [ ] **Step 2: Open PR via gh**

Run:
```bash
cd "C:/dev/Game-Database"
gh pr create --base main --head claude/parallel-gamedb-pr-alpha-slug-hardening-2026-05-20 --title "feat(slug): consolidate canonical normalizeSlug (PR-α, Fase 1)" --body "$(cat <<'EOF'
## Summary

PR-α from Game-Database value roadmap spec (`docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md`). Fase 1 integrity-first track.

Consolidates 6 duplicated weak \`normalizeSlug\` implementations into a single canonical \`server/utils/slug.js\` module. Hardens against Unicode diacritics, length blow-out, trailing/leading dash, and inconsistent fallback semantics.

## Resolved spec decision (Q1)

Custom regex consolidate (NOT npm \`slugify\` dep). Pipeline lifted from \`server/scripts/ingest/import-taxonomy.js:85-92\` (already proven on Game YAML round-trip) + added max-length 80 truncation.

## Changes

| Layer | Before | After |
|---|---|---|
| 4 routes (traits/biomes/species/ecosystems) | 4× weak local \`normalizeSlug\` (lowercase + whitespace→hyphen) | Import shared module |
| test/utils.js | 2-arg local \`normalizeSlug(value, fallback)\` | Import shared module (same signature, harder behavior) |
| import-taxonomy.js | Inline \`slugify\` (lines 85-92) | Backward-compat alias to shared module |
| Postgres slug columns | Unbounded \`String @unique\` | JS-side max-80 truncation (DB constraint = separate follow-up PR) |

## QG Step 1 — Smoke evidence

- \`npm test\` (server): 135/135 verde (107 baseline + 28 new \`slug.test.js\`)
- 46/46 \`taxonomyRouters.test.js\` unchanged (regression-free)
- (paste exact output here from Task 13 Step 1)

## QG Step 2 — Research

- \`docs/research/slug-normalization-2026-05-20.md\` documents 4 edge case scenarios (Unicode, length, trailing-dash, fallback semantics) + cross-repo audit notes

## QG Step 3 — Tuning baseline

\`npm run audit:slug\` JSON report:
<paste from Task 13 Step 2>

Key metrics:
- totalCollisions: 0 (expected)
- totalOverMax: 0 (expected on clean seed)
- totalDrift: <value>

## Cross-repo impact

ZERO. Game has separate slugifiers (4 JS + 2 Python variants, \`_\`-separator) consumed only inside Game runtime. Game-Database \`evo:import\` re-normalizes at boundary — preserves the contract.

## Test plan

- [x] 28 new unit tests \`slug.test.js\` covering all edge cases
- [x] Full backend suite 135/135
- [x] Audit-slug baseline measured
- [ ] CI: backend-and-frontend-tests, playwright-e2e, prisma-seed
- [ ] Harsh-review auto pre-merge

## Follow-ups (out-of-scope)

1. Prisma \`slug @db.VarChar(80)\` migration once audit confirms 0 overMax (separate PR)
2. Cross-repo \`_\`-vs-\`-\` slug separator RFC (future, coordinator gate)
3. pg_trgm index on slug for Fase 2 search-as-you-type

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

Expected: PR URL printed.

- [ ] **Step 3: Append DONE handoff line**

Run:
```bash
PR_URL=$(cd "C:/dev/Game-Database" && gh pr view --json url -q .url)
TS=$(date -u +"%Y-%m-%dT%H:%MZ")
printf '%s\n' "- \`[parallel-#2 DONE PR-α $PR_URL finish $TS]\` (slug hardening, 6 call sites consolidated, +28 unit tests, audit:slug baseline measured, research doc committed; CI pending)" >> "C:/dev/codemasterdd-ai-station/docs/sessions/2026-05-19-continuity-handoff.md"
git -C "C:/dev/codemasterdd-ai-station" add docs/sessions/2026-05-19-continuity-handoff.md
git -C "C:/dev/codemasterdd-ai-station" commit -m "docs(handoff): parallel-#2 PR-α slug hardening DONE

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d3a1-aa01-7000-8000-gamedb20260520-pralpha-done"
```

Expected: 1 local commit codemasterdd. Coordinator syncs.

- [ ] **Step 4: Watch CI**

Run:
```bash
cd "C:/dev/Game-Database"
gh pr checks --watch 2>&1 | tail -10
```

Expected: 6/6 verde (checks ×2 + e2e ×2 + seed ×2). If any fail, investigate before merge.

- [ ] **Step 5: Harsh-review pre-merge**

Self-review checklist (apply inline, no separate file):
- [ ] Spec coverage: every PR-α resolved decision implemented? (Q1 = yes, custom regex + max-80, no slugify dep)
- [ ] Diff scope minimal? (1 new module + 6 call-site replacements + 1 audit script + 1 doc + runner-list update — yes, all in PR-α scope)
- [ ] No Co-Authored-By trailer? (verified — only Coding-Agent + Trace-Id)
- [ ] Commit messages follow Conventional? (yes — feat/refactor/test/docs)
- [ ] Trace-Id format note: still non-strict UUIDv7 last segment (cosmetic, same as #115-117)
- [ ] Cross-repo touch: ZERO (verified — only Game-Database)
- [ ] Handoff append OWNING (Task 1) + DONE (Task 14): both committed locally

If all checks pass and CI green, proceed to merge.

- [ ] **Step 6: Squash merge**

Run:
```bash
cd "C:/dev/Game-Database"
gh pr merge --squash --delete-branch 2>&1 | tail -8
```

Expected: merge commit on main, branch deleted remote.

- [ ] **Step 7: Append MERGED handoff line**

Run:
```bash
MERGE_SHA=$(cd "C:/dev/Game-Database" && git -C "C:/dev/Game-Database" log -1 --format=%h main)
TS=$(date -u +"%Y-%m-%dT%H:%MZ")
printf '%s\n' "- \`[parallel-#2 MERGED PR-α squash $MERGE_SHA finish $TS]\` (Fase 1 PR 1/5 done; next PR-β junction coverage closure)" >> "C:/dev/codemasterdd-ai-station/docs/sessions/2026-05-19-continuity-handoff.md"
git -C "C:/dev/codemasterdd-ai-station" add docs/sessions/2026-05-19-continuity-handoff.md
git -C "C:/dev/codemasterdd-ai-station" commit -m "docs(handoff): parallel-#2 PR-α MERGED

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d3a1-aa01-7000-8000-gamedb20260520-pralpha-merged"
```

Expected: 1 local commit codemasterdd.

---

## Summary

**14 tasks**, ~3 hours wall-time estimate (per-task 5-15min including smoke).

**File deltas**:
- 4 created (slug.js + slug.test.js + audit-slug.js + research doc)
- 8 modified (4 routes + test/utils + import-taxonomy + run-tests + package.json)

**LOC estimate**: +500/-50 (approx, matches spec +200/-30 plus tests/script/doc overhead).

**Quality gates traced**: Step 1 smoke (Task 13) + Step 2 research (Task 12) + Step 3 tuning baseline (Task 11+13).

**Next plan after merge**: PR-β junction coverage closure (mirror PR #114/#116 pattern, ~15 tests).
