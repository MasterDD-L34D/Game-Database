const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  requireRole,
  requireTaxonomyWrite,
  TAXONOMY_WRITE_ROLES,
} = require('../middleware/permissions');

function createResponseCapture() {
  return {
    statusCode: null,
    sendStatus(code) {
      this.statusCode = code;
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
});
