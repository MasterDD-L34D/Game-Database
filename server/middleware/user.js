/**
 * Normalizes a user value.
 * @param {*} value The value to normalize.
 * @returns {string|null} The normalized user or null.
 */
function normalizeUser(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

/**
 * Parses the roles header into an array.
 * @param {string|string[]} value The header value.
 * @returns {string[]} The array of parsed roles.
 */
function parseRolesHeader(value) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(',') : String(value);
  return raw
    .replace(/\s+/g, ',')
    .split(',')
    .map(role => role.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Gets the roles from a request.
 * @param {Object} req The request object.
 * @returns {string[]} The user roles.
 */
function getRoles(req) {
  if (!req || !Array.isArray(req.userRoles)) return [];
  return req.userRoles;
}

/**
 * Gets the user identifier from a request.
 * @param {Object} req The request object.
 * @returns {string|null} The user identifier or null.
 */
function getIdentifier(req) {
  if (!req) return null;
  const candidate = req.user;
  if (!candidate) return null;
  if (typeof candidate === 'string') return candidate;
  if (typeof candidate === 'object' && candidate.email) return String(candidate.email);
  return null;
}

function normalizeRoleList(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.flatMap(normalizeRoleList);
  const raw = String(input).trim();
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map(role => role.trim().toLowerCase())
    .filter(Boolean);
}

function hasRole(req, ...roles) {
  const allowed = new Set(normalizeRoleList(roles));
  if (!allowed.size) return false;
  return getRoles(req).some(role => allowed.has(role));
}

function isTruthyEnv(value) {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

// Read at request time (not module load) so config toggles + tests take effect
// without re-requiring the module (mirrors permissions.js convention).
function trustClientRoleHeaders() {
  return isTruthyEnv(process.env.TRUST_CLIENT_ROLE_HEADERS);
}

function user(req, res, next) {
  // req.authContext is set ONLY by basicAuth on a successful authentication,
  // so its presence means the request is authenticated by the server.
  const authContext = req.authContext || null;
  const authenticated = authContext != null;

  // Identity (attribution, NOT authorization): a client-supplied X-User is
  // accepted for audit granularity, falling back to the authenticated context.
  // Identity spoofing is not the privilege vector -- roles are.
  const headerUser =
    req.get('x-user') ||
    req.get('x-user-email') ||
    (authContext && authContext.user) ||
    null;
  req.user = normalizeUser(headerUser);

  // Roles (authorization, CWE-290 fix): the trusted source is the server-set
  // authContext. When the request is authenticated, client-supplied X-Roles /
  // X-User-Roles are IGNORED so a caller cannot escalate beyond the roles the
  // server assigned. When NOT authenticated (basicAuth disabled / "open mode"),
  // client role headers are honored only if TRUST_CLIENT_ROLE_HEADERS is
  // explicitly enabled; otherwise no roles are granted (fail-closed), so a
  // misconfigured deployment denies writes instead of trusting spoofable headers.
  let roleSource = null;
  if (authenticated) {
    roleSource = authContext.roles;
  } else if (trustClientRoleHeaders()) {
    roleSource = req.get('x-roles') || req.get('x-user-roles') || null;
  }
  req.userRoles = parseRolesHeader(roleSource);

  next();
}

user.getRoles = getRoles;
user.getIdentifier = getIdentifier;
user.hasRole = hasRole;
user.normalizeRoleList = normalizeRoleList;
user.trustClientRoleHeaders = trustClientRoleHeaders;

module.exports = user;
