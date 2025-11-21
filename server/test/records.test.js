const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const createApp = require('../app');
const prisma = require('../db/prisma');

const originalRecordModel = {
  findMany: prisma.record?.findMany,
  create: prisma.record?.create,
  update: prisma.record?.update,
};

function restoreRecordModel() {
  if (originalRecordModel.findMany) {
    prisma.record.findMany = originalRecordModel.findMany;
  } else {
    delete prisma.record.findMany;
  }

  if (originalRecordModel.create) {
    prisma.record.create = originalRecordModel.create;
  } else {
    delete prisma.record.create;
  }

  if (originalRecordModel.update) {
    prisma.record.update = originalRecordModel.update;
  } else {
    delete prisma.record.update;
  }
}

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
    restoreRecordModel();
  }
});

test('POST /api/records returns 400 for invalid date input', async () => {
  let createCalled = false;
  prisma.record.create = async () => {
    createCalled = true;
    throw new Error('This should not be called for invalid payloads');
  };

  const app = createApp();
  const server = app.listen(0);
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const { port } = server.address();

    const payload = JSON.stringify({ nome: 'Invalid date', stato: 'Bozza', data: 'not-a-date' });

    const response = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          method: 'POST',
          hostname: '127.0.0.1',
          port,
          path: '/api/records',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
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
      req.write(payload);
      req.end();
    });

    assert.equal(createCalled, false);
    assert.equal(response.status, 400);
    assert.deepEqual(JSON.parse(response.body || '{}'), {
      error: 'Data non valida: usa una stringa ISO 8601 o null',
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    restoreRecordModel();
  }
});

test('POST /api/records returns 400 when nome is missing', async () => {
  let createCalled = false;
  prisma.record.create = async () => {
    createCalled = true;
    throw new Error('This should not be called when validation fails');
  };

  const app = createApp();
  const server = app.listen(0);
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const { port } = server.address();

    const payload = JSON.stringify({ stato: 'Bozza' });

    const response = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          method: 'POST',
          hostname: '127.0.0.1',
          port,
          path: '/api/records',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        res => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            resolve({
              status: res.statusCode,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    assert.equal(createCalled, false);
    assert.equal(response.status, 400);
    assert.deepEqual(JSON.parse(response.body || '{}'), {
      error: 'Il campo nome è obbligatorio e non può essere vuoto',
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    restoreRecordModel();
  }
});

test('POST /api/records returns 400 when stato is missing or invalid', async () => {
  let createCalled = false;
  prisma.record.create = async () => {
    createCalled = true;
    throw new Error('This should not be called when validation fails');
  };

  const app = createApp();
  const server = app.listen(0);
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const { port } = server.address();

    const payload = JSON.stringify({ nome: 'Missing stato' });

    const response = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          method: 'POST',
          hostname: '127.0.0.1',
          port,
          path: '/api/records',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        res => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            resolve({
              status: res.statusCode,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    assert.equal(createCalled, false);
    assert.equal(response.status, 400);
    assert.deepEqual(JSON.parse(response.body || '{}'), {
      error: 'Il campo stato è obbligatorio',
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    restoreRecordModel();
  }
});

test('POST /api/records returns 400 when stato is invalid', async () => {
  let createCalled = false;
  prisma.record.create = async () => {
    createCalled = true;
    throw new Error('This should not be called when validation fails');
  };

  const app = createApp();
  const server = app.listen(0);
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const { port } = server.address();

    const payload = JSON.stringify({ nome: 'Invalid stato', stato: 'NonValido' });

    const response = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          method: 'POST',
          hostname: '127.0.0.1',
          port,
          path: '/api/records',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        res => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            resolve({
              status: res.statusCode,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    assert.equal(createCalled, false);
    assert.equal(response.status, 400);
    assert.deepEqual(JSON.parse(response.body || '{}'), {
      error: 'Valore stato non valido: NonValido',
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    restoreRecordModel();
  }
});

test('PATCH /api/records/:id returns 400 when updating with invalid fields', async () => {
  let updateCalled = false;
  prisma.record.update = async () => {
    updateCalled = true;
    throw new Error('This should not be called when validation fails');
  };

  const app = createApp();
  const server = app.listen(0);
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const { port } = server.address();

    const payload = JSON.stringify({ nome: '', stato: 'NonValido' });

    const response = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          method: 'PATCH',
          hostname: '127.0.0.1',
          port,
          path: '/api/records/record-1',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        res => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            resolve({
              status: res.statusCode,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    assert.equal(updateCalled, false);
    assert.equal(response.status, 400);
    assert.deepEqual(JSON.parse(response.body || '{}'), {
      error: 'Il campo nome è obbligatorio e non può essere vuoto; Valore stato non valido: NonValido',
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    restoreRecordModel();
  }
});
