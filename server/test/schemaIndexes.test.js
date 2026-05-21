const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Regression guard for the pg_trgm GIN indexes (PR #151, /api/search).
//
// The 11 GIN gin_trgm_ops indexes are created by the raw-SQL migration
// 20260521130000_pg_trgm_search. They MUST also be modeled in schema.prisma,
// otherwise `prisma migrate dev` (Prisma 5.22) re-detects them as drift and
// emits DROP INDEX for each — which silently breaks fuzzy search if applied.
// This test fails if any trgm index in the migration is not modeled in the
// schema (e.g. someone accepted the drift drops, or added a new trgm index in
// SQL without the matching @@index). It needs no database.

const PRISMA_DIR = path.resolve(__dirname, '..', 'prisma');
const MIGRATION_SQL = path.join(
  PRISMA_DIR,
  'migrations',
  '20260521130000_pg_trgm_search',
  'migration.sql',
);
const SCHEMA = path.join(PRISMA_DIR, 'schema.prisma');

function trgmIndexNamesFromMigration() {
  const sql = fs.readFileSync(MIGRATION_SQL, 'utf8');
  const names = [];
  const re = /CREATE INDEX IF NOT EXISTS "([^"]*_trgm_idx)"/g;
  let m;
  while ((m = re.exec(sql)) !== null) names.push(m[1]);
  return names;
}

test('migration declares the expected set of 11 pg_trgm GIN indexes', () => {
  assert.equal(trgmIndexNamesFromMigration().length, 11);
});

test('every pg_trgm GIN index is modeled in schema.prisma (no drift)', () => {
  const schema = fs.readFileSync(SCHEMA, 'utf8');
  for (const name of trgmIndexNamesFromMigration()) {
    const line = schema
      .split('\n')
      .find((l) => l.includes(`map: "${name}"`));
    assert.ok(
      line,
      `index "${name}" is created in the migration but not modeled in schema.prisma ` +
        '(add a @@index([...], type: Gin, ops: raw("gin_trgm_ops"), map: "<name>") ' +
        'so `prisma migrate dev` does not propose DROP INDEX for it)',
    );
    assert.match(line, /type:\s*Gin/, `index "${name}" must use type: Gin`);
    assert.match(line, /gin_trgm_ops/, `index "${name}" must use gin_trgm_ops ops class`);
  }
});
