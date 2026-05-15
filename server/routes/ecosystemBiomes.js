const express = require('express');
const prisma = require('../db/prisma');
const { requireTaxonomyWrite } = require('../middleware/permissions');
const { AppError } = require('../utils/httpErrors');
const { assertPagination, normalizeId } = require('../utils/validation');
const { normalizeSearchQuery, normalizeSort, toPagedResult } = require('../utils/pagination');

const router = express.Router();

function normalizeProportion(value) {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === '') return { ok: true, value: null };
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return { ok: false, error: 'proportion must be a number' };
  }
  return { ok: true, value: numberValue };
}

function collectWritableFields(body) {
  const data = {};
  if ('proportion' in body) {
    const result = normalizeProportion(body.proportion);
    if (!result.ok) return { error: result.error };
    if (result.value !== undefined) data.proportion = result.value;
  }
  if ('notes' in body) data.notes = body.notes ?? null;
  return { data };
}

function buildFilter(query = {}) {
  const where = {};
  if (query.ecosystemId) where.ecosystemId = String(query.ecosystemId);
  if (query.biomeId) where.biomeId = String(query.biomeId);
  return where;
}

const SORTABLE_FIELDS = ['ecosystemId', 'biomeId', 'proportion'];
const DEFAULT_ORDER_BY = [{ ecosystemId: 'asc' }, { biomeId: 'asc' }];

function buildOrderBy(query = {}) {
  const primary = normalizeSort(query.sort, { allowedFields: SORTABLE_FIELDS, fallback: null });
  if (!primary) return DEFAULT_ORDER_BY;
  const primaryField = Object.keys(primary[0])[0];
  return [...primary, ...DEFAULT_ORDER_BY.filter(entry => Object.keys(entry)[0] !== primaryField)];
}

function withSearch(where, query = {}) {
  const search = normalizeSearchQuery(query);
  if (!search) return where;

  const or = [
    { ecosystemId: { contains: search, mode: 'insensitive' } },
    { biomeId: { contains: search, mode: 'insensitive' } },
    { notes: { contains: search, mode: 'insensitive' } },
  ];

  if (!Object.keys(where).length) {
    return { OR: or };
  }

  return {
    AND: [where, { OR: or }],
  };
}

async function ensureEcosystemAndBiome(ecosystemId, biomeId) {
  const [ecosystem, biome] = await Promise.all([
    prisma.ecosystem.findUnique({ where: { id: ecosystemId } }),
    prisma.biome.findUnique({ where: { id: biomeId } }),
  ]);

  if (!ecosystem) {
    return { error: 'Invalid ecosystemId' };
  }
  if (!biome) {
    return { error: 'Invalid biomeId' };
  }
  return { ecosystem, biome };
}

router.get('/', async (req, res) => {
  try {
    const { page, pageSize } = assertPagination(req.query);
    const where = withSearch(buildFilter(req.query), req.query);
    const orderBy = buildOrderBy(req.query);

    const [total, items] = await Promise.all([
      prisma.ecosystemBiome.count({ where }),
      prisma.ecosystemBiome.findMany({
        where,
        orderBy,
        skip: page * pageSize,
        take: pageSize,
      }),
    ]);

    res.json(toPagedResult(items, page, pageSize, total));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.status).json({ error: error.message, code: error.code, details: error.details });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/', requireTaxonomyWrite, async (req, res) => {
  try {
    const ecosystemId = normalizeId(req.body.ecosystemId);
    if (!ecosystemId) return res.status(400).json({ error: 'ecosystemId is required' });

    const biomeId = normalizeId(req.body.biomeId);
    if (!biomeId) return res.status(400).json({ error: 'biomeId is required' });

    const validation = await ensureEcosystemAndBiome(ecosystemId, biomeId);
    if (validation.error) return res.status(400).json({ error: validation.error });

    const writable = collectWritableFields(req.body);
    if (writable.error) return res.status(400).json({ error: writable.error });

    const created = await prisma.ecosystemBiome.create({
      data: {
        ecosystemId,
        biomeId,
        ...writable.data,
      },
    });

    res.status(201).json(created);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Ecosystem biome already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.patch('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const existing = await prisma.ecosystemBiome.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    let ecosystemId = existing.ecosystemId;
    if ('ecosystemId' in req.body) {
      ecosystemId = normalizeId(req.body.ecosystemId);
      if (!ecosystemId) return res.status(400).json({ error: 'ecosystemId is required' });
    }

    let biomeId = existing.biomeId;
    if ('biomeId' in req.body) {
      biomeId = normalizeId(req.body.biomeId);
      if (!biomeId) return res.status(400).json({ error: 'biomeId is required' });
    }

    if ('ecosystemId' in req.body || 'biomeId' in req.body) {
      const validation = await ensureEcosystemAndBiome(ecosystemId, biomeId);
      if (validation.error) return res.status(400).json({ error: validation.error });
    }

    const writable = collectWritableFields(req.body);
    if (writable.error) return res.status(400).json({ error: writable.error });

    const updated = await prisma.ecosystemBiome.update({
      where: { id: existing.id },
      data: {
        ecosystemId,
        biomeId,
        ...writable.data,
      },
    });

    res.json(updated);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Ecosystem biome already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const existing = await prisma.ecosystemBiome.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.ecosystemBiome.delete({ where: { id: existing.id } });

    res.sendStatus(204);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
