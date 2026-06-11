const test = require('node:test');
const assert = require('node:assert/strict');
const { computeExitCode, parseFlagFromArgs, normalizeTrait } = require('../scripts/ingest/import-taxonomy');

// PR-ε: computeExitCode is the pure exit-code policy function.
// Per spec Q4 resolved: STRICT default (errori + schema_validation = exit 1).
// Opt-out via --warn-only. Granular via --fail-on=errors|schema|any.

function summary({ errori = 0, schemaByDomain = {} } = {}) {
  const dettaglio = {};
  for (const [domain, count] of Object.entries(schemaByDomain)) {
    dettaglio[domain] = { motivi_scarto: { schema_validation: count } };
  }
  return { errori, dettaglio };
}

// ---- Non-validate-only mode: always 0 -------------------------------------

test('exit-code 0 when validateOnly=false regardless of errors', () => {
  const s = summary({ errori: 100, schemaByDomain: { traits: 50 } });
  assert.equal(computeExitCode(s, { validateOnly: false }), 0);
});

// ---- Validate-only + STRICT default ---------------------------------------

test('exit-code 0 when validateOnly + 0 errors + 0 schema skips', () => {
  const s = summary({ errori: 0 });
  assert.equal(computeExitCode(s, { validateOnly: true }), 0);
});

test('exit-code 1 when validateOnly + errori > 0 (default fail-on includes errors)', () => {
  const s = summary({ errori: 3 });
  assert.equal(computeExitCode(s, { validateOnly: true }), 1);
});

test('exit-code 1 when validateOnly + schema_validation > 0 in any domain (default fail-on includes schema)', () => {
  const s = summary({ schemaByDomain: { traits: 1 } });
  assert.equal(computeExitCode(s, { validateOnly: true }), 1);
});

test('exit-code 1 when validateOnly + schema_validation in non-traits domain', () => {
  const s = summary({ schemaByDomain: { biomes: 5 } });
  assert.equal(computeExitCode(s, { validateOnly: true }), 1);
});

// ---- Warn-only override --------------------------------------------------

test('exit-code 0 when warnOnly even with errors', () => {
  const s = summary({ errori: 10, schemaByDomain: { traits: 5 } });
  assert.equal(computeExitCode(s, { validateOnly: true, warnOnly: true }), 0);
});

// ---- Granular fail-on ---------------------------------------------------

test('exit-code 0 when fail-on=errors only and only schema skips present', () => {
  const s = summary({ errori: 0, schemaByDomain: { traits: 5 } });
  assert.equal(computeExitCode(s, { validateOnly: true, failOn: ['errors'] }), 0);
});

test('exit-code 1 when fail-on=errors only and errori > 0', () => {
  const s = summary({ errori: 1 });
  assert.equal(computeExitCode(s, { validateOnly: true, failOn: ['errors'] }), 1);
});

test('exit-code 0 when fail-on=schema only and only errori present', () => {
  const s = summary({ errori: 7, schemaByDomain: {} });
  assert.equal(computeExitCode(s, { validateOnly: true, failOn: ['schema'] }), 0);
});

test('exit-code 1 when fail-on=schema only and schema skips present', () => {
  const s = summary({ errori: 0, schemaByDomain: { species: 2 } });
  assert.equal(computeExitCode(s, { validateOnly: true, failOn: ['schema'] }), 1);
});

test('exit-code 1 when fail-on=any and either errori or schema > 0', () => {
  const errs = summary({ errori: 1 });
  const schema = summary({ schemaByDomain: { ecosystems: 1 } });
  assert.equal(computeExitCode(errs, { validateOnly: true, failOn: ['any'] }), 1);
  assert.equal(computeExitCode(schema, { validateOnly: true, failOn: ['any'] }), 1);
});

test('exit-code 0 when fail-on=any and zero errors + zero schema skips', () => {
  const s = summary({ errori: 0, schemaByDomain: {} });
  assert.equal(computeExitCode(s, { validateOnly: true, failOn: ['any'] }), 0);
});

// ---- Partial completeness stays warn-only --------------------------------

test('exit-code 0 when validateOnly + only partial completeness (no errori, no schema)', () => {
  const s = { errori: 0, parziali: 50, dettaglio: { traits: { motivi_scarto: { other_reason: 5 } } } };
  assert.equal(computeExitCode(s, { validateOnly: true }), 0);
});

