const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../db/prisma');
const { createTaxonomyTestContext } = require('./utils');

// Regression: createTaxonomyTestContext().restore() must reinstate the
// original prisma model methods (count/findMany/findFirst/findUnique/update/
// delete) for all four masters: species, trait, biome, ecosystem.
//
// Prior to the fix that ships with this test, update+delete on
// trait/biome/ecosystem were mocked by createModelMock but never captured in
// `original`, so restore() left the mock in place. This file pins the
// contract.
//
// Implementation note: @prisma/client uses a Proxy that returns a fresh bound
// function on every property access — `prisma.species.count !==
// prisma.species.count` is true. To assert reference identity, we pre-install
// stable sentinel functions BEFORE createTaxonomyTestContext() captures its
// originals. The context then captures our sentinels; mock() replaces them
// with mock fns; restore() should put the sentinels back.

test('restore() reinstates original prisma model methods after mock for all masters', () => {
  const models = ['species', 'trait', 'biome', 'ecosystem'];
  const ops = ['count', 'findMany', 'findFirst', 'findUnique', 'update', 'delete'];

  // Pre-install stable sentinel refs so reference equality is testable.
  const sentinels = {};
  for (const m of models) {
    sentinels[m] = {};
    for (const op of ops) {
      const fn = function sentinel() { return `${m}.${op}`; };
      sentinels[m][op] = fn;
      prisma[m][op] = fn;
    }
  }

  const ctx = createTaxonomyTestContext();
  ctx.mock();

  // After mock(), each op should have been replaced by a mock fn (not the
  // sentinel) for every model + every op.
  for (const m of models) {
    for (const op of ops) {
      assert.notEqual(
        prisma[m][op],
        sentinels[m][op],
        `${m}.${op} should be replaced by a mock after mock()`,
      );
    }
  }

  ctx.restore();

  // After restore(), every op should reference the sentinel again. This is
  // the regression assertion: prior to the fix, trait.update / trait.delete /
  // biome.update / biome.delete / ecosystem.update / ecosystem.delete were
  // NOT restored and would still hold the mock function.
  for (const m of models) {
    for (const op of ops) {
      assert.equal(
        prisma[m][op],
        sentinels[m][op],
        `${m}.${op} should be restored to sentinel after restore()`,
      );
    }
  }
});
