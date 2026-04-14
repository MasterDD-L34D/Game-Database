const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const dashboardModule = require('../routes/dashboard');

const { computeDashboardStats, createDashboardRouter } = dashboardModule;

test('computeDashboardStats aggregates data and formats trends', async () => {
  const stubCounts = {
    total: 120,
    previousTotal: 110,
    newCurrent: 15,
    newPrevious: 10,
    errorTotal: 7,
    errorCurrentWindow: 3,
    errorPreviousWindow: 5,
  };

  const fakePrisma = {
    record: {
      async count(args = {}) {
        if (!args.where) return stubCounts.total;
        if (args.where.createdAt && 'lt' in args.where.createdAt && !('gte' in args.where.createdAt)) {
          return stubCounts.previousTotal;
        }
        if (args.where.createdAt && 'gte' in args.where.createdAt && !('lt' in args.where.createdAt)) {
          return stubCounts.newCurrent;
        }
        if (args.where.createdAt && 'gte' in args.where.createdAt && 'lt' in args.where.createdAt) {
          return stubCounts.newPrevious;
        }
        if (args.where.stato === 'Bozza' && !args.where.updatedAt) {
          return stubCounts.errorTotal;
        }
        if (
          args.where.stato === 'Bozza' &&
          args.where.updatedAt &&
          'gte' in args.where.updatedAt &&
          !('lt' in args.where.updatedAt)
        ) {
          return stubCounts.errorCurrentWindow;
        }
        if (
          args.where.stato === 'Bozza' &&
          args.where.updatedAt &&
          'gte' in args.where.updatedAt &&
          'lt' in args.where.updatedAt
        ) {
          return stubCounts.errorPreviousWindow;
        }
        throw new Error('Unexpected query shape');
      },
    },
    trait: {
      async count() {
        return 12;
      },
    },
    biome: {
      async count(args = {}) {
        if (args.where) return 1;
        return 6;
      },
    },
    species: {
      async count(args = {}) {
        if (args.where) return 2;
        return 24;
      },
    },
    ecosystem: {
      async count(args = {}) {
        if (args.where) return 1;
        return 4;
      },
    },
    speciesTrait: {
      async count() {
        return 41;
      },
    },
    speciesBiome: {
      async count() {
        return 29;
      },
    },
    ecosystemBiome: {
      async count() {
        return 16;
      },
    },
    ecosystemSpecies: {
      async count() {
        return 31;
      },
    },
  };

  const stats = await computeDashboardStats(fakePrisma, {
    now: new Date('2024-05-08T00:00:00Z'),
    windowDays: 7,
  });

  assert.deepEqual(stats, {
    totalRecords: { value: 120, trend: '+10 rispetto a 7 giorni fa' },
    newRecords: { value: 15, trend: '+5 rispetto alla settimana precedente' },
    errorRecords: { value: 7, trend: '-2 rispetto alla settimana precedente' },
    taxonomy: {
      entities: {
        traits: 12,
        biomes: 6,
        species: 24,
        ecosystems: 4,
        total: 46,
      },
      relations: {
        speciesTraits: 41,
        speciesBiomes: 29,
        ecosystemBiomes: 16,
        ecosystemSpecies: 31,
        total: 117,
      },
      quality: {
        orphanTraits: 12,
        orphanBiomes: 1,
        orphanSpecies: 2,
        orphanEcosystems: 1,
      },
    },
  });
});

test('GET /stats responds with aggregated payload', async () => {
  const zeroPrisma = {
    record: { async count() { return 0; } },
    trait: { async count() { return 0; } },
    biome: { async count() { return 0; } },
    species: { async count() { return 0; } },
    ecosystem: { async count() { return 0; } },
    speciesTrait: { async count() { return 0; } },
    speciesBiome: { async count() { return 0; } },
    ecosystemBiome: { async count() { return 0; } },
    ecosystemSpecies: { async count() { return 0; } },
  };
  const router = createDashboardRouter(zeroPrisma);
  const app = express();
  app.use('/dashboard', router);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();

  const response = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: 'GET',
        hostname: '127.0.0.1',
        port,
        path: '/dashboard/stats',
      },
      res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });

  await new Promise(resolve => server.close(resolve));

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), {
    totalRecords: { value: 0 },
    newRecords: { value: 0 },
    errorRecords: { value: 0 },
    taxonomy: {
      entities: {
        traits: 0,
        biomes: 0,
        species: 0,
        ecosystems: 0,
        total: 0,
      },
      relations: {
        speciesTraits: 0,
        speciesBiomes: 0,
        ecosystemBiomes: 0,
        ecosystemSpecies: 0,
        total: 0,
      },
      quality: {
        orphanTraits: 0,
        orphanBiomes: 0,
        orphanSpecies: 0,
        orphanEcosystems: 0,
      },
    },
  });
});
