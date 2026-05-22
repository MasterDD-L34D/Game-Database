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
