const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const createApp = require('../app');

process.env.API_TOKEN = 'test-token';

const app = createApp();

const taxonomyEndpoints = [
  { method: 'post', path: '/api/traits', body: {} },
  { method: 'put', path: '/api/traits/example', body: {} },
  { method: 'delete', path: '/api/traits/example' },
  { method: 'post', path: '/api/biomes', body: {} },
  { method: 'put', path: '/api/biomes/example', body: {} },
  { method: 'delete', path: '/api/biomes/example' },
  { method: 'post', path: '/api/species', body: {} },
  { method: 'put', path: '/api/species/example', body: {} },
  { method: 'delete', path: '/api/species/example' },
  { method: 'post', path: '/api/ecosystems', body: {} },
  { method: 'put', path: '/api/ecosystems/example', body: {} },
  { method: 'delete', path: '/api/ecosystems/example' },
];

async function sendRequest({ method, path, body }, rolesHeader) {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();

  const payload = body ? JSON.stringify(body) : undefined;
  const headers = {
    Authorization: 'Bearer test-token',
    'X-User': 'tester@example.com',
    ...(rolesHeader !== undefined ? { 'X-Roles': rolesHeader } : {}),
  };
  if (payload) headers['Content-Type'] = 'application/json';

  const options = {
    method: method.toUpperCase(),
    hostname: '127.0.0.1',
    port,
    path,
    headers,
  };

  const response = await new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        resolve({ status: res.statusCode, body: text });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

  await new Promise(resolve => server.close(resolve));
  return response;
}

test('taxonomy mutations without roles are forbidden', async () => {
  for (const endpoint of taxonomyEndpoints) {
    const response = await sendRequest(endpoint);
    assert.equal(response.status, 403, `${endpoint.method.toUpperCase()} ${endpoint.path} should return 403 without roles`);
  }
});

test('taxonomy mutations reject unrelated roles', async () => {
  for (const endpoint of taxonomyEndpoints) {
    const response = await sendRequest(endpoint, 'records:write');
    assert.equal(
      response.status,
      403,
      `${endpoint.method.toUpperCase()} ${endpoint.path} should return 403 for roles without taxonomy permissions`,
    );
  }
});
