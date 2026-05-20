const express = require('express');
const prisma = require('../db/prisma');
const { requireAuditRead, requireTaxonomyWrite } = require('../middleware/permissions');
const { logAudit } = require('../utils/audit');
const { AppError, sendError, handleError } = require('../utils/httpErrors');
const { assertPagination, assertIdParam } = require('../utils/validation');

const router = express.Router();

const ALLOWED_ACTIONS = new Set(['CREATE', 'UPDATE', 'DELETE']);

// Map AuditLog.entity string → Prisma model accessor key.
// Per spec PR-δ + Fase 2 revert: only master entities (5) are revertable
// in v1. Junctions (SpeciesTrait, SpeciesBiome, EcosystemBiome,
// EcosystemSpecies) are not tracked by logAudit and are out of scope.
const REVERTABLE_ENTITY_MODELS = {
  Trait: 'trait',
  Biome: 'biome',
  Species: 'species',
  Ecosystem: 'ecosystem',
  Record: 'record',
};

// Per-entity scalar field whitelist for revert payload projection.
// Prisma .create() rejects unknown keys, and AuditLog.payload may contain
// nested relations or computed fields that must be stripped before
// resurrection. Keys here mirror server/prisma/schema.prisma scalar
// columns (sans relation accessors and timestamps).
const REVERTABLE_FIELDS = {
  trait: [
    'id', 'slug', 'name', 'description', 'category', 'unit', 'dataType',
    'allowedValues', 'rangeMin', 'rangeMax', 'tier', 'familyType',
    'energyMaintenance', 'slotProfile', 'usageTags', 'synergies',
    'conflicts', 'environmentalRequirements', 'inducedMutation',
    'functionalUse', 'selectiveDrive', 'weakness',
  ],
  biome: [
    'id', 'slug', 'name', 'description', 'climate', 'parentId', 'summary',
    'climateTags', 'hazard', 'ecology', 'roleTemplates', 'sizeMin', 'sizeMax',
  ],
  species: [
    'id', 'slug', 'scientificName', 'commonName', 'kingdom', 'phylum',
    'class', 'order', 'family', 'genus', 'epithet', 'status', 'description',
    'displayName', 'trophicRole', 'functionalTags', 'flags', 'balance',
    'playableUnit', 'morphotype', 'vcCoefficients', 'spawnRules',
    'environmentAffinity', 'jobsBias', 'telemetry',
  ],
  ecosystem: [
    'id', 'slug', 'name', 'description', 'region', 'climate',
  ],
  record: [
    'id', 'nome', 'stato', 'descrizione', 'data', 'stile', 'pattern',
    'peso', 'curvatura', 'createdBy', 'updatedBy',
  ],
};

function projectPayloadForRevert(modelKey, payload) {
  if (!payload || typeof payload !== 'object') return null;
  const fields = REVERTABLE_FIELDS[modelKey];
  if (!fields) return null;
  const out = {};
  for (const key of fields) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      out[key] = payload[key];
    }
  }
  return out;
}

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

// POST /api/audit/:logId/revert — resurrect tombstoned entity from a DELETE
// audit log. Per spec Fase 2 + Q2-resolved: gated by requireTaxonomyWrite
// (mutation), restricted to action='DELETE' entries on master entities.
// UPDATE-revert deferred (requires prior-state reconstruction).
router.post('/:logId/revert', requireTaxonomyWrite, async (req, res) => {
  try {
    const logId = assertIdParam(req.params, 'logId');

    const auditEntry = await prisma.auditLog.findUnique({ where: { id: logId } });
    if (!auditEntry) {
      return sendError(res, 404, 'NOT_FOUND', 'Audit log not found', { identifier: logId });
    }

    if (auditEntry.action !== 'DELETE') {
      return sendError(res, 400, 'NOT_REVERTABLE',
        `Only DELETE actions can be reverted in v1 (got ${auditEntry.action})`,
        { field: 'action', value: auditEntry.action });
    }

    const modelKey = REVERTABLE_ENTITY_MODELS[auditEntry.entity];
    if (!modelKey) {
      return sendError(res, 400, 'NOT_REVERTABLE',
        `Entity ${auditEntry.entity} is not revertable (master entities only)`,
        { field: 'entity', value: auditEntry.entity });
    }

    const projected = projectPayloadForRevert(modelKey, auditEntry.payload);
    if (!projected || !projected.id) {
      return sendError(res, 400, 'NOT_REVERTABLE',
        'Audit payload missing or has no id field — cannot reconstruct entity',
        { field: 'payload', logId });
    }

    // Check entity doesn't already exist (resurrection conflict)
    const existing = await prisma[modelKey].findUnique({ where: { id: projected.id } });
    if (existing) {
      return sendError(res, 409, 'CONFLICT',
        `Entity ${auditEntry.entity}:${projected.id} already exists — nothing to revert`,
        { field: 'id', value: projected.id });
    }

    const recreated = await prisma[modelKey].create({ data: projected });

    // Log the revert action itself for traceability
    await logAudit(req, auditEntry.entity, recreated.id, 'CREATE', {
      ...recreated,
      _revertedFrom: logId,
    });

    return res.json({ success: true, id: recreated.id, entity: auditEntry.entity, revertedFrom: logId });
  } catch (error) {
    return handleError(res, error);
  }
});

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
