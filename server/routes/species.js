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
    ? {
        OR: [
          { scientificName: { contains: q, mode: 'insensitive' } },
          { commonName: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};
}

async function fetchPaginatedSpecies(req) {
  const { page, pageSize } = assertPagination(req.query);
  const where = buildWhere(req);
  const [total, items] = await Promise.all([
    prisma.species.count({ where }),
    prisma.species.findMany({ where, skip: page * pageSize, take: pageSize, orderBy: { scientificName: 'asc' } }),
  ]);
  return { items, page, pageSize, total };
}

function normalizeSlug(input) {
  if (!input) return '';
  return input.toString().trim().toLowerCase().replace(/\s+/g, '-');
}

function mapSpeciesData(body, slug, scientificName) {
  return {
    slug,
    scientificName,
    commonName: body.commonName ?? null,
    kingdom: body.kingdom ?? null,
    phylum: body.phylum ?? null,
    class: body.class ?? null,
    order: body.order ?? null,
    family: body.family ?? null,
    genus: body.genus ?? null,
    epithet: body.epithet ?? null,
    status: body.status ?? null,
    description: body.description ?? null,
  };
}

function validateSpeciesPayload(body) {
  const scientificName = assertString(body.scientificName, 'scientificName', { required: true });
  const slug = normalizeSlug(body.slug || body.commonName || scientificName);
  if (!slug) {
    throw new AppError(400, 'VALIDATION_ERROR', 'slug is required', { field: 'slug', location: 'body' });
  }
  return { scientificName, slug };
}

router.get('/', async (req, res) => {
  try {
    const payload = await fetchPaginatedSpecies(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const item = await findExistingByIdOrSlug(prisma.species, id, res, 'Species not found');
    if (!item) return null;
    return res.json(item);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/', requireTaxonomyWrite, async (req, res) => {
  try {
    const validated = validateSpeciesPayload(req.body);
    const existingSlug = await prisma.species.findUnique({ where: { slug: validated.slug } });
    if (existingSlug) return sendError(res, 409, 'CONFLICT', 'Slug already exists', { field: 'slug', value: validated.slug });

    const created = await prisma.species.create({ data: mapSpeciesData(req.body, validated.slug, validated.scientificName) });
    await logAudit(req, 'Species', created.id, 'CREATE', created);

    const payload = await fetchPaginatedSpecies(req);
    return res.status(201).json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.put('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const existing = await findExistingByIdOrSlug(prisma.species, id, res, 'Species not found');
    if (!existing) return null;

    const validated = validateSpeciesPayload(req.body);
    if (validated.slug !== existing.slug) {
      const existingSlug = await prisma.species.findUnique({ where: { slug: validated.slug } });
      if (existingSlug && existingSlug.id !== existing.id) {
        return sendError(res, 409, 'CONFLICT', 'Slug already exists', { field: 'slug', value: validated.slug });
      }
    }

    const updated = await prisma.species.update({
      where: { id: existing.id },
      data: mapSpeciesData(req.body, validated.slug, validated.scientificName),
    });

    await logAudit(req, 'Species', updated.id, 'UPDATE', req.body);

    const payload = await fetchPaginatedSpecies(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.delete('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const existing = await findExistingByIdOrSlug(prisma.species, id, res, 'Species not found');
    if (!existing) return null;

    await prisma.species.delete({ where: { id: existing.id } });
    await logAudit(req, 'Species', existing.id, 'DELETE', existing);

    const payload = await fetchPaginatedSpecies(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
