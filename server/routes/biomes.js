
const express = require('express');
const prisma = require('../db/prisma');
const { requireTaxonomyWrite } = require('../middleware/permissions');
const { logAudit } = require('../utils/audit');
const router = express.Router();

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

async function fetchPaginatedBiomes(req) {
  const { page, pageSize } = parsePagination(req);
  const where = buildWhere(req);
  const [total, items] = await Promise.all([
    prisma.biome.count({ where }),
    prisma.biome.findMany({ where, skip: page * pageSize, take: pageSize, orderBy: { name: 'asc' } }),
  ]);
  return { items, page, pageSize, total };
}

function normalizeSlug(input) {
  if (!input) return '';
  return input.toString().trim().toLowerCase().replace(/\s+/g, '-');
}

async function resolveParent(parentValue, currentId) {
  if (parentValue === null || parentValue === undefined || parentValue === '') return null;
  const parent = await prisma.biome.findFirst({ where: { OR: [{ id: parentValue }, { slug: parentValue }] } });
  if (!parent) throw new Error('Invalid parent biome');
  if (parent.id === currentId) throw new Error('A biome cannot be its own parent');
  return parent.id;
}

router.get('/', async (req, res) => {
  const payload = await fetchPaginatedBiomes(req);
  res.json(payload);
});

router.get('/:id', async (req, res) => {
  const item = await prisma.biome.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }] } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.post('/', requireTaxonomyWrite, async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const slug = normalizeSlug(req.body.slug || name);
    if (!slug) return res.status(400).json({ error: 'Slug is required' });
    const existingSlug = await prisma.biome.findUnique({ where: { slug } });
    if (existingSlug) return res.status(409).json({ error: 'Slug already exists' });

    let parentId = null;
    if (req.body.parentId !== undefined && req.body.parentId !== null && req.body.parentId !== '') {
      try {
        parentId = await resolveParent(req.body.parentId, null);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    const created = await prisma.biome.create({
      data: {
        slug,
        name,
        description: req.body.description ?? null,
        climate: req.body.climate ?? null,
        parentId,
      },
    });

    await logAudit(req, 'Biome', created.id, 'CREATE', created);

    const payload = await fetchPaginatedBiomes(req);
    res.status(201).json(payload);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Validation failed or bad input' });
  }
});

router.put('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const existing = await prisma.biome.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }] } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const slug = normalizeSlug(req.body.slug || name);
    if (!slug) return res.status(400).json({ error: 'Slug is required' });
    if (slug !== existing.slug) {
      const existingSlug = await prisma.biome.findUnique({ where: { slug } });
      if (existingSlug && existingSlug.id !== existing.id) {
        return res.status(409).json({ error: 'Slug already exists' });
      }
    }

    let parentId = existing.parentId;
    if (Object.prototype.hasOwnProperty.call(req.body, 'parentId')) {
      try {
        parentId = await resolveParent(req.body.parentId, existing.id);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    const updated = await prisma.biome.update({
      where: { id: existing.id },
      data: {
        slug,
        name,
        description: req.body.description ?? null,
        climate: req.body.climate ?? null,
        parentId,
      },
    });

    await logAudit(req, 'Biome', updated.id, 'UPDATE', req.body);

    const payload = await fetchPaginatedBiomes(req);
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Validation failed or bad input' });
  }
});

router.delete('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const existing = await prisma.biome.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }] } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.biome.delete({ where: { id: existing.id } });

    await logAudit(req, 'Biome', existing.id, 'DELETE', existing);

    const payload = await fetchPaginatedBiomes(req);
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
