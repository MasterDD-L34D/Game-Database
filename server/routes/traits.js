const express = require('express');
const prisma = require('../db/prisma');
const { requireTaxonomyWrite } = require('../middleware/permissions');
const { logAudit } = require('../utils/audit');
const { findExistingByIdOrSlug } = require('../utils/taxonomyValidation');
const { AppError, sendError, handleError } = require('../utils/httpErrors');
const { assertPagination, assertIdParam, assertString, assertEnum } = require('../utils/validation');

const router = express.Router();

const ALLOWED_DATA_TYPES = ['BOOLEAN', 'NUMERIC', 'CATEGORICAL', 'TEXT'];

function buildWhere(req) {
  const q = (req.query.q || '').trim();
  return q
    ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] }
    : {};
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

async function fetchTraitDetail(identifier, res) {
  const item = await findExistingByIdOrSlug(prisma.trait, identifier, res, 'Trait not found');
  if (!item) return null;

  const speciesValues = await prisma.speciesTrait.findMany({
    where: { traitId: item.id },
    orderBy: [{ speciesId: 'asc' }, { category: 'asc' }],
  });

  const speciesIds = [...new Set(speciesValues.map((value) => value.speciesId).filter(Boolean))];
  const species = speciesIds.length
    ? await prisma.species.findMany({
        where: { id: { in: speciesIds } },
        orderBy: { scientificName: 'asc' },
      })
    : [];
  const speciesById = new Map(species.map((entry) => [entry.id, entry]));

  return {
    ...item,
    speciesValues: speciesValues.map((value) => ({
      ...value,
      species: speciesById.get(value.speciesId) ?? null,
    })),
    relationCounts: {
      speciesValues: speciesValues.length,
    },
  };
}

function normalizeSlug(input) {
  if (!input) return '';
  return input.toString().trim().toLowerCase().replace(/\s+/g, '-');
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
    const payload = await fetchPaginatedTraits(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const item = await fetchTraitDetail(id, res);
    if (!item) return null;
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

    await prisma.trait.delete({ where: { id: existing.id } });
    await logAudit(req, 'Trait', existing.id, 'DELETE', existing);

    const payload = await fetchPaginatedTraits(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
