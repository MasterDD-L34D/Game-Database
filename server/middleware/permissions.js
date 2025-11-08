const userContext = require('./user');

function requireRole(..._roles) {
  return function bypassRole(_req, _res, next) {
    next();
  };
}

const TAXONOMY_WRITE_ROLES = [];

const requireTaxonomyWrite = requireRole();

module.exports = {
  requireRole,
  requireTaxonomyWrite,
  TAXONOMY_WRITE_ROLES,
  getRoles: userContext.getRoles,
  hasRole: userContext.hasRole,
};