// ---- Edge cases ---------------------------------------------------------

test('exit-code 0 when summary has no dettaglio key', () => {
  assert.equal(computeExitCode({ errori: 0 }, { validateOnly: true }), 0);
});

test('exit-code 0 when dettaglio domain has no motivi_scarto', () => {
  const s = { errori: 0, dettaglio: { traits: {} } };
  assert.equal(computeExitCode(s, { validateOnly: true }), 0);
});

test('exit-code 1 default fail-on without explicit opts (validateOnly + errori)', () => {
  // omitting opts.failOn should default to ['errors', 'schema']
  const s = summary({ errori: 2 });
  assert.equal(computeExitCode(s, { validateOnly: true }), 1);
});

// ---- parseFlagFromArgs (Codex P1 fix: support --flag=value form) ----------

test('parseFlagFromArgs: returns default when flag absent', () => {
  assert.equal(parseFlagFromArgs([], 'fail-on', 'errors,schema'), 'errors,schema');
});

test('parseFlagFromArgs: --flag=value inline form returns value', () => {
  assert.equal(parseFlagFromArgs(['--fail-on=errors'], 'fail-on', 'default'), 'errors');
});

test('parseFlagFromArgs: --flag=value handles comma-separated value', () => {
  assert.equal(parseFlagFromArgs(['--fail-on=errors,schema'], 'fail-on', 'default'), 'errors,schema');
});

test('parseFlagFromArgs: --flag value space-separated form still works', () => {
  assert.equal(parseFlagFromArgs(['--fail-on', 'schema'], 'fail-on', 'default'), 'schema');
});

test('parseFlagFromArgs: bare --flag without value returns true', () => {
  assert.equal(parseFlagFromArgs(['--validate-only'], 'validate-only', false), true);
});

test('parseFlagFromArgs: bare --flag followed by next flag returns true', () => {
  // --validate-only --warn-only → --validate-only is boolean, --warn-only is boolean
  assert.equal(parseFlagFromArgs(['--validate-only', '--warn-only'], 'validate-only', false), true);
});

test('parseFlagFromArgs: inline form takes precedence when both present', () => {
  // Edge: if both --flag=A and --flag B given, inline wins (first match)
  assert.equal(parseFlagFromArgs(['--fail-on=any', '--fail-on', 'errors'], 'fail-on', 'def'), 'any');
});

test('parseFlagFromArgs: empty inline value returns empty string (not default)', () => {
  // --fail-on= explicitly passes empty; let caller decide
  assert.equal(parseFlagFromArgs(['--fail-on='], 'fail-on', 'default'), '');
});

// ---- normalizeTrait i18n -------------------------------------------------

test('normalizeTrait populates nameEn/descriptionEn from label_en / description_en and leaves them null when absent', () => {
  const resultAbsent = normalizeTrait({ slug: 'test', name: 'Test' });
  assert.equal(resultAbsent.nameEn, null);
  assert.equal(resultAbsent.descriptionEn, null);

  const resultPresent = normalizeTrait({ slug: 'test', name: 'Test', label_en: 'Test EN', description_en: 'Test Desc EN' });
  assert.equal(resultPresent.nameEn, 'Test EN');
  assert.equal(resultPresent.descriptionEn, 'Test Desc EN');
});

test('normalizeTrait sets sourceKey to the exact identifier when provided', () => {
  const resultUnderscore = normalizeTrait({ slug: 'antenne_plasmatiche', name: 'Antenne Plasmatiche' });
  assert.equal(resultUnderscore.slug, 'antenne-plasmatiche');
  assert.equal(resultUnderscore.sourceKey, 'antenne_plasmatiche');

  const resultId = normalizeTrait({ id: 'some_id', name: 'Some Name' });
  assert.equal(resultId.slug, 'some-id');
  assert.equal(resultId.sourceKey, 'some_id');

  const resultNameOnly = normalizeTrait({ name: 'Just Name' });
  assert.equal(resultNameOnly.slug, 'just-name');
  assert.equal(resultNameOnly.sourceKey, null); // Display name is not an identifier source
});
