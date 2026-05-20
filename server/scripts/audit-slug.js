#!/usr/bin/env node
// server/scripts/audit-slug.js
// Audit slug collision rate, Unicode-stripped count, length p50/p95/p99
// across Trait + Biome + Species + Ecosystem rows. Read-only.
// Per PR-α QG Step 3 tuning measurement.

'use strict';

const prisma = require('../db/prisma');
const { normalizeSlug, MAX_SLUG_LENGTH } = require('../utils/slug');

const MODELS = ['trait', 'biome', 'species', 'ecosystem'];

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.floor(sortedArr.length * p));
  return sortedArr[idx];
}

async function auditModel(model) {
  const rows = await prisma[model].findMany({
    select: { id: true, slug: true },
  });
  const lengths = rows.map(r => (r.slug || '').length).sort((a, b) => a - b);
  const renorm = rows.map(r => ({
    id: r.id,
    original: r.slug,
    canonical: normalizeSlug(r.slug),
  }));
  const drifted = renorm.filter(r => r.original !== r.canonical);
  const tooLong = rows.filter(r => (r.slug || '').length > MAX_SLUG_LENGTH);
  const seen = new Map();
  for (const row of rows) {
    if (!row.slug) continue;
    seen.set(row.slug, (seen.get(row.slug) || 0) + 1);
  }
  const collisions = [...seen.entries()].filter(([, n]) => n > 1);

  return {
    model,
    rows: rows.length,
    lengthP50: percentile(lengths, 0.5),
    lengthP95: percentile(lengths, 0.95),
    lengthP99: percentile(lengths, 0.99),
    lengthMax: lengths.length > 0 ? lengths[lengths.length - 1] : 0,
    overMaxCount: tooLong.length,
    renormDriftCount: drifted.length,
    collisionCount: collisions.length,
    collisionExamples: collisions.slice(0, 3).map(([s, n]) => ({ slug: s, count: n })),
    driftExamples: drifted.slice(0, 3).map(({ id, original, canonical }) => ({ id, original, canonical })),
  };
}

async function main() {
  const results = [];
  for (const m of MODELS) {
    try {
      results.push(await auditModel(m));
    } catch (err) {
      results.push({ model: m, error: err.message });
    }
  }
  const report = {
    timestamp: new Date().toISOString(),
    maxSlugLength: MAX_SLUG_LENGTH,
    models: results,
    summary: {
      totalRows: results.reduce((acc, r) => acc + (r.rows || 0), 0),
      totalOverMax: results.reduce((acc, r) => acc + (r.overMaxCount || 0), 0),
      totalDrift: results.reduce((acc, r) => acc + (r.renormDriftCount || 0), 0),
      totalCollisions: results.reduce((acc, r) => acc + (r.collisionCount || 0), 0),
    },
  };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`audit-slug failed: ${err.stack || err.message}\n`);
    process.exit(1);
  });
}

module.exports = { auditModel };
