
const express = require('express');
const prisma = require('../db/prisma');
const { requireTaxonomyWrite } = require('../middleware/permissions');
const { logAudit } = require('../utils/audit');
const { findByIdOrSlug, findExistingByIdOrSlug } = require('../utils/taxonomyValidation');
const { liveFilter } = require('../utils/softDelete');
const { AppError, sendError, handleError } = require('../utils/httpErrors');
const { assertPagination, assertIdParam, assertString } = require('../utils/validation');
const { normalizeSlug } = require('../utils/slug');
const router = express.Router();

function buildWhere(req) {
  const q = (req.query.q || '').trim();
  const search = q
    ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] }
    : {};
  return { ...liveFilter(req), ...search };
}

async function fetchPaginatedBiomes(req) {
  const { page, pageSize } = assertPagination(req.query);
  const where = buildWhere(req);
  const [total, items] = await Promise.all([
    prisma.biome.count({ where }),
    prisma.biome.findMany({ where, skip: page * pageSize, take: pageSize, orderBy: { name: 'asc' } }),
  ]);
  return { items, page, pageSize, total };
}

async function resolveParent(parentValue, currentId) {
  if (parentValue === null || parentValue === undefined || parentValue === '') return null;
  const parent = await findByIdOrSlug(prisma.biome, parentValue);
  if (!parent) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid parent biome', {
      field: 'parentId',
      location: 'body',
    });
  }
  if (parent.id === currentId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A biome cannot be its own parent', {
      field: 'parentId',
      location: 'body',
    });
  }
  return parent.id;
}

async function validateBiomePayload(body, existing = null) {
  const name = assertString(body.name, 'name', { required: true });
  const slug = normalizeSlug(body.slug || name);
  if (!slug) {
    throw new AppError(400, 'VALIDATION_ERROR', 'slug is required', { field: 'slug', location: 'body' });
  }

  let parentId = existing?.parentId ?? null;
  if (Object.prototype.hasOwnProperty.call(body, 'parentId')) {
    parentId = await resolveParent(body.parentId, existing?.id ?? null);
  }

  return {
    name,
    slug,
    parentId,
    description: body.description ?? null,
    climate: body.climate ?? null,
  };
}

router.get('/', async (req, res) => {
  try {
    const payload = await fetchPaginatedBiomes(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const item = await findExistingByIdOrSlug(prisma.biome, id, res, 'Biome not found');
    if (!item) return null;
    if (item.deletedAt && req.query.includeDeleted !== 'true') {
      return sendError(res, 404, 'NOT_FOUND', 'Biome not found', { identifier: id });
    }
    return res.json(item);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/', requireTaxonomyWrite, async (req, res) => {
  try {
    assertPagination(req.query);
    const validated = await validateBiomePayload(req.body);
    const { name, slug, parentId, description, climate } = validated;

    const existingSlug = await prisma.biome.findUnique({ where: { slug } });
    if (existingSlug) {
      return sendError(res, 409, 'CONFLICT', 'Slug already exists', { field: 'slug', value: slug });
    }

    const created = await prisma.biome.create({
      data: {
        slug,
        name,
        description,
        climate,
        parentId,
      },
    });

    await logAudit(req, 'Biome', created.id, 'CREATE', created);

    const payload = await fetchPaginatedBiomes(req);
    return res.status(201).json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.put('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    assertPagination(req.query);
    const id = assertIdParam(req.params);
    const existing = await findExistingByIdOrSlug(prisma.biome, id, res, 'Biome not found');
    if (!existing) return null;
    if (existing.deletedAt) {
      return sendError(res, 409, 'DELETED_ENTITY', 'Biome is deleted; restore it before editing', { id: existing.id });
    }

    const validated = await validateBiomePayload(req.body, existing);
    const { name, slug, parentId, description, climate } = validated;

    if (slug !== existing.slug) {
      const existingSlug = await prisma.biome.findUnique({ where: { slug } });
      if (existingSlug && existingSlug.id !== existing.id) {
        return sendError(res, 409, 'CONFLICT', 'Slug already exists', { field: 'slug', value: slug });
      }
    }

    const updated = await prisma.biome.update({
      where: { id: existing.id },
      data: {
        slug,
        name,
        description,
        climate,
        parentId,
      },
    });

    await logAudit(req, 'Biome', updated.id, 'UPDATE', req.body);

    const payload = await fetchPaginatedBiomes(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.delete('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    assertPagination(req.query);
    const id = assertIdParam(req.params);
    const existing = await findExistingByIdOrSlug(prisma.biome, id, res, 'Biome not found');
    if (!existing) return null;
    if (existing.deletedAt) {
      return sendError(res, 409, 'ALREADY_DELETED', 'Biome is already deleted', { id: existing.id });
    }

    const deleted = await prisma.biome.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });

    await logAudit(req, 'Biome', existing.id, 'DELETE', existing);

    return res.json({ success: true, id: deleted.id });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:id/restore', requireTaxonomyWrite, async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const existing = await findExistingByIdOrSlug(prisma.biome, id, res, 'Biome not found');
    if (!existing) return null;
    if (!existing.deletedAt) {
      return sendError(res, 409, 'NOT_DELETED', 'Biome is not deleted', { id: existing.id });
    }

    const restored = await prisma.biome.update({ where: { id: existing.id }, data: { deletedAt: null } });
    await logAudit(req, 'Biome', existing.id, 'UPDATE', { restored: true });

    return res.json({ success: true, id: restored.id });
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
