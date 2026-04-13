const { spawn, spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const serverDir = path.resolve(__dirname, '..');
const dashboardDir = path.resolve(repoRoot, 'apps', 'dashboard');

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!process.env.APP_AUTH_USER || !process.env.APP_AUTH_PASSWORD) {
  console.error(
    'APP_AUTH_USER e APP_AUTH_PASSWORD sono obbligatori per npm run start:lan.',
  );
  process.exit(1);
}

run('npm', ['run', 'build'], dashboardDir);

const child = spawn('node', ['index.js'], {
  cwd: serverDir,
  env: {
    ...process.env,
    HOST: process.env.HOST || '0.0.0.0',
    SERVE_DASHBOARD: process.env.SERVE_DASHBOARD || '1',
  },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', code => {
  process.exit(code ?? 0);
});
