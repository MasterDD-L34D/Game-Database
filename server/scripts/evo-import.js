#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const shouldRunSetup = !args.includes('--no-setup');
const forwardedArgs = args.filter((arg) => arg !== '--no-setup');
const rootDir = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

if (shouldRunSetup) {
  console.log('[evo-import] Esecuzione npm run dev:setup');
  run(npmCommand, ['run', 'dev:setup']);
} else {
  console.log('[evo-import] Skip npm run dev:setup');
}

console.log('[evo-import] Esecuzione import-taxonomy.js');
run(process.execPath, [path.join('scripts', 'ingest', 'import-taxonomy.js'), ...forwardedArgs]);
