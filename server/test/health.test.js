const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const createApp = require('../app');

test('GET /api responds with health payload', async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();

  const response = await new Promise((resolve, reject) => {
    const request = http.request(
      { method: 'GET', hostname: '127.0.0.1', port, path: '/api' },
      res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
        });
      },
    );
    request.on('error', reject);
    request.end();
  });

  await new Promise(resolve => server.close(resolve));

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { status: 'ok' });
});
