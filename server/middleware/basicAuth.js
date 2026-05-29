const crypto = require('node:crypto');

/**
 * Safely compares two strings to prevent timing attacks.
 * @param {string} a The first string.
 * @param {string} b The second string.
 * @returns {boolean} True if strings are equal, false otherwise.
 */
function timingSafeEqualString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const aHash = crypto.createHash('sha256').update(a).digest();
  const bHash = crypto.createHash('sha256').update(b).digest();

  return crypto.timingSafeEqual(aHash, bHash);
}

/**
 * Parses a Basic Authentication header value.
 * @param {string} headerValue The raw Authorization header string.
 * @returns {{username: string, password: string}|null} The parsed credentials or null if invalid.
 */
function parseBasicAuthHeader(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const [scheme, token] = headerValue.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'basic') return null;

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex < 0) return null;
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch (error) {
    return null;
  }
}

function isBasicAuthEnabled() {
  return Boolean(process.env.APP_AUTH_USER && process.env.APP_AUTH_PASSWORD);
}

function getConfiguredRoles() {
  const raw = process.env.APP_AUTH_ROLES || 'taxonomy:write,admin';
  return String(raw)
    .split(/[\s,]+/)
    .map(role => role.trim().toLowerCase())
    .filter(Boolean);
}

function basicAuth(req, res, next) {
  if (!isBasicAuthEnabled()) {
    return next();
  }

  const credentials = parseBasicAuthHeader(req.get('authorization'));
  const expectedUser = process.env.APP_AUTH_USER;
  const expectedPassword = process.env.APP_AUTH_PASSWORD;

  if (
    credentials &&
    timingSafeEqualString(credentials.username, expectedUser) &&
    timingSafeEqualString(credentials.password, expectedPassword)
  ) {
    req.authContext = {
      user: credentials.username,
      roles: getConfiguredRoles(),
    };
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="Game Dashboard"');
  return res.status(401).json({ error: 'Authentication required' });
}

basicAuth.isEnabled = isBasicAuthEnabled;
basicAuth.getConfiguredRoles = getConfiguredRoles;

module.exports = basicAuth;
