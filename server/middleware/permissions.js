const userContext = require('./user');

function createRoleMiddleware(roles) {
  const allowed = new Set(userContext.normalizeRoleList(roles));
  return function requireRole(req, res, next) {
    if (!allowed.size) return next();
    const userRoles = userContext.getRoles(req);
    if (userRoles.some(role => allowed.has(role))) return next();
    return res.status(403).json({ error: 'Forbidden: insufficient role' });
  };
}

function requireRole(...roles) {
  return createRoleMiddleware(roles);
}

const TAXONOMY_WRITE_ROLES = ['admin', 'taxonomy:manage', 'taxonomy:write'];

const requireTaxonomyWrite = createRoleMiddleware(TAXONOMY_WRITE_ROLES);

module.exports = {
  requireRole,
  requireTaxonomyWrite,
  TAXONOMY_WRITE_ROLES,
  getRoles: userContext.getRoles,
  hasRole: userContext.hasRole,
};
