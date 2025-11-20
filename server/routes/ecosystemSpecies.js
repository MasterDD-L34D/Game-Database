const express = require('express');
const prisma = require('../db/prisma');
const { requireTaxonomyWrite } = require('../middleware/permissions');

const router = express.Router();

const ALLOWED_ROLES = new Set([
  'keystone',
  'dominant',
  'engineer',
  'common',
  'invasive',
  'other',
]);

function normalizeId(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeRole(value) {
  if (value == null) return '';
  return String(value).trim();
}

function parseRole(value, { required = true } = {}) {
  const role = normalizeRole(value);

  if (!role) {
    return required ? { error: 'role is required' } : { ok: true, value: undefined };
  }

  if (!ALLOWED_ROLES.has(role)) {
    return {
      error: 'role must be one of: keystone, dominant, engineer, common, invasive, other',
    };
  }

  return { ok: true, value: role };
}

function normalizeAbundance(value) {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === '') return { ok: true, value: null };
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return { ok: false, error: 'abundance must be a number' };
  }
  return { ok: true, value: numberValue };
}

function collectWritableFields(body) {
  const data = {};
  if ('abundance' in body) {
    const result = normalizeAbundance(body.abundance);
    if (!result.ok) return { error: result.error };
    if (result.value !== undefined) data.abundance = result.value;
  }
  if ('notes' in body) data.notes = body.notes ?? null;
  return { data };
}

function buildFilter(query = {}) {
  const where = {};
  if (query.ecosystemId) where.ecosystemId = String(query.ecosystemId);
  if (query.speciesId) where.speciesId = String(query.speciesId);
  if (query.role) {
    const roleResult = parseRole(query.role, { required: false });
    if (roleResult.error) return { error: roleResult.error };
    if (roleResult.value) where.role = roleResult.value;
  }
  return { where };
}

async function ensureEcosystemAndSpecies(ecosystemId, speciesId) {
  const [ecosystem, species] = await Promise.all([
    prisma.ecosystem.findUnique({ where: { id: ecosystemId } }),
    prisma.species.findUnique({ where: { id: speciesId } }),
  ]);

  if (!ecosystem) {
    return { error: 'Invalid ecosystemId' };
  }
  if (!species) {
    return { error: 'Invalid speciesId' };
  }
  return { ecosystem, species };
}

router.get('/', async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    if (filter.error) return res.status(400).json({ error: filter.error });

    const where = filter.where;
    const items = await prisma.ecosystemSpecies.findMany({
      where,
      orderBy: [
        { ecosystemId: 'asc' },
        { speciesId: 'asc' },
        { role: 'asc' },
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

    const speciesId = normalizeId(req.body.speciesId);
    if (!speciesId) return res.status(400).json({ error: 'speciesId is required' });

    const roleResult = parseRole(req.body.role);
    if (roleResult.error) return res.status(400).json({ error: roleResult.error });
    const role = roleResult.value;

    const validation = await ensureEcosystemAndSpecies(ecosystemId, speciesId);
    if (validation.error) return res.status(400).json({ error: validation.error });

    const writable = collectWritableFields(req.body);
    if (writable.error) return res.status(400).json({ error: writable.error });

    const created = await prisma.ecosystemSpecies.create({
      data: {
        ecosystemId,
        speciesId,
        role,
        ...writable.data,
      },
    });

    res.status(201).json(created);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Ecosystem species already exists' });
    }
    if (error?.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid ecosystemId or speciesId' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.patch('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const existing = await prisma.ecosystemSpecies.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    let ecosystemId = existing.ecosystemId;
    if ('ecosystemId' in req.body) {
      ecosystemId = normalizeId(req.body.ecosystemId);
      if (!ecosystemId) return res.status(400).json({ error: 'ecosystemId is required' });
    }

    let speciesId = existing.speciesId;
    if ('speciesId' in req.body) {
      speciesId = normalizeId(req.body.speciesId);
      if (!speciesId) return res.status(400).json({ error: 'speciesId is required' });
    }

    if ('ecosystemId' in req.body || 'speciesId' in req.body) {
      const validation = await ensureEcosystemAndSpecies(ecosystemId, speciesId);
      if (validation.error) return res.status(400).json({ error: validation.error });
    }

    let role = existing.role;
    if ('role' in req.body) {
      const roleResult = parseRole(req.body.role);
      if (roleResult.error) return res.status(400).json({ error: roleResult.error });
      role = roleResult.value;
    }

    const writable = collectWritableFields(req.body);
    if (writable.error) return res.status(400).json({ error: writable.error });

    const updated = await prisma.ecosystemSpecies.update({
      where: { id: existing.id },
      data: {
        ecosystemId,
        speciesId,
        role,
        ...writable.data,
      },
    });

    res.json(updated);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Ecosystem species already exists' });
    }
    if (error?.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid ecosystemId or speciesId' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const existing = await prisma.ecosystemSpecies.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.ecosystemSpecies.delete({ where: { id: existing.id } });

    res.sendStatus(204);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
