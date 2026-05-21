#!/usr/bin/env node
'use strict';
// RFC #1 Phase A backfill: copy every master row into its *Version snapshot
// table under the baseline v1.0.0 version. Idempotent (createMany +
// skipDuplicates against the (<entity>Id, versionId) unique pair), chunked at
// 1000 rows, line-buffered progress log. Safe to re-run.

const CHUNK = 1000;
const BASELINE_TAG = 'v1.0.0';

const FIELD_MAP = {
  trait: {
    delegate: 'trait',
    snapshot: 'traitVersion',
    fk: 'traitId',
    fields: [
      'slug', 'name', 'description', 'category', 'unit', 'dataType',
      'allowedValues', 'rangeMin', 'rangeMax', 'tier', 'familyType',
      'energyMaintenance', 'slotProfile', 'usageTags', 'synergies',
      'conflicts', 'environmentalRequirements', 'inducedMutation',
      'functionalUse', 'selectiveDrive', 'weakness',
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
    ],
  },
  ecosystem: {
    delegate: 'ecosystem',
    snapshot: 'ecosystemVersion',
    fk: 'ecosystemId',
    fields: ['slug', 'name', 'description', 'region', 'climate'],
  },
};

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

async function backfillEntity(prisma, versionId, cfg) {
  let skip = 0;
  let total = 0;
  for (;;) {
    const rows = await prisma[cfg.delegate].findMany({
      skip,
      take: CHUNK,
      orderBy: { id: 'asc' },
    });
    if (rows.length === 0) break;
    const data = rows.map((row) => {
      const snap = { [cfg.fk]: row.id, versionId };
      for (const f of cfg.fields) snap[f] = row[f];
      return snap;
    });
    const res = await prisma[cfg.snapshot].createMany({ data, skipDuplicates: true });
    total += res.count;
    skip += rows.length;
    log(`  ${cfg.delegate}: processed ${skip}, inserted ${total} (skipped ${skip - total} existing)`);
    if (rows.length < CHUNK) break;
  }
  return total;
}

async function backfillV1Snapshots(prisma) {
  const baseline = await prisma.taxonomyVersion.findUnique({ where: { tag: BASELINE_TAG } });
  if (!baseline) {
    throw new Error(`Baseline version ${BASELINE_TAG} not found -- run prisma migrate deploy first.`);
  }
  log(`Backfilling snapshots into ${BASELINE_TAG} (${baseline.id})...`);
  const summary = {};
  for (const key of Object.keys(FIELD_MAP)) {
    summary[key] = await backfillEntity(prisma, baseline.id, FIELD_MAP[key]);
  }
  log(`Backfill complete: ${JSON.stringify(summary)}`);
  return summary;
}

module.exports = { backfillV1Snapshots };

if (require.main === module) {
  const prisma = require('../db/prisma');
  backfillV1Snapshots(prisma)
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
