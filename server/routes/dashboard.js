const express = require('express');
const prisma = require('../db/prisma');

function subtractDays(baseDate, days) {
  const date = new Date(baseDate.getTime());
  date.setDate(date.getDate() - days);
  return date;
}

function formatTrend(delta, label) {
  if (!delta) return null;
  const prefix = delta > 0 ? '+' : '';
  return `${prefix}${delta} ${label}`;
}

function toMetric(value, trend) {
  return trend ? { value, trend } : { value };
}

async function computeDashboardStats(client, { now = new Date(), windowDays = 7 } = {}) {
  const reference = new Date(now.getTime());
  const safeWindowDays = Number.isFinite(windowDays) && windowDays > 0 ? Math.floor(windowDays) : 7;
  const currentWindowStart = subtractDays(reference, safeWindowDays);
  const previousWindowStart = subtractDays(currentWindowStart, safeWindowDays);

  const [
    totalRecords,
    previousTotalRecords,
    newRecordsCurrentWindow,
    newRecordsPreviousWindow,
    totalErrorRecords,
    errorRecordsCurrentWindow,
    errorRecordsPreviousWindow,
    totalTraits,
    totalBiomes,
    totalSpecies,
    totalEcosystems,
    totalSpeciesTraits,
    totalSpeciesBiomes,
    totalEcosystemBiomes,
    totalEcosystemSpecies,
    orphanTraits,
    orphanBiomes,
    orphanSpecies,
    orphanEcosystems,
  ] = await Promise.all([
    client.record.count(),
    client.record.count({ where: { createdAt: { lt: currentWindowStart } } }),
    client.record.count({ where: { createdAt: { gte: currentWindowStart } } }),
    client.record.count({ where: { createdAt: { gte: previousWindowStart, lt: currentWindowStart } } }),
    client.record.count({ where: { stato: 'Bozza' } }),
    client.record.count({ where: { stato: 'Bozza', updatedAt: { gte: currentWindowStart } } }),
    client.record.count({ where: { stato: 'Bozza', updatedAt: { gte: previousWindowStart, lt: currentWindowStart } } }),
    client.trait.count(),
    client.biome.count(),
    client.species.count(),
    client.ecosystem.count(),
    client.speciesTrait.count(),
    client.speciesBiome.count(),
    client.ecosystemBiome.count(),
    client.ecosystemSpecies.count(),
    client.trait.count({ where: { speciesValues: { none: {} } } }),
    client.biome.count({ where: { species: { none: {} }, ecosystems: { none: {} } } }),
    client.species.count({ where: { traits: { none: {} }, biomes: { none: {} }, ecosystems: { none: {} } } }),
    client.ecosystem.count({ where: { biomes: { none: {} }, species: { none: {} } } }),
  ]);

  const totalTrend = formatTrend(totalRecords - previousTotalRecords, `rispetto a ${safeWindowDays} giorni fa`);
  const newRecordsTrend = formatTrend(
    newRecordsCurrentWindow - newRecordsPreviousWindow,
    safeWindowDays === 7 ? 'rispetto alla settimana precedente' : `rispetto agli ultimi ${safeWindowDays} giorni`,
  );
  const errorRecordsTrend = formatTrend(
    errorRecordsCurrentWindow - errorRecordsPreviousWindow,
    safeWindowDays === 7 ? 'rispetto alla settimana precedente' : `rispetto agli ultimi ${safeWindowDays} giorni`,
  );

  return {
    totalRecords: toMetric(totalRecords, totalTrend),
    newRecords: toMetric(newRecordsCurrentWindow, newRecordsTrend),
    errorRecords: toMetric(totalErrorRecords, errorRecordsTrend),
    taxonomy: {
      entities: {
        traits: totalTraits,
        biomes: totalBiomes,
        species: totalSpecies,
        ecosystems: totalEcosystems,
        total: totalTraits + totalBiomes + totalSpecies + totalEcosystems,
      },
      relations: {
        speciesTraits: totalSpeciesTraits,
        speciesBiomes: totalSpeciesBiomes,
        ecosystemBiomes: totalEcosystemBiomes,
        ecosystemSpecies: totalEcosystemSpecies,
        total: totalSpeciesTraits + totalSpeciesBiomes + totalEcosystemBiomes + totalEcosystemSpecies,
      },
      quality: {
        orphanTraits,
        orphanBiomes,
        orphanSpecies,
        orphanEcosystems,
      },
    },
  };
}

function createDashboardRouter(client = prisma) {
  const router = express.Router();

  router.get('/stats', async (req, res) => {
    try {
      const stats = await computeDashboardStats(client);
      res.json(stats);
    } catch (error) {
      console.error('Failed to compute dashboard stats', error);
      res.status(500).json({ error: 'Failed to compute dashboard stats' });
    }
  });

  return router;
}

const router = createDashboardRouter();
router.createDashboardRouter = createDashboardRouter;
router.computeDashboardStats = computeDashboardStats;

module.exports = router;
