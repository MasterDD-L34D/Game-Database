const express = require('express');
const prisma = require('../db/prisma');
const { requireTaxonomyWrite } = require('../middleware/permissions');

const router = express.Router();

function normalizeId(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizePresence(value) {
  if (value == null) return '';
  return String(value).trim();
}

function collectWritableFields(body) {
  const data = {};
  if ('presence' in body) data.presence = body.presence;
  if ('abundance' in body) data.abundance = body.abundance ?? null;
  if ('notes' in body) data.notes = body.notes ?? null;
  return data;
}

function buildFilter(query = {}) {
  const where = {};
  if (query.speciesId) where.speciesId = String(query.speciesId);
  if (query.biomeId) where.biomeId = String(query.biomeId);
  if (query.presence) where.presence = String(query.presence);
  return where;
}

async function ensureSpeciesAndBiome(speciesId, biomeId) {
  const [species, biome] = await Promise.all([
    prisma.species.findUnique({ where: { id: speciesId } }),
    prisma.biome.findUnique({ where: { id: biomeId } }),
  ]);

  if (!species) {
    return { error: 'Invalid speciesId' };
  }
  if (!biome) {
    return { error: 'Invalid biomeId' };
  }
  return { species, biome };
}

router.get('/', async (req, res) => {
  try {
    const where = buildFilter(req.query);
    const items = await prisma.speciesBiome.findMany({
      where,
      orderBy: [
        { speciesId: 'asc' },
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
    const speciesId = normalizeId(req.body.speciesId);
    if (!speciesId) return res.status(400).json({ error: 'speciesId is required' });

    const biomeId = normalizeId(req.body.biomeId);
    if (!biomeId) return res.status(400).json({ error: 'biomeId is required' });

    const presence = normalizePresence(req.body.presence);
    if (!presence) return res.status(400).json({ error: 'presence is required' });

    const validation = await ensureSpeciesAndBiome(speciesId, biomeId);
    if (validation.error) return res.status(400).json({ error: validation.error });

    const created = await prisma.speciesBiome.create({
      data: {
        speciesId,
        biomeId,
        presence,
        ...collectWritableFields({ ...req.body, presence }),
      },
    });

    res.status(201).json(created);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Species biome already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.patch('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const existing = await prisma.speciesBiome.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    let speciesId = existing.speciesId;
    if ('speciesId' in req.body) {
      speciesId = normalizeId(req.body.speciesId);
      if (!speciesId) return res.status(400).json({ error: 'speciesId is required' });
    }

    let biomeId = existing.biomeId;
    if ('biomeId' in req.body) {
      biomeId = normalizeId(req.body.biomeId);
      if (!biomeId) return res.status(400).json({ error: 'biomeId is required' });
    }

    if ('speciesId' in req.body || 'biomeId' in req.body) {
      const validation = await ensureSpeciesAndBiome(speciesId, biomeId);
      if (validation.error) return res.status(400).json({ error: validation.error });
    }

    let presence = existing.presence;
    if ('presence' in req.body) {
      presence = normalizePresence(req.body.presence);
      if (!presence) return res.status(400).json({ error: 'presence is required' });
    }

    const updated = await prisma.speciesBiome.update({
      where: { id: existing.id },
      data: {
        speciesId,
        biomeId,
        presence,
        ...collectWritableFields({ ...req.body, presence }),
      },
    });

    res.json(updated);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Species biome already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const existing = await prisma.speciesBiome.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.speciesBiome.delete({ where: { id: existing.id } });

    res.sendStatus(204);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
