
const express = require('express');
const prisma = require('../db/prisma');
const { requireTaxonomyWrite } = require('../middleware/permissions');
const { logAudit } = require('../utils/audit');
const { findExistingByIdOrSlug } = require('../utils/taxonomyValidation');
const { AppError, sendError, handleError } = require('../utils/httpErrors');
const { assertPagination, assertIdParam, assertString } = require('../utils/validation');
const router = express.Router();

function buildWhere(req) {
  const q = (req.query.q || '').trim();
  return q
    ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] }
    : {};
}

async function fetchPaginatedEcosystems(req) {
  const { page, pageSize } = assertPagination(req.query);
  const where = buildWhere(req);
  const [total, items] = await Promise.all([
    prisma.ecosystem.count({ where }),
    prisma.ecosystem.findMany({ where, skip: page * pageSize, take: pageSize, orderBy: { name: 'asc' } }),
  ]);
  return { items, page, pageSize, total };
}

function normalizeSlug(input) {
  if (!input) return '';
  return input.toString().trim().toLowerCase().replace(/\s+/g, '-');
}

function validateEcosystemPayload(body) {
  const name = assertString(body.name, 'name', { required: true });
  const slug = normalizeSlug(body.slug || name);
  if (!slug) {
    throw new AppError(400, 'VALIDATION_ERROR', 'slug is required', { field: 'slug', location: 'body' });
  }
  return {
    name,
    slug,
    description: body.description ?? null,
    region: body.region ?? null,
    climate: body.climate ?? null,
  };
}

function mapEcosystemData(validated) {
  return {
    slug: validated.slug,
    name: validated.name,
    description: validated.description,
    region: validated.region,
    climate: validated.climate,
  };
}

router.get('/', async (req, res) => {
  try {
    const payload = await fetchPaginatedEcosystems(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const item = await findExistingByIdOrSlug(prisma.ecosystem, id, res, 'Ecosystem not found');
    if (!item) return null;
    return res.json(item);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/', requireTaxonomyWrite, async (req, res) => {
  try {
    assertPagination(req.query);
    const validated = validateEcosystemPayload(req.body);
    const { slug } = validated;

    const existingSlug = await prisma.ecosystem.findUnique({ where: { slug } });
    if (existingSlug) {
      return sendError(res, 409, 'CONFLICT', 'Slug already exists', { field: 'slug', value: slug });
    }

    const created = await prisma.ecosystem.create({ data: mapEcosystemData(validated) });

    await logAudit(req, 'Ecosystem', created.id, 'CREATE', created);

    const payload = await fetchPaginatedEcosystems(req);
    return res.status(201).json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.put('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    assertPagination(req.query);
    const id = assertIdParam(req.params);
    const existing = await findExistingByIdOrSlug(prisma.ecosystem, id, res, 'Ecosystem not found');
    if (!existing) return null;

    const validated = validateEcosystemPayload(req.body);
    const { slug } = validated;

    if (slug !== existing.slug) {
      const existingSlug = await prisma.ecosystem.findUnique({ where: { slug } });
      if (existingSlug && existingSlug.id !== existing.id) {
        return sendError(res, 409, 'CONFLICT', 'Slug already exists', { field: 'slug', value: slug });
      }
    }

    const updated = await prisma.ecosystem.update({
      where: { id: existing.id },
      data: mapEcosystemData(validated),
    });

    await logAudit(req, 'Ecosystem', updated.id, 'UPDATE', req.body);

    const payload = await fetchPaginatedEcosystems(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.delete('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    assertPagination(req.query);
    const id = assertIdParam(req.params);
    const existing = await findExistingByIdOrSlug(prisma.ecosystem, id, res, 'Ecosystem not found');
    if (!existing) return null;

    await prisma.ecosystem.delete({ where: { id: existing.id } });

    await logAudit(req, 'Ecosystem', existing.id, 'DELETE', existing);

    const payload = await fetchPaginatedEcosystems(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
