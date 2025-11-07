function normalizeUser(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function parseRolesHeader(value) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(',') : String(value);
  return raw
    .replace(/\s+/g, ',')
    .split(',')
    .map(role => role.trim().toLowerCase())
    .filter(Boolean);
}

function getRoles(req) {
  if (!req || !Array.isArray(req.userRoles)) return [];
  return req.userRoles;
}

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
  const normalized = String(input).trim().toLowerCase();
  return normalized ? [normalized] : [];
}

function hasRole(req, ...roles) {
  const allowed = new Set(normalizeRoleList(roles));
  if (!allowed.size) return false;
  return getRoles(req).some(role => allowed.has(role));
}

function user(req, res, next) {
  const headerUser = req.get('x-user') || req.get('x-user-email') || null;
  req.user = normalizeUser(headerUser);
  req.userRoles = parseRolesHeader(req.get('x-roles') || req.get('x-user-roles'));
  next();
}

user.getRoles = getRoles;
user.getIdentifier = getIdentifier;
user.hasRole = hasRole;
user.normalizeRoleList = normalizeRoleList;

module.exports = user;
