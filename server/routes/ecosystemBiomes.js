const express = require('express');
const prisma = require('../db/prisma');
const { requireTaxonomyWrite } = require('../middleware/permissions');

const router = express.Router();

function normalizeId(value) {
  if (value == null) return '';
  return String(value).trim();
}

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
    const where = buildFilter(req.query);
    const items = await prisma.ecosystemBiome.findMany({
      where,
      orderBy: [
        { ecosystemId: 'asc' },
        { biomeId: 'asc' },
      ],
    });
    res.json(items);
  } catch (error) {
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
