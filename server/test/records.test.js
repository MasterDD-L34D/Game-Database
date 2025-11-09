const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const createApp = require('../app');
const prisma = require('../db/prisma');

const originalRecordModel = {
  findMany: prisma.record?.findMany,
};

test('GET /api/records/export returns CSV content by default', async () => {
  const sampleRecords = [
    {
      id: 'record-1',
      nome: 'Record One',
      stato: 'Bozza',
      stile: 'A',
      pattern: null,
      peso: null,
      curvatura: null,
      descrizione: null,
      data: new Date('2024-05-01T00:00:00Z'),
      createdBy: 'user-1',
      updatedBy: 'user-1',
      createdAt: new Date('2024-05-02T00:00:00Z'),
      updatedAt: new Date('2024-05-02T00:00:00Z'),
    },
  ];

  prisma.record.findMany = async ({ skip = 0 } = {}) => {
    if (skip === 0) return sampleRecords;
    return [];
  };

  try {
    const app = createApp();
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const { port } = server.address();

    const response = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          method: 'GET',
          hostname: '127.0.0.1',
          port,
          path: '/api/records/export',
        },
        res => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });
        },
      );
      req.on('error', reject);
      req.end();
    });

    await new Promise(resolve => server.close(resolve));

    assert.equal(response.status, 200);
    assert.equal(response.headers['content-type'], 'text/csv; charset=utf-8');
    assert.ok(response.headers['content-disposition']?.includes('records_'));
    assert.match(response.body, /^id,nome,stato/);
    assert.match(response.body, /record-1,Record One,Bozza/);
  } finally {
    if (originalRecordModel.findMany) {
      prisma.record.findMany = originalRecordModel.findMany;
    } else {
      delete prisma.record.findMany;
    }
  }
});
