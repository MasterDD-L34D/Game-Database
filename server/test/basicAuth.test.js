const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const basicAuth = require('../middleware/basicAuth');
const user = require('../middleware/user');

function request({ port, path, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: 'GET',
        hostname: '127.0.0.1',
        port,
        path,
        headers,
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
}

test('basic auth protects routes when credentials are configured and propagates auth context', async () => {
  const previousUser = process.env.APP_AUTH_USER;
  const previousPassword = process.env.APP_AUTH_PASSWORD;
  const previousRoles = process.env.APP_AUTH_ROLES;

  process.env.APP_AUTH_USER = 'lanadmin';
  process.env.APP_AUTH_PASSWORD = 'lanpass';
  process.env.APP_AUTH_ROLES = 'taxonomy:write,admin';

  const app = express();
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(basicAuth);
  app.use(user);
  app.get('/secure', (req, res) => {
    res.json({ user: req.user, roles: req.userRoles });
  });

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();

  const unauthorized = await request({ port, path: '/secure' });
  assert.equal(unauthorized.status, 401);
  assert.match(unauthorized.headers['www-authenticate'] || '', /Basic/);

  const health = await request({ port, path: '/health' });
  assert.equal(health.status, 200);

  const token = Buffer.from('lanadmin:lanpass').toString('base64');
  const authorized = await request({
    port,
    path: '/secure',
    headers: { Authorization: `Basic ${token}` },
  });

  await new Promise(resolve => server.close(resolve));

  if (previousUser === undefined) delete process.env.APP_AUTH_USER;
  else process.env.APP_AUTH_USER = previousUser;
  if (previousPassword === undefined) delete process.env.APP_AUTH_PASSWORD;
  else process.env.APP_AUTH_PASSWORD = previousPassword;
  if (previousRoles === undefined) delete process.env.APP_AUTH_ROLES;
  else process.env.APP_AUTH_ROLES = previousRoles;

  assert.equal(authorized.status, 200);
  assert.deepEqual(JSON.parse(authorized.body), {
    user: 'lanadmin',
    roles: ['taxonomy:write', 'admin'],
  });
});
