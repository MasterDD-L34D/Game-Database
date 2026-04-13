#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');

const testFiles = [
  'health.test.js',
  'dashboard.test.js',
  'permissions.test.js',
  'records.test.js',
  'taxonomyRouters.test.js',
  'speciesTraits.test.js',
  'speciesBiomes.test.js',
  'ecosystemBiomes.test.js',
  'ecosystemSpecies.test.js',
  'basicAuth.test.js',
];

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
