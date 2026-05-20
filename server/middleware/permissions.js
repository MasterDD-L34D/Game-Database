const { sendError } = require('../utils/httpErrors');
const userContext = require('./user');

function requireRole(...roles) {
  const allowedRoles = userContext.normalizeRoleList(roles);

  return function roleMiddleware(req, res, next) {
    if (!allowedRoles.length || userContext.hasRole(req, ...allowedRoles)) {
      return next();
    }
    return sendError(res, 403, 'FORBIDDEN', 'Insufficient permissions');
  };
}

const TAXONOMY_WRITE_ROLES = userContext.normalizeRoleList(
  process.env.TAXONOMY_WRITE_ROLES || ['taxonomy:write', 'admin']
);

const requireTaxonomyWrite = requireRole(...TAXONOMY_WRITE_ROLES);

// Per PR-δ Q2 resolved: default open (unset → no gating, mirrors all 10
// existing GET routes). Setting AUDIT_READ_ROLES env switches to gated mode.
// Read at request time (not module load) for test-friendliness.
// Future POST /api/audit/:logId/revert (Fase 2) will gate explicitly with
// requireTaxonomyWrite (mutation, NOT this audit:read).
function currentAuditReadRoles() {
  if (!process.env.AUDIT_READ_ROLES) return [];
  return userContext.normalizeRoleList(process.env.AUDIT_READ_ROLES);
}

function requireAuditRead(req, res, next) {
  const roles = currentAuditReadRoles();
  if (roles.length === 0) return next();
  if (userContext.hasRole(req, ...roles)) return next();
  return sendError(res, 403, 'FORBIDDEN', 'Insufficient permissions');
}

module.exports = {
  requireRole,
  requireTaxonomyWrite,
  requireAuditRead,
  currentAuditReadRoles,
  TAXONOMY_WRITE_ROLES,
  getRoles: userContext.getRoles,
  hasRole: userContext.hasRole,
};
