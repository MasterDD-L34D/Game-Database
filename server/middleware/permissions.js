const userContext = require('./user');

function requireRole(...roles) {
  const allowedRoles = userContext.normalizeRoleList(roles);

  return function roleMiddleware(req, res, next) {
    if (!allowedRoles.length || userContext.hasRole(req, ...allowedRoles)) {
      return next();
    }
    return res.sendStatus(403);
  };
}

const TAXONOMY_WRITE_ROLES = userContext.normalizeRoleList(
  process.env.TAXONOMY_WRITE_ROLES || ['taxonomy:write', 'admin']
);

const requireTaxonomyWrite = requireRole(...TAXONOMY_WRITE_ROLES);

module.exports = {
  requireRole,
  requireTaxonomyWrite,
  TAXONOMY_WRITE_ROLES,
  getRoles: userContext.getRoles,
  hasRole: userContext.hasRole,
};
