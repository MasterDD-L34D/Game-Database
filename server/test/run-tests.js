#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');

const testFiles = [
  'health.test.js',
  'dashboard.test.js',
  'permissions.test.js',
  'userAuthority.test.js',
  'records.test.js',
  'taxonomyRouters.test.js',
  'speciesTraits.test.js',
  'speciesBiomes.test.js',
  'ecosystemBiomes.test.js',
  'ecosystemSpecies.test.js',
  'basicAuth.test.js',
  'rateLimit.test.js',
  'testInfraRestore.test.js',
  'slug.test.js',
  'versionImmutability.test.js',
  'taxonomyVersions.test.js',
  'versionRead.test.js',
  'schemaIndexes.test.js',
  'searchQuery.test.js',
  'search.test.js',
  'audit.test.js',
  'importValidator.test.js',
  'httpErrors.test.js',
];

// Integration tests authorize writes by simulating a trusted caller via client
// role headers (X-Roles). The `user` middleware fails closed on those headers
// unless TRUST_CLIENT_ROLE_HEADERS is set, so enable it for the suite. The
// fail-closed security behavior itself is covered by userAuthority.test.js,
// which toggles the flag off in-process.
process.env.TRUST_CLIENT_ROLE_HEADERS = process.env.TRUST_CLIENT_ROLE_HEADERS || '1';

for (const testFile of testFiles) {
  console.log(`Running ${testFile}`);
  const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(`./test/${testFile}`)})`], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
