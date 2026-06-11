const test = require('node:test');
const assert = require('node:assert/strict');
const { traitVersionToTrait, snapshotToMaster } = require('../utils/versionRead');

test('traitVersionToTrait maps snapshot row to master trait shape', () => {
  const row = {
    id: 'snap-row-id',
    traitId: 'master-trait-id',
    versionId: 'ver-id',
    capturedAt: new Date('2026-01-01T00:00:00Z'),
    slug: 'speed',
    sourceKey: 'speed_original',
    sourceFiles: ['core_glossary'],
    name: 'Speed',
    description: 'how fast',
    nameEn: 'Speed EN',
    descriptionEn: 'how fast EN',
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
  assert.equal(out.sourceKey, 'speed_original');
  assert.deepEqual(out.sourceFiles, ['core_glossary']);
  assert.equal(out.name, 'Speed');
  assert.equal(out.nameEn, 'Speed EN');
  assert.equal(out.descriptionEn, 'how fast EN');
  assert.equal(out.dataType, 'NUMERIC');
  assert.deepEqual(out.slotProfile, { a: 1 });
  // snapshot-only columns are dropped
  assert.equal('versionId' in out, false);
  assert.equal('capturedAt' in out, false);
  assert.equal('traitId' in out, false);
});

test('snapshotToMaster maps biome snapshot row to master biome shape', () => {
  const row = {
    id: 'snap-row-id',
    biomeId: 'master-biome-id',
    versionId: 'ver-id',
    capturedAt: new Date(),
    slug: 'forest',
    name: 'Forest',
    description: 'A forest biome',
    climate: 'temperate',
    parentId: null,
    summary: 'Trees everywhere',
    climateTags: ['mild'],
    hazard: 'low',
    ecology: 'rich',
    roleTemplates: {},
    sizeMin: 10,
    sizeMax: 100,
  };
  const out = snapshotToMaster('biome', row);
  assert.equal(out.id, 'master-biome-id');
  assert.equal(out.slug, 'forest');
  assert.equal(out.name, 'Forest');
  assert.equal(out.sizeMax, 100);
  assert.equal('versionId' in out, false);
  assert.equal('capturedAt' in out, false);
  assert.equal('biomeId' in out, false);
});

test('snapshotToMaster maps species snapshot row to master species shape', () => {
  const row = {
    id: 'snap-row-id',
    speciesId: 'master-species-id',
    versionId: 'ver-id',
    capturedAt: new Date(),
    slug: 'wolf',
    scientificName: 'Canis lupus',
    commonName: 'Wolf',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    class: 'Mammalia',
    order: 'Carnivora',
    family: 'Canidae',
    genus: 'Canis',
    epithet: 'lupus',
    status: 'extant',
    description: 'A wolf',
    displayName: 'Wolf',
    trophicRole: 'carnivore',
    functionalTags: [],
    flags: [],
    balance: {},
    playableUnit: true,
    morphotype: 'quadruped',
    vcCoefficients: {},
    spawnRules: {},
    environmentAffinity: {},
    jobsBias: {},
    telemetry: {},
  };
  const out = snapshotToMaster('species', row);
  assert.equal(out.id, 'master-species-id');
  assert.equal(out.slug, 'wolf');
  assert.equal(out.scientificName, 'Canis lupus');
  assert.equal('versionId' in out, false);
  assert.equal('capturedAt' in out, false);
  assert.equal('speciesId' in out, false);
});

test('snapshotToMaster maps ecosystem snapshot row to master ecosystem shape', () => {
  const row = {
    id: 'snap-row-id',
    ecosystemId: 'master-ecosystem-id',
    versionId: 'ver-id',
    capturedAt: new Date(),
    slug: 'boreal-forest',
    name: 'Boreal Forest',
    description: 'A boreal forest ecosystem',
    region: 'north',
    climate: 'cold',
  };
  const out = snapshotToMaster('ecosystem', row);
  assert.equal(out.id, 'master-ecosystem-id');
  assert.equal(out.slug, 'boreal-forest');
  assert.equal(out.name, 'Boreal Forest');
  assert.equal('versionId' in out, false);
  assert.equal('capturedAt' in out, false);
  assert.equal('ecosystemId' in out, false);
});
