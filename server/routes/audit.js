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

  // Date range filter (Fase 2 9/N): ?since= and/or ?until= as ISO8601
  // strings WITH EXPLICIT TIMEZONE (e.g. "2026-05-20T10:00:00Z" or
  // "2026-05-20T10:00:00+02:00"). Both bounds optional, combined when
  // present.
  //
  // Codex P1 fix from PR #137 review: the prior implementation accepted
  // tz-naive strings like "2026-05-20T10:00" and parsed them via new
  // Date() which applies the SERVER's local timezone — different from
  // the browser's tz, causing boundary rows to leak/miss. Now we require
  // explicit tz offset and reject naive datetime-local strings to make
  // the wire contract unambiguous. The dashboard converts datetime-local
  // → UTC ISO before sending (see AuditHistoryPanel.toUtcIso).
  const TZ_REGEX = /(Z|[+-]\d{2}:?\d{2})$/;
  function parseDateBound(value, field) {
    const v = String(value ?? '').trim();
    if (!v) {
      throw new AppError(400, 'VALIDATION_ERROR', `${field} must be non-empty`, {
        field,
        location: 'query',
      });
    }
    if (!TZ_REGEX.test(v)) {
      throw new AppError(400, 'VALIDATION_ERROR',
        `${field} must include an explicit timezone offset (e.g. Z or +02:00)`,
        { field, location: 'query', value: v });
    }
    const parsed = new Date(v);
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError(400, 'VALIDATION_ERROR', `${field} must be a valid ISO date`, {
        field, location: 'query', value: v,
      });
    }
    return parsed;
  }
  const createdAtFilter = {};
  if (Object.prototype.hasOwnProperty.call(query, 'since')) {
    createdAtFilter.gte = parseDateBound(query.since, 'since');
  }
  if (Object.prototype.hasOwnProperty.call(query, 'until')) {
    createdAtFilter.lte = parseDateBound(query.until, 'until');
  }
  if (createdAtFilter.gte && createdAtFilter.lte && createdAtFilter.gte > createdAtFilter.lte) {
    throw new AppError(400, 'VALIDATION_ERROR', 'since must be <= until', {
      fields: ['since', 'until'],
      location: 'query',
    });
  }
  if (Object.keys(createdAtFilter).length > 0) {
    where.createdAt = createdAtFilter;
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

    // Check entity doesn't already exist (resurrection conflict on id)
    const existing = await prisma[modelKey].findUnique({ where: { id: projected.id } });
    if (existing) {
      // Phase B (B2) soft-delete: DELETE now sets `deletedAt` instead of
      // removing the row, so the master still exists after a delete. Reverting
      // its DELETE log must clear the tombstone (restore) rather than 409 --
      // otherwise soft-deleted masters are hidden but un-revertable. A LIVE row
      // (deletedAt null/absent -- id reused, or never deleted; Record has no
      // deletedAt) is a genuine conflict and still returns 409.
      if (existing.deletedAt) {
        const restored = await prisma[modelKey].update({
          where: { id: existing.id },
          data: { deletedAt: null },
        });
        await logAudit(req, auditEntry.entity, restored.id, 'UPDATE', {
          restored: true,
          _revertedFrom: logId,
        });
        return res.json({ success: true, id: restored.id, entity: auditEntry.entity, revertedFrom: logId });
      }
      return sendError(res, 409, 'CONFLICT',
        `Entity ${auditEntry.entity}:${projected.id} already exists — nothing to revert`,
        { field: 'id', value: projected.id });
    }

    // Codex P2 fix from PR #130 review: also check non-id @unique columns
    // (slug on Trait/Biome/Species/Ecosystem). If the entity was deleted and
    // another row later claimed the same slug, .create() throws Prisma
    // P2002 which falls through to 500 INTERNAL_ERROR. Pre-check returns
    // a clear 409 CONFLICT instead. Record model has no unique slug.
    if (projected.slug && modelKey !== 'record') {
      const slugCollision = await prisma[modelKey].findUnique({
        where: { slug: projected.slug },
      });
      if (slugCollision) {
        return sendError(res, 409, 'CONFLICT',
          `Slug "${projected.slug}" is now used by another ${auditEntry.entity} (id=${slugCollision.id}) — cannot revert`,
          { field: 'slug', value: projected.slug, conflictingId: slugCollision.id });
      }
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

// Codex/RFC2180 CSV escape helper (mirrors records.js pattern). Quote
// values containing comma, quote, or newline; escape internal quotes by
// doubling.
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function audtCsvFilename(entity, entityId) {
  const slug = [entity, entityId].filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const ts = new Date().toISOString().slice(0, 19).replace(/[:]/g, '');
  return `audit-${slug || 'export'}-${ts}.csv`;
}

router.get('/', requireAuditRead, async (req, res) => {
  try {
    const where = buildAuditWhere(req.query);

    // CSV export branch (Fase 2 11/N): streams ALL rows matching filters
    // (no client pagination) when ?format=csv present. Useful for audit
    // analytics + offline review. Filters (entity/entityId/action/user/
    // since/until) are respected via the same buildAuditWhere.
    //
    // Codex P2 fix from PR #139 review: skip+take offset pagination is
    // UNSTABLE when rows are inserted/deleted mid-export — offsets shift
    // between iterations and rows can be skipped or duplicated. Switch
    // to keyset/cursor pagination on (createdAt DESC, id DESC) so each
    // batch query is filtered to "strictly older than last seen" tuple.
    // Guarantees no skip/dup even if writes happen during the stream.
    const format = typeof req.query.format === 'string' ? req.query.format.toLowerCase() : '';
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${audtCsvFilename(req.query.entity, req.query.entityId)}"`,
      );
      const header = ['id', 'entity', 'entityId', 'action', 'user', 'createdAt', 'payload'];
      res.write(`${header.join(',')}\n`);

      const batchSize = 1000;
      let cursor = null; // { createdAt: Date, id: string } from previous batch's tail
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const cursorWhere = cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }] },
              ],
            }
          : null;
        const effectiveWhere = cursorWhere
          ? (Object.keys(where).length > 0 ? { AND: [where, cursorWhere] } : cursorWhere)
          : where;

        const batch = await prisma.auditLog.findMany({
          where: effectiveWhere,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: batchSize,
        });
        if (!batch.length) break;
        for (const r of batch) {
          const createdAt = r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt || '';
          const payload = r.payload === null || r.payload === undefined ? '' : JSON.stringify(r.payload);
          const row = [r.id, r.entity, r.entityId, r.action, r.user, createdAt, payload];
          res.write(`${row.map(csvEscape).join(',')}\n`);
        }
        const last = batch[batch.length - 1];
        cursor = { createdAt: last.createdAt, id: last.id };
        if (batch.length < batchSize) break; // last partial page → done
        await new Promise((resolve) => setImmediate(resolve));
      }
      return res.end();
    }

    const { page, pageSize } = assertPagination(req.query);
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
