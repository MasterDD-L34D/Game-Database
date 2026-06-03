const createApp = require('./app');
const basicAuth = require('./middleware/basicAuth');
const user = require('./middleware/user');

const app = createApp();
const port = process.env.PORT || 3333;
const host = process.env.HOST || '0.0.0.0';

// Fail-safe warning: trusting client role headers without Basic Auth means any
// caller that can reach this host gets write access via X-Roles. Acceptable for
// local dev only; never on an exposed host (default HOST is 0.0.0.0).
if (user.trustClientRoleHeaders() && !basicAuth.isEnabled()) {
  console.warn(
    '[security] TRUST_CLIENT_ROLE_HEADERS is enabled while Basic Auth is OFF: ' +
      'client X-Roles / X-User-Roles headers grant write access without ' +
      'authentication. Use this only for local development, never on an exposed host.',
  );
}

app.listen(port, host, () => console.log(`API server http://${host}:${port}`));
