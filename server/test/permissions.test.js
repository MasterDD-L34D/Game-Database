const { test } = require('node:test');
const assert = require('node:assert/strict');
const user = require('../middleware/user');

const {
  requireRole,
  requireTaxonomyWrite,
  TAXONOMY_WRITE_ROLES,
} = require('../middleware/permissions');

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

test('requireRole denies access when user lacks required roles', () => {
  const middleware = requireRole('admin', 'editor');
  const req = { userRoles: ['viewer'] };
  const res = createResponseCapture();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, {
    code: 'FORBIDDEN',
    message: 'Insufficient permissions',
  });
});

test('requireRole allows access when user has at least one required role', () => {
  const middleware = requireRole('admin', 'editor');
  const req = { userRoles: ['viewer', 'editor'] };
  const res = createResponseCapture();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, null);
  assert.equal(nextCalled, true);
});

test('requireTaxonomyWrite uses allowed role list and allows authorized users', () => {
  assert.ok(Array.isArray(TAXONOMY_WRITE_ROLES));
  assert.ok(TAXONOMY_WRITE_ROLES.length > 0);

  const req = { userRoles: ['guest', TAXONOMY_WRITE_ROLES[0]] };
  const res = createResponseCapture();
  let nextCalled = false;

  requireTaxonomyWrite(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, null);
  assert.equal(nextCalled, true);
});

test('requireTaxonomyWrite honors comma and space separated TAXONOMY_WRITE_ROLES', () => {
  const originalEnv = process.env.TAXONOMY_WRITE_ROLES;
  process.env.TAXONOMY_WRITE_ROLES = 'taxonomy:write, custom-editor admin';

  const permissionsPath = require.resolve('../middleware/permissions');
  delete require.cache[permissionsPath];
  const freshPermissions = require('../middleware/permissions');

  assert.deepEqual(freshPermissions.TAXONOMY_WRITE_ROLES, [
    'taxonomy:write',
    'custom-editor',
    'admin',
  ]);

  const req = { userRoles: ['custom-editor'] };
  const res = createResponseCapture();
  let nextCalled = false;

  freshPermissions.requireTaxonomyWrite(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, null);
  assert.equal(nextCalled, true);

  process.env.TAXONOMY_WRITE_ROLES = originalEnv;
  delete require.cache[permissionsPath];
});

test('requireTaxonomyWrite denies requests from unauthorized users', () => {
  const req = { userRoles: ['guest'] };
  const res = createResponseCapture();
  let nextCalled = false;

  requireTaxonomyWrite(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, {
    code: 'FORBIDDEN',
    message: 'Insufficient permissions',
  });
});

test('requireTaxonomyWrite denies requests when no roles are provided', () => {
  const req = { userRoles: [] };
  const res = createResponseCapture();
  let nextCalled = false;

  requireTaxonomyWrite(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, {
    code: 'FORBIDDEN',
    message: 'Insufficient permissions',
  });
});

test('user middleware parses multi-value X-Roles and grants authorized role', () => {
  const req = {
    get(name) {
      if (name.toLowerCase() === 'x-roles') {
        return ['guest, reader', 'taxonomy:write admin'];
      }
      return null;
    },
  };
  const res = {};
  let nextCalled = false;

  user(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.userRoles, ['guest', 'reader', 'taxonomy:write', 'admin']);

  const permissionRes = createResponseCapture();
  let permissionNextCalled = false;
  requireTaxonomyWrite(req, permissionRes, () => {
    permissionNextCalled = true;
  });

  assert.equal(permissionRes.statusCode, null);
  assert.equal(permissionNextCalled, true);
});

test('user middleware parses multi-value X-User-Roles and denies unauthorized role', () => {
  const req = {
    get(name) {
      if (name.toLowerCase() === 'x-user-roles') {
        return 'guest, reader analyst';
      }
      return null;
    },
  };
  const res = {};
  let nextCalled = false;

  user(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.userRoles, ['guest', 'reader', 'analyst']);

  const permissionRes = createResponseCapture();
  let permissionNextCalled = false;
  requireTaxonomyWrite(req, permissionRes, () => {
    permissionNextCalled = true;
  });

  assert.equal(permissionNextCalled, false);
  assert.equal(permissionRes.statusCode, 403);
  assert.deepEqual(permissionRes.payload, {
    code: 'FORBIDDEN',
    message: 'Insufficient permissions',
  });
});
