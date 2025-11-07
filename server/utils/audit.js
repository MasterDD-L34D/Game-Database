const prisma = require('../db/prisma');
const userContext = require('../middleware/user');

function resolveUser(req) {
  if (!req) return null;
  return userContext.getIdentifier(req);
}

async function logAudit(req, entity, entityId, action, payload) {
  return prisma.auditLog.create({
    data: {
      entity,
      entityId,
      action,
      user: resolveUser(req),
      payload,
    },
  });
}

module.exports = { logAudit };
