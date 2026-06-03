const prisma = require('../db/prisma');
const userContext = require('../middleware/user');

/**
 * Resolves the user identifier from the request object.
 *
 * @param {Object} req The request object.
 * @returns {string|null} The user identifier or null if no request.
 */
function resolveUser(req) {
  if (!req) return null;
  return userContext.getIdentifier(req);
}

/**
 * Logs an audit event to the database.
 *
 * @param {Object} req The request object.
 * @param {string} entity The entity name.
 * @param {string} entityId The entity ID.
 * @param {string} action The action performed.
 * @param {Object} payload The payload data.
 * @returns {Promise<Object>} The created audit log record.
 */
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
