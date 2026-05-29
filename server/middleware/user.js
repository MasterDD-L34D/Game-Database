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

function user(req, res, next) {
  const authContext = req.authContext || {};
  const headerUser = req.get('x-user') || req.get('x-user-email') || authContext.user || null;
  const headerRoles = req.get('x-roles') || req.get('x-user-roles') || authContext.roles || null;
  req.user = normalizeUser(headerUser);
  req.userRoles = parseRolesHeader(headerRoles);
  next();
}

user.getRoles = getRoles;
user.getIdentifier = getIdentifier;
user.hasRole = hasRole;
user.normalizeRoleList = normalizeRoleList;

module.exports = user;
