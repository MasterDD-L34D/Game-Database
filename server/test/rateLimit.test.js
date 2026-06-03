const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const { createMutationRateLimiter } = require('../middleware/rateLimit');

function request({ port, method = 'GET', path, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { method, hostname: '127.0.0.1', port, path, headers },
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
}

function buildApp() {
  const app = express();
  app.use(express.json());
  // limit = 3 mutations / window for deterministic test
  app.use(createMutationRateLimiter({ windowMs: 60_000, limit: 3 }));
  app.get('/api/traits/glossary', (_req, res) => res.json({ ok: true })); // Game integration read path
  app.post('/api/species', (_req, res) => res.status(200).json({ created: true }));
  return app;
}

async function listen(app) {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  return { server, port: server.address().port };
}

test('mutation requests get 200 under the limit, then 429 over it', async () => {
  const { server, port } = await listen(buildApp());
  try {
    const statuses = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await request({ port, method: 'POST', path: '/api/species' });
      statuses.push(res);
    }
    assert.deepEqual(
      statuses.map(r => r.status),
      [200, 200, 200, 429, 429],
      'first 3 writes pass (limit=3), 4th+ are rate-limited',
    );

    const limited = statuses[3];
    const payload = JSON.parse(limited.body);
    assert.equal(payload.code, 'RATE_LIMITED', '429 body matches sendError {code,message} shape');
    assert.equal(typeof payload.message, 'string');
    assert.ok(payload.message.length > 0);
  } finally {
    server.close();
  }
});

test('GET reads are NEVER rate-limited (protects read-only Game-database integration)', async () => {
  const { server, port } = await listen(buildApp());
  try {
    const statuses = [];
    // fire well past the limit on the read path the Game backend uses
    for (let i = 0; i < 10; i += 1) {
      const res = await request({ port, method: 'GET', path: '/api/traits/glossary' });
      statuses.push(res.status);
    }
    assert.ok(
      statuses.every(s => s === 200),
      `all GETs must stay 200 even past the mutation limit, got ${statuses.join(',')}`,
    );
  } finally {
    server.close();
  }
});

test('limiter is a no-op when RATE_LIMIT_ENABLED=false', async () => {
  const prev = process.env.RATE_LIMIT_ENABLED;
  process.env.RATE_LIMIT_ENABLED = 'false';
  try {
    const { server, port } = await listen(buildApp());
    try {
      const statuses = [];
      for (let i = 0; i < 5; i += 1) {
        const res = await request({ port, method: 'POST', path: '/api/species' });
        statuses.push(res.status);
      }
      assert.ok(
        statuses.every(s => s === 200),
        `kill-switch must disable limiting, got ${statuses.join(',')}`,
      );
    } finally {
      server.close();
    }
  } finally {
    if (prev === undefined) delete process.env.RATE_LIMIT_ENABLED;
    else process.env.RATE_LIMIT_ENABLED = prev;
  }
});
