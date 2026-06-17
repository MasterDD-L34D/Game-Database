const test = require('node:test');
const assert = require('node:assert/strict');
const { snapshotEntity, FIELD_MAP } = require('../utils/versionSnapshot');

// RFC #4 Sp1a (Codex P2 on PR #214): the species snapshot must RECOMPUTE
// biomeSlugs from the live SpeciesBiome junction, not copy the (possibly stale)
// denormalized Species.biomeSlugs cache -- the /species-biomes routes mutate the
// junction without maintaining that column. snapshotEntity takes the prisma
// client as a parameter, so a fake client exercises the logic with no database.
test('snapshotEntity recomputes species biomeSlugs from the junction, overriding the stale cache', async () => {
  const captured = [];
  const fakeClient = {
    species: {
      findMany: async ({ skip = 0 } = {}) => (skip === 0
        ? [
            { id: 's1', slug: 'cryo-lynx', scientificName: 'Lynx', biomeSlugs: ['STALE-CACHE'] },
            { id: 's2', slug: 'no-biome', scientificName: 'Nemo', biomeSlugs: ['ALSO-STALE'] },
          ]
        : []),
    },
    speciesBiome: {
      // Returned out of alphabetical order on purpose: the snapshot must sort.
      findMany: async () => [
        { speciesId: 's1', biome: { slug: 'cryosteppe' } },
        { speciesId: 's1', biome: { slug: 'alpine' } },
      ],
    },
    speciesVersion: {
      createMany: async ({ data }) => {
        captured.push(...data);
        return { count: data.length };
      },
    },
  };

  await snapshotEntity(fakeClient, 'v-test', FIELD_MAP.species);

  const s1 = captured.find((d) => d.speciesId === 's1');
  const s2 = captured.find((d) => d.speciesId === 's2');

  assert.ok(s1, 's1 snapshot row was created');
  assert.deepEqual(
    s1.biomeSlugs,
    ['alpine', 'cryosteppe'],
    'biomeSlugs recomputed from the junction and sorted, not the stale cache',
  );
  assert.deepEqual(
    s2.biomeSlugs,
    [],
    'a species with no junction rows gets an empty array, not its stale cache',
  );
});
