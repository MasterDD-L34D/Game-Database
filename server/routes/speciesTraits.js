const express = require('express');
const prisma = require('../db/prisma');
const { requireTaxonomyWrite } = require('../middleware/permissions');

const router = express.Router();

const DEFAULT_CATEGORY = 'baseline';

function normalizeId(value) {
  if (value == null) return '';
  const normalized = String(value).trim();
  return normalized;
}

function normalizeCategory(value, fallback = DEFAULT_CATEGORY) {
  if (value === undefined) return fallback;
  if (value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function collectWritableFields(body) {
  const data = {};
  if ('value' in body) data.value = body.value ?? null;
  if ('num' in body) data.num = body.num ?? null;
  if ('bool' in body) data.bool = body.bool ?? null;
  if ('text' in body) data.text = body.text ?? null;
  if ('unit' in body) data.unit = body.unit ?? null;
  if ('source' in body) data.source = body.source ?? null;
  if ('confidence' in body) data.confidence = body.confidence ?? null;
  return data;
}

function buildFilter(query = {}) {
  const where = {};
  if (query.speciesId) where.speciesId = String(query.speciesId);
  if (query.traitId) where.traitId = String(query.traitId);
  if (query.category) where.category = String(query.category);
  return where;
}

async function ensureSpeciesAndTrait(speciesId, traitId) {
  const [species, trait] = await Promise.all([
    prisma.species.findUnique({ where: { id: speciesId } }),
    prisma.trait.findUnique({ where: { id: traitId } }),
  ]);

  if (!species) {
    return { error: 'Invalid speciesId' };
  }
  if (!trait) {
    return { error: 'Invalid traitId' };
  }
  return { species, trait };
}

router.get('/', async (req, res) => {
  const where = buildFilter(req.query);
  const items = await prisma.speciesTrait.findMany({
    where,
    orderBy: [
      { speciesId: 'asc' },
      { traitId: 'asc' },
      { category: 'asc' },
    ],
  });
  res.json(items);
});

router.post('/', requireTaxonomyWrite, async (req, res) => {
  try {
    const speciesId = normalizeId(req.body.speciesId);
    if (!speciesId) return res.status(400).json({ error: 'speciesId is required' });

    const traitId = normalizeId(req.body.traitId);
    if (!traitId) return res.status(400).json({ error: 'traitId is required' });

    const validation = await ensureSpeciesAndTrait(speciesId, traitId);
    if (validation.error) return res.status(400).json({ error: validation.error });

    const category = normalizeCategory(req.body.category);

    const existing = await prisma.speciesTrait.findFirst({
      where: { speciesId, traitId, category },
    });
    if (existing) return res.status(409).json({ error: 'Species trait already exists' });

    const created = await prisma.speciesTrait.create({
      data: {
        speciesId,
        traitId,
        category,
        ...collectWritableFields(req.body),
      },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.patch('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const existing = await prisma.speciesTrait.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    let speciesId = existing.speciesId;
    if ('speciesId' in req.body) {
      speciesId = normalizeId(req.body.speciesId);
      if (!speciesId) return res.status(400).json({ error: 'speciesId is required' });
    }

    let traitId = existing.traitId;
    if ('traitId' in req.body) {
      traitId = normalizeId(req.body.traitId);
      if (!traitId) return res.status(400).json({ error: 'traitId is required' });
    }

    if ('speciesId' in req.body || 'traitId' in req.body) {
      const validation = await ensureSpeciesAndTrait(speciesId, traitId);
      if (validation.error) return res.status(400).json({ error: validation.error });
    }

    const category =
      'category' in req.body
        ? normalizeCategory(req.body.category)
        : existing.category || DEFAULT_CATEGORY;

    const duplicate = await prisma.speciesTrait.findFirst({
      where: { speciesId, traitId, category },
    });
    if (duplicate && duplicate.id !== existing.id) {
      return res.status(409).json({ error: 'Species trait already exists' });
    }

    const updated = await prisma.speciesTrait.update({
      where: { id: existing.id },
      data: {
        speciesId,
        traitId,
        category,
        ...collectWritableFields(req.body),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const existing = await prisma.speciesTrait.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.speciesTrait.delete({ where: { id: existing.id } });

    res.sendStatus(204);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
