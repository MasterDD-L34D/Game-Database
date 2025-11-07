
const express = require('express');
const prisma = require('../db/prisma');
const { requireTaxonomyWrite } = require('../middleware/permissions');
const { logAudit } = require('../utils/audit');
const router = express.Router();

const ALLOWED_DATA_TYPES = new Set(['BOOLEAN', 'NUMERIC', 'CATEGORICAL', 'TEXT']);

function parsePagination(req) {
  const page = Math.max(parseInt(req.query.page || '0', 10), 0);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '25', 10), 1), 100);
  return { page, pageSize };
}

function buildWhere(req) {
  const q = (req.query.q || '').trim();
  return q
    ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] }
    : {};
}

async function fetchPaginatedTraits(req) {
  const { page, pageSize } = parsePagination(req);
  const where = buildWhere(req);
  const [total, items] = await Promise.all([
    prisma.trait.count({ where }),
    prisma.trait.findMany({ where, skip: page * pageSize, take: pageSize, orderBy: { name: 'asc' } }),
  ]);
  return { items, page, pageSize, total };
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

router.get('/', async (req, res) => {
  const payload = await fetchPaginatedTraits(req);
  res.json(payload);
});

router.get('/:id', async (req, res) => {
  const item = await prisma.trait.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }] } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.post('/', requireTaxonomyWrite, async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const dataType = req.body.dataType;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!ALLOWED_DATA_TYPES.has(dataType)) return res.status(400).json({ error: 'Invalid dataType' });

    const slug = normalizeSlug(req.body.slug || name);
    if (!slug) return res.status(400).json({ error: 'Slug is required' });
    const existingSlug = await prisma.trait.findUnique({ where: { slug } });
    if (existingSlug) return res.status(409).json({ error: 'Slug already exists' });

    let allowedValues = null;
    if (req.body.allowedValues !== undefined) {
      if (!Array.isArray(req.body.allowedValues) || req.body.allowedValues.some(v => typeof v !== 'string')) {
        return res.status(400).json({ error: 'allowedValues must be an array of strings' });
      }
      allowedValues = req.body.allowedValues;
    }
    if (dataType === 'CATEGORICAL') {
      if (!allowedValues || allowedValues.length === 0) {
        return res.status(400).json({ error: 'allowedValues is required for categorical traits' });
      }
    } else if (allowedValues) {
      return res.status(400).json({ error: 'allowedValues is only allowed for categorical traits' });
    }

    const rangeMin = toNumber(req.body.rangeMin);
    const rangeMax = toNumber(req.body.rangeMax);
    if (dataType === 'NUMERIC') {
      if (Number.isNaN(rangeMin) || Number.isNaN(rangeMax)) {
        return res.status(400).json({ error: 'rangeMin and rangeMax must be numeric' });
      }
      if (rangeMin !== null && rangeMax !== null && rangeMin > rangeMax) {
        return res.status(400).json({ error: 'rangeMin cannot be greater than rangeMax' });
      }
    } else if (rangeMin !== null || rangeMax !== null) {
      return res.status(400).json({ error: 'rangeMin and rangeMax are only allowed for numeric traits' });
    }

    const created = await prisma.trait.create({
      data: {
        slug,
        name,
        description: req.body.description ?? null,
        category: req.body.category ?? null,
        unit: req.body.unit ?? null,
        dataType,
        allowedValues,
        rangeMin: rangeMin === null ? null : rangeMin,
        rangeMax: rangeMax === null ? null : rangeMax,
      },
    });

    await logAudit(req, 'Trait', created.id, 'CREATE', created);

    const payload = await fetchPaginatedTraits(req);
    res.status(201).json(payload);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Validation failed or bad input' });
  }
});

router.put('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const existing = await prisma.trait.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }] } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const name = (req.body.name || '').trim();
    const dataType = req.body.dataType;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!ALLOWED_DATA_TYPES.has(dataType)) return res.status(400).json({ error: 'Invalid dataType' });

    const slug = normalizeSlug(req.body.slug || name);
    if (!slug) return res.status(400).json({ error: 'Slug is required' });
    if (slug !== existing.slug) {
      const existingSlug = await prisma.trait.findUnique({ where: { slug } });
      if (existingSlug && existingSlug.id !== existing.id) {
        return res.status(409).json({ error: 'Slug already exists' });
      }
    }

    let allowedValues = null;
    if (req.body.allowedValues !== undefined) {
      if (!Array.isArray(req.body.allowedValues) || req.body.allowedValues.some(v => typeof v !== 'string')) {
        return res.status(400).json({ error: 'allowedValues must be an array of strings' });
      }
      allowedValues = req.body.allowedValues;
    }
    if (dataType === 'CATEGORICAL') {
      if (!allowedValues || allowedValues.length === 0) {
        return res.status(400).json({ error: 'allowedValues is required for categorical traits' });
      }
    } else if (allowedValues) {
      return res.status(400).json({ error: 'allowedValues is only allowed for categorical traits' });
    }

    const rangeMin = toNumber(req.body.rangeMin);
    const rangeMax = toNumber(req.body.rangeMax);
    if (dataType === 'NUMERIC') {
      if (Number.isNaN(rangeMin) || Number.isNaN(rangeMax)) {
        return res.status(400).json({ error: 'rangeMin and rangeMax must be numeric' });
      }
      if (rangeMin !== null && rangeMax !== null && rangeMin > rangeMax) {
        return res.status(400).json({ error: 'rangeMin cannot be greater than rangeMax' });
      }
    } else if (rangeMin !== null || rangeMax !== null) {
      return res.status(400).json({ error: 'rangeMin and rangeMax are only allowed for numeric traits' });
    }

    const updated = await prisma.trait.update({
      where: { id: existing.id },
      data: {
        slug,
        name,
        description: req.body.description ?? null,
        category: req.body.category ?? null,
        unit: req.body.unit ?? null,
        dataType,
        allowedValues,
        rangeMin: rangeMin === null ? null : rangeMin,
        rangeMax: rangeMax === null ? null : rangeMax,
      },
    });

    await logAudit(req, 'Trait', updated.id, 'UPDATE', req.body);

    const payload = await fetchPaginatedTraits(req);
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Validation failed or bad input' });
  }
});

router.delete('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const existing = await prisma.trait.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }] } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.trait.delete({ where: { id: existing.id } });

    await logAudit(req, 'Trait', existing.id, 'DELETE', existing);

    const payload = await fetchPaginatedTraits(req);
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
