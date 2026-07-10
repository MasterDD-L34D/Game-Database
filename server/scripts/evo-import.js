#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
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

// Reaching this point means the import exited 0 (run() exits the process on
// failure). Append a history line so "when was the standing DB last updated"
// has an answer; logs/ is gitignored, the history is per-machine by design.
// Mode labels mirror import-taxonomy.js: --validate-only implies dry-run
// (no DB writes), so neither counts as an update of the standing DB.
const hasFlag = (name) => forwardedArgs.some((a) => a === name || a.startsWith(`${name}=`));
const mode = hasFlag('--validate-only') ? 'validate-only' : hasFlag('--dry-run') ? 'dry-run' : 'import';
const logDir = path.join(rootDir, 'logs');
fs.mkdirSync(logDir, { recursive: true });
fs.appendFileSync(
  path.join(logDir, 'evo-import-history.log'),
  `${new Date().toISOString()} ${mode} ok host=${os.hostname()} args=${forwardedArgs.join(' ')}\n`,
);
console.log(`[evo-import] Esito registrato in logs/evo-import-history.log (${mode})`);
