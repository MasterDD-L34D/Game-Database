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
  };

  const stats = await computeDashboardStats(fakePrisma, {
    now: new Date('2024-05-08T00:00:00Z'),
    windowDays: 7,
  });

  assert.deepEqual(stats, {
    totalRecords: { value: 120, trend: '+10 rispetto a 7 giorni fa' },
    newRecords: { value: 15, trend: '+5 rispetto alla settimana precedente' },
    errorRecords: { value: 7, trend: '-2 rispetto alla settimana precedente' },
  });
});

test('GET /stats responds with aggregated payload', async () => {
  const zeroPrisma = { record: { async count() { return 0; } } };
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
  });
});
