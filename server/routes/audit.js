const express = require('express');
const prisma = require('../db/prisma');
const { requireAuditRead } = require('../middleware/permissions');
const { AppError, handleError } = require('../utils/httpErrors');
const { assertPagination } = require('../utils/validation');

const router = express.Router();

const ALLOWED_ACTIONS = new Set(['CREATE', 'UPDATE', 'DELETE']);

function buildAuditWhere(query) {
  const where = {};
  // Codex P2 fix from PR #122 review: presence-based check `if (query.entity)`
  // skipped validation for empty-string filter (`?entity=`), so the route
  // treated explicit-empty as no-filter and returned unfiltered rows
  // instead of 400. Now distinguish "key present" via hasOwnProperty.
  if (Object.prototype.hasOwnProperty.call(query, 'entity')) {
    const entity = String(query.entity ?? '').trim();
    if (!entity) {
      throw new AppError(400, 'VALIDATION_ERROR', 'entity must be non-empty', {
        field: 'entity',
        location: 'query',
      });
    }
    where.entity = entity;
  }
  if (Object.prototype.hasOwnProperty.call(query, 'entityId')) {
    const entityId = String(query.entityId ?? '').trim();
    if (!entityId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'entityId must be non-empty', {
        field: 'entityId',
        location: 'query',
      });
    }
    where.entityId = entityId;
  }
  if (Object.prototype.hasOwnProperty.call(query, 'action')) {
    const action = String(query.action ?? '').trim().toUpperCase();
    if (!ALLOWED_ACTIONS.has(action)) {
      throw new AppError(400, 'VALIDATION_ERROR', `action must be one of ${[...ALLOWED_ACTIONS].join(', ')}`, {
        field: 'action',
        location: 'query',
      });
    }
    where.action = action;
  }
  if (query.user) {
    const user = String(query.user).trim();
    if (user) where.user = user;
  }
  return where;
}

router.get('/', requireAuditRead, async (req, res) => {
  try {
    const { page, pageSize } = assertPagination(req.query);
    const where = buildAuditWhere(req.query);

    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip: page * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return res.json({ items, page, pageSize, total });
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
