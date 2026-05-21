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
  // Prisma.Sql exposes .values (bound params) and .sql (text with $n).
  assert.ok(sql.values.includes('lynks'));
  assert.ok(sql.values.includes(0.3));
  assert.equal(sql.values[sql.values.length - 1], 20);
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
  assert.equal((two.sql.match(/UNION ALL/g) || []).length, 1);
});
