'use strict';
// Shared taxonomy-version snapshot logic: the master->snapshot field mapping
// plus the chunked copy used by BOTH the Phase A backfill script and the
// Phase B1 release endpoint. One frozen-field source avoids drift.

const CHUNK = 1000;

// Frozen v1.0.0 scalar field set. Do NOT sync this to future schema changes:
// a snapshot must capture the columns as they existed at release time.
// RFC #4 OQ2 (2026-06-11) adds nameEn/descriptionEn; old snapshots stay null by design.
// RFC #4 S1c (2026-06-11) adds sourceKey; old snapshots stay null by design.
// RFC #4 S1d: sourceFiles membership.
// RFC #4 Sp1a: Species provenance + snapshot determinism (sourceKey, sourceFiles, sourceExtras, biomeSlugs). Old snapshots stay null by design.
const FIELD_MAP = {
  trait: {
    delegate: 'trait',
    snapshot: 'traitVersion',
    fk: 'traitId',
    fields: [
      'slug', 'sourceKey', 'sourceFiles', 'name', 'description', 'nameEn', 'descriptionEn', 'category', 'unit', 'dataType',
      'allowedValues', 'rangeMin', 'rangeMax', 'tier', 'familyType',
      'energyMaintenance', 'slotProfile', 'usageTags', 'synergies',
      'conflicts', 'environmentalRequirements', 'inducedMutation',
      'functionalUse', 'selectiveDrive', 'weakness', 'sourceExtras', // RFC #4 reference cycle
    ],
  },
  biome: {
    delegate: 'biome',
    snapshot: 'biomeVersion',
    fk: 'biomeId',
    fields: [
      'slug', 'name', 'description', 'climate', 'parentId', 'summary',
      'climateTags', 'hazard', 'ecology', 'roleTemplates', 'sizeMin', 'sizeMax',
    ],
  },
  species: {
    delegate: 'species',
    snapshot: 'speciesVersion',
    fk: 'speciesId',
    fields: [
      'slug', 'scientificName', 'commonName', 'kingdom', 'phylum', 'class',
      'order', 'family', 'genus', 'epithet', 'status', 'description',
      'displayName', 'trophicRole', 'functionalTags', 'flags', 'balance',
      'playableUnit', 'morphotype', 'vcCoefficients', 'spawnRules',
      'environmentAffinity', 'jobsBias', 'telemetry',
      'sourceKey', 'sourceFiles', 'sourceExtras', 'biomeSlugs',
    ],
  },
  ecosystem: {
    delegate: 'ecosystem',
    snapshot: 'ecosystemVersion',
    fk: 'ecosystemId',
    fields: ['slug', 'name', 'description', 'region', 'climate'],
  },
};

// Copy every row of one master into its *Version table under versionId, in
// CHUNK-sized batches. `client` is the prisma singleton OR a $transaction tx.
// `log` is an optional progress callback. Returns the inserted-row count.
async function snapshotEntity(client, versionId, cfg, log = () => {}) {
  let skip = 0;
  let total = 0;
  for (;;) {
    const rows = await client[cfg.delegate].findMany({ skip, take: CHUNK, orderBy: { id: 'asc' } });
    if (rows.length === 0) break;
    const data = rows.map((row) => {
      const snap = { [cfg.fk]: row.id, versionId };
      for (const f of cfg.fields) snap[f] = row[f];
      return snap;
    });
    const res = await client[cfg.snapshot].createMany({ data, skipDuplicates: true });
    total += res.count;
    skip += rows.length;
    log(`  ${cfg.delegate}: processed ${skip}, inserted ${total} (skipped ${skip - total} existing)`);
    if (rows.length < CHUNK) break;
  }
  return total;
}

// Snapshot all 4 masters into versionId. Returns { trait, biome, species, ecosystem } counts.
async function snapshotAllMasters(client, versionId, log = () => {}) {
  const summary = {};
  for (const key of Object.keys(FIELD_MAP)) {
    summary[key] = await snapshotEntity(client, versionId, FIELD_MAP[key], log);
  }
  return summary;
}

// Total existing snapshot rows for a version, across all 4 snapshot tables.
async function baselineSnapshotCount(client, versionId) {
  const counts = await Promise.all(
    Object.values(FIELD_MAP).map((cfg) => client[cfg.snapshot].count({ where: { versionId } })),
  );
  return counts.reduce((sum, n) => sum + n, 0);
}

module.exports = { CHUNK, FIELD_MAP, snapshotEntity, snapshotAllMasters, baselineSnapshotCount };
