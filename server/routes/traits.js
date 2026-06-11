const express = require('express');
const prisma = require('../db/prisma');
const { requireTaxonomyWrite } = require('../middleware/permissions');
const { logAudit } = require('../utils/audit');
const { findExistingByIdOrSlug } = require('../utils/taxonomyValidation');
const { liveFilter } = require('../utils/softDelete');
const { AppError, sendError, handleError } = require('../utils/httpErrors');
const { assertPagination, assertIdParam, assertString, assertEnum } = require('../utils/validation');
const { normalizeSlug } = require('../utils/slug');
const { resolveReleasedVersion, traitVersionToTrait } = require('../utils/versionRead');

const router = express.Router();

const ALLOWED_DATA_TYPES = ['BOOLEAN', 'NUMERIC', 'CATEGORICAL', 'TEXT'];

const GAME_INVALIDATE_URL = process.env.GAME_INVALIDATE_URL || '';
const GAME_INVALIDATE_TOKEN = process.env.GAME_INVALIDATE_TOKEN || '';

function notifyGameCacheInvalidation() {
  if (!GAME_INVALIDATE_URL) return;
  const headers = { 'Content-Type': 'application/json' };
  if (GAME_INVALIDATE_TOKEN) headers.Authorization = `Bearer ${GAME_INVALIDATE_TOKEN}`;
  fetch(GAME_INVALIDATE_URL, { method: 'POST', headers, signal: AbortSignal.timeout(5000) })
    .catch((err) => console.warn('[game-invalidate] fire-and-forget failed:', err.message));
}

function buildWhere(req) {
  const q = (req.query.q || '').trim();
  const search = q
    ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] }
    : {};
  return { ...liveFilter(req), ...search };
}

async function fetchPaginatedTraits(req) {
  const { page, pageSize } = assertPagination(req.query);
  const where = buildWhere(req);
  const [total, items] = await Promise.all([
    prisma.trait.count({ where }),
    prisma.trait.findMany({ where, skip: page * pageSize, take: pageSize, orderBy: { name: 'asc' } }),
  ]);
  return { items, page, pageSize, total };
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

function validateTraitPayload(body) {
  const name = assertString(body.name, 'name', { required: true });
  const dataType = assertEnum(body.dataType, ALLOWED_DATA_TYPES, 'dataType', { required: true });

  const slug = normalizeSlug(body.slug || name);
  if (!slug) {
    throw new AppError(400, 'VALIDATION_ERROR', 'slug is required', { field: 'slug', location: 'body' });
  }

  let allowedValues = null;
  if (body.allowedValues !== undefined) {
    if (!Array.isArray(body.allowedValues) || body.allowedValues.some(v => typeof v !== 'string')) {
      throw new AppError(400, 'VALIDATION_ERROR', 'allowedValues must be an array of strings', { field: 'allowedValues', location: 'body' });
    }
    allowedValues = body.allowedValues;
  }

  if (dataType === 'CATEGORICAL') {
    if (!allowedValues || allowedValues.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'allowedValues is required for categorical traits', { field: 'allowedValues', location: 'body' });
    }
  } else if (allowedValues) {
    throw new AppError(400, 'VALIDATION_ERROR', 'allowedValues is only allowed for categorical traits', { field: 'allowedValues', location: 'body' });
  }

  const rangeMin = toNumber(body.rangeMin);
  const rangeMax = toNumber(body.rangeMax);

  if (dataType === 'NUMERIC') {
    if (Number.isNaN(rangeMin) || Number.isNaN(rangeMax)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'rangeMin and rangeMax must be numeric', { field: 'rangeMin,rangeMax', location: 'body' });
    }
    if (rangeMin !== null && rangeMax !== null && rangeMin > rangeMax) {
      throw new AppError(400, 'VALIDATION_ERROR', 'rangeMin cannot be greater than rangeMax', { field: 'rangeMin,rangeMax', location: 'body' });
    }
  } else if (rangeMin !== null || rangeMax !== null) {
    throw new AppError(400, 'VALIDATION_ERROR', 'rangeMin and rangeMax are only allowed for numeric traits', { field: 'rangeMin,rangeMax', location: 'body' });
  }

  return {
    slug,
    name,
    dataType,
    allowedValues,
    rangeMin: rangeMin === null ? null : rangeMin,
    rangeMax: rangeMax === null ? null : rangeMax,
  };
}

