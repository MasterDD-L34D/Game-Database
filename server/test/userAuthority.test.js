const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const user = require('../middleware/user');
const basicAuth = require('../middleware/basicAuth');
const { requireTaxonomyWrite } = require('../middleware/permissions');

// These tests pin the authorization-trust contract of the `user` middleware
// (CWE-290 broken access control fix). The security-critical rule:
//   - roles come from the server-set req.authContext (populated by basicAuth);
//   - client X-Roles / X-User-Roles are IGNORED when the request is authenticated,
//     so a caller can never escalate beyond the roles the server assigned;
//   - when NOT authenticated (basicAuth disabled / "open mode") client role
//     headers are only honored if TRUST_CLIENT_ROLE_HEADERS is explicitly set,
//     otherwise no roles are granted (fail-closed).

const ORIGINAL_TRUST = process.env.TRUST_CLIENT_ROLE_HEADERS;

function setTrust(value) {
  if (value === undefined) delete process.env.TRUST_CLIENT_ROLE_HEADERS;
  else process.env.TRUST_CLIENT_ROLE_HEADERS = value;
}

function makeReq({ authContext, headers = {} } = {}) {
  const lower = {};
  for (const key of Object.keys(headers)) lower[key.toLowerCase()] = headers[key];
  const req = {
    get(name) {
      const value = lower[String(name).toLowerCase()];
      return value === undefined ? null : value;
    },
  };
  if (authContext !== undefined) req.authContext = authContext;
  return req;
}

function createResponseCapture() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.payload = value;
      return this;
    },
  };
}

function runUser(req) {
  let nextCalled = false;
  user(req, createResponseCapture(), () => {
    nextCalled = true;
  });
  return nextCalled;
}

function writeAllowed(req) {
  const res = createResponseCapture();
  let nextCalled = false;
  requireTaxonomyWrite(req, res, () => {
    nextCalled = true;
  });
  return { allowed: nextCalled, status: res.statusCode };
}

test('authenticated request: spoofed client roles are ignored, server authContext roles win', () => {
  // Trust is ON to prove authentication overrides client-header trust
  // unconditionally: an authenticated caller can never escalate via headers.
  setTrust('1');
  try {
    const req = makeReq({
      authContext: { user: 'lanadmin', roles: ['viewer'] },
      headers: { 'X-Roles': 'admin', 'X-User-Roles': 'taxonomy:write' },
    });
    runUser(req);

    assert.deepEqual(req.userRoles, ['viewer']);

    const write = writeAllowed(req);
    assert.equal(write.allowed, false);
    assert.equal(write.status, 403);
  } finally {
    setTrust(ORIGINAL_TRUST);
  }
});

test('authenticated request without client headers: server roles grant write', () => {
  setTrust(undefined);
  try {
    const req = makeReq({
      authContext: { user: 'lanadmin', roles: ['taxonomy:write', 'admin'] },
    });
    runUser(req);

    assert.deepEqual(req.userRoles, ['taxonomy:write', 'admin']);
    assert.equal(writeAllowed(req).allowed, true);
  } finally {
    setTrust(ORIGINAL_TRUST);
  }
});

test('open mode without opt-in: client X-Roles is ignored (fail-closed), write denied', () => {
  setTrust(undefined);
  try {
    const req = makeReq({ headers: { 'X-Roles': 'admin' } });
    runUser(req);

    assert.deepEqual(req.userRoles, []);

    const write = writeAllowed(req);
    assert.equal(write.allowed, false);
    assert.equal(write.status, 403);
  } finally {
    setTrust(ORIGINAL_TRUST);
  }
});

test('open mode without opt-in: client X-User-Roles is also ignored (fail-closed)', () => {
  setTrust(undefined);
  try {
    const req = makeReq({ headers: { 'X-User-Roles': 'taxonomy:write,admin' } });
    runUser(req);

    assert.deepEqual(req.userRoles, []);
    assert.equal(writeAllowed(req).allowed, false);
  } finally {
    setTrust(ORIGINAL_TRUST);
  }
});

test('open mode with TRUST_CLIENT_ROLE_HEADERS=1: client roles are honored', () => {
  setTrust('1');
  try {
    const req = makeReq({ headers: { 'X-Roles': 'taxonomy:write' } });
    runUser(req);

    assert.deepEqual(req.userRoles, ['taxonomy:write']);
    assert.equal(writeAllowed(req).allowed, true);
  } finally {
    setTrust(ORIGINAL_TRUST);
  }
});

test('TRUST_CLIENT_ROLE_HEADERS accepts the string "true"', () => {
  setTrust('true');
  try {
    const req = makeReq({ headers: { 'X-Roles': 'admin' } });
    runUser(req);

    assert.deepEqual(req.userRoles, ['admin']);
  } finally {
    setTrust(ORIGINAL_TRUST);
  }
});

