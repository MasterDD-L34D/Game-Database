#!/usr/bin/env node
'use strict';
// RFC #1 Phase A backfill: copy every master row into its *Version snapshot
// table under the baseline v1.0.0 version. Idempotent (createMany +
// skipDuplicates), chunked, line-buffered progress log.
//
// Runs once: if the v1.0.0 baseline already holds any snapshot, the backfill is
// skipped. Otherwise re-running after new master rows were created (e.g.
// `dev:setup` re-invokes this script) would append those newer rows into the
// *released* baseline, mutating what v1.0.0 means. The first run defines
// v1.0.0; later runs are no-ops.

const { FIELD_MAP, snapshotAllMasters, baselineSnapshotCount } = require('../utils/versionSnapshot');

const BASELINE_TAG = 'v1.0.0';

/**
 * @param {string} msg
 * @returns {void}
 */
function log(msg) {
  process.stdout.write(`${msg}\n`);
}

/**
 * @param {Object} prisma
 * @returns {Promise<Object>}
 */
async function backfillV1Snapshots(prisma) {
  const baseline = await prisma.taxonomyVersion.findUnique({ where: { tag: BASELINE_TAG } });
  if (!baseline) {
    throw new Error(`Baseline version ${BASELINE_TAG} not found -- run prisma migrate deploy first.`);
  }
  const zeroSummary = Object.fromEntries(Object.keys(FIELD_MAP).map((key) => [key, 0]));

  const existing = await baselineSnapshotCount(prisma, baseline.id);
  if (existing > 0) {
    log(`Baseline ${BASELINE_TAG} already holds ${existing} snapshot(s); skipping backfill to keep the released baseline immutable.`);
    return zeroSummary;
  }

  log(`Backfilling snapshots into ${BASELINE_TAG} (${baseline.id})...`);
  const summary = await snapshotAllMasters(prisma, baseline.id, log);
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