router.get('/', async (req, res) => {
  try {
    const versionId = (req.query.versionId || '').trim();
    if (versionId) {
      const version = await resolveReleasedVersion(versionId);
      const { page, pageSize } = assertPagination(req.query);
      const q = (req.query.q || '').trim();
      const where = {
        versionId: version.id,
        ...(q ? { OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
        ] } : {}),
      };
      const [total, rows] = await Promise.all([
        prisma.traitVersion.count({ where }),
        prisma.traitVersion.findMany({ where, skip: page * pageSize, take: pageSize, orderBy: { name: 'asc' } }),
      ]);
      return res.json({ items: rows.map(traitVersionToTrait), page, pageSize, total, _version: version.tag });
    }
    const payload = await fetchPaginatedTraits(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/glossary', async (req, res) => {
  try {
    const versionId = (req.query.versionId || '').trim();
    if (versionId) {
      const version = await resolveReleasedVersion(versionId);
      const rows = await prisma.traitVersion.findMany({
        where: { versionId: version.id },
        select: { slug: true, name: true, description: true, nameEn: true, descriptionEn: true },
        orderBy: { name: 'asc' },
      });
      const traits = rows.map((t) => ({
        _id: t.slug,
        labels: { it: t.name, en: t.nameEn || t.name },
        descriptions: { it: t.description || null, en: t.descriptionEn || t.description || null },
      }));
      return res.json({ traits });
    }
    const allTraits = await prisma.trait.findMany({
      where: { deletedAt: null },
      select: { slug: true, name: true, description: true, nameEn: true, descriptionEn: true },
      orderBy: { name: 'asc' },
    });
    const traits = allTraits.map((t) => ({
      _id: t.slug,
      labels: { it: t.name, en: t.nameEn || t.name },
      descriptions: { it: t.description || null, en: t.descriptionEn || t.description || null },
    }));
    return res.json({ traits });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const item = await findExistingByIdOrSlug(prisma.trait, id, res, 'Trait not found');
    if (!item) return null;
    if (item.deletedAt && req.query.includeDeleted !== 'true') {
      return sendError(res, 404, 'NOT_FOUND', 'Trait not found', { identifier: id });
    }
    return res.json(item);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/', requireTaxonomyWrite, async (req, res) => {
  try {
    const validated = validateTraitPayload(req.body);
    const existingSlug = await prisma.trait.findUnique({ where: { slug: validated.slug } });
    if (existingSlug) return sendError(res, 409, 'CONFLICT', 'Slug already exists', { field: 'slug', value: validated.slug });

    const created = await prisma.trait.create({
      data: {
        ...validated,
        description: req.body.description ?? null,
        category: req.body.category ?? null,
        unit: req.body.unit ?? null,
      },
    });

    await logAudit(req, 'Trait', created.id, 'CREATE', created);
    notifyGameCacheInvalidation();
    const payload = await fetchPaginatedTraits(req);
    return res.status(201).json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.put('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const existing = await findExistingByIdOrSlug(prisma.trait, id, res, 'Trait not found');
    if (!existing) return null;
    if (existing.deletedAt) {
      return sendError(res, 409, 'DELETED_ENTITY', 'Trait is deleted; restore it before editing', { id: existing.id });
    }

    const validated = validateTraitPayload(req.body);
    if (validated.slug !== existing.slug) {
      const existingSlug = await prisma.trait.findUnique({ where: { slug: validated.slug } });
      if (existingSlug && existingSlug.id !== existing.id) {
        return sendError(res, 409, 'CONFLICT', 'Slug already exists', { field: 'slug', value: validated.slug });
      }
    }

    const updated = await prisma.trait.update({
      where: { id: existing.id },
      data: {
        ...validated,
        description: req.body.description ?? null,
        category: req.body.category ?? null,
        unit: req.body.unit ?? null,
      },
    });

    await logAudit(req, 'Trait', updated.id, 'UPDATE', req.body);
    notifyGameCacheInvalidation();
    const payload = await fetchPaginatedTraits(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.delete('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const existing = await findExistingByIdOrSlug(prisma.trait, id, res, 'Trait not found');
    if (!existing) return null;
    if (existing.deletedAt) {
      return sendError(res, 409, 'ALREADY_DELETED', 'Trait is already deleted', { id: existing.id });
    }

    const deleted = await prisma.trait.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await logAudit(req, 'Trait', existing.id, 'DELETE', existing);
    notifyGameCacheInvalidation();

    return res.json({ success: true, id: deleted.id });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/restore', requireTaxonomyWrite, async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const existing = await findExistingByIdOrSlug(prisma.trait, id, res, 'Trait not found');
    if (!existing) return null;
    if (!existing.deletedAt) {
      return sendError(res, 409, 'NOT_DELETED', 'Trait is not deleted', { id: existing.id });
    }

    const restored = await prisma.trait.update({ where: { id: existing.id }, data: { deletedAt: null } });
    await logAudit(req, 'Trait', existing.id, 'UPDATE', { restored: true });
    notifyGameCacheInvalidation();

    return res.json({ success: true, id: restored.id });
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