test('identity (X-User) is preserved for audit attribution', () => {
  setTrust(undefined);
  try {
    // Client X-User wins for attribution, even when authenticated (identity is
    // attribution, not authorization).
    const authedWithHeader = makeReq({
      authContext: { user: 'lanadmin', roles: ['admin'] },
      headers: { 'X-User': 'operator@example.com' },
    });
    runUser(authedWithHeader);
    assert.equal(authedWithHeader.user, 'operator@example.com');

    // Falls back to the authenticated identity when no client header is sent.
    const authedNoHeader = makeReq({
      authContext: { user: 'lanadmin', roles: ['admin'] },
    });
    runUser(authedNoHeader);
    assert.equal(authedNoHeader.user, 'lanadmin');
  } finally {
    setTrust(ORIGINAL_TRUST);
  }
});

test('authenticated context without roles fails closed (no write)', () => {
  // Trust ON to prove the authenticated branch never falls back to client headers,
  // even when the server context carries no roles.
  setTrust('1');
  try {
    const req = makeReq({ authContext: { user: 'lanadmin' } });
    runUser(req);

    assert.deepEqual(req.userRoles, []);
    assert.equal(writeAllowed(req).allowed, false);
  } finally {
    setTrust(ORIGINAL_TRUST);
  }
});

// --- End-to-end tests through the real Express + basicAuth + user chain.
// These pin the wired guarantee (not just the function): authContext is only
// ever set by basicAuth, never by a client header.

function httpRequest({ port, path, method = 'GET', headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { method, hostname: '127.0.0.1', port, path, headers },
      res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function buildChainApp() {
  const app = express();
  app.use(basicAuth);
  app.use(user);
  app.get('/whoami', (req, res) => res.json({ user: req.user, roles: req.userRoles }));
  app.post('/write', requireTaxonomyWrite, (req, res) => res.json({ ok: true }));
  return app;
}

function snapshotEnv(keys) {
  const snapshot = {};
  for (const key of keys) snapshot[key] = process.env[key];
  return snapshot;
}

function restoreEnv(snapshot) {
  for (const key of Object.keys(snapshot)) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

test('[e2e] open mode: a client cannot inject roles or authContext via headers', async () => {
  const snap = snapshotEnv([
    'APP_AUTH_USER',
    'APP_AUTH_PASSWORD',
    'TRUST_CLIENT_ROLE_HEADERS',
  ]);
  delete process.env.APP_AUTH_USER;
  delete process.env.APP_AUTH_PASSWORD;
  delete process.env.TRUST_CLIENT_ROLE_HEADERS;

  const server = http.createServer(buildChainApp());
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const who = await httpRequest({
      port,
      path: '/whoami',
      headers: { 'X-Roles': 'admin', 'X-User-Roles': 'taxonomy:write' },
    });
    assert.equal(who.status, 200);
    assert.deepEqual(JSON.parse(who.body).roles, []);

    const write = await httpRequest({
      port,
      path: '/write',
      method: 'POST',
      headers: { 'X-Roles': 'admin' },
    });
    assert.equal(write.status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
    restoreEnv(snap);
  }
});

test('[e2e] authenticated: server roles win over spoofed client roles', async () => {
  const snap = snapshotEnv([
    'APP_AUTH_USER',
    'APP_AUTH_PASSWORD',
    'APP_AUTH_ROLES',
    'TRUST_CLIENT_ROLE_HEADERS',
  ]);
  process.env.APP_AUTH_USER = 'lanadmin';
  process.env.APP_AUTH_PASSWORD = 'lanpass';
  process.env.APP_AUTH_ROLES = 'viewer';
  // Trust ON to prove authentication beats client-header trust unconditionally.
  process.env.TRUST_CLIENT_ROLE_HEADERS = '1';

  const server = http.createServer(buildChainApp());
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();
  const token = Buffer.from('lanadmin:lanpass').toString('base64');
  try {
    // Unauthenticated request is rejected by basicAuth before reaching roles.
    const noAuth = await httpRequest({ port, path: '/whoami', headers: { 'X-Roles': 'admin' } });
    assert.equal(noAuth.status, 401);

    // Authenticated: spoofed X-Roles is ignored; server-assigned 'viewer' wins.
    const who = await httpRequest({
      port,
      path: '/whoami',
      headers: { Authorization: `Basic ${token}`, 'X-Roles': 'admin' },
    });
    assert.equal(who.status, 200);
    assert.deepEqual(JSON.parse(who.body).roles, ['viewer']);

    // 'viewer' cannot write, and the spoofed taxonomy:write header is ignored.
    const write = await httpRequest({
      port,
      path: '/write',
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'X-Roles': 'taxonomy:write' },
    });
    assert.equal(write.status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
    restoreEnv(snap);
  }
});
