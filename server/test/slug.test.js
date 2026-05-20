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
  assert.equal(normalizeSlug('arbusti_xerofili'), 'arbusti-xerofili');
});
