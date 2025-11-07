
const express = require('express');
const prisma = require('../db/prisma');
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

async function fetchPaginatedEcosystems(req) {
  const { page, pageSize } = parsePagination(req);
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

function getUserEmail(req) {
  return req.user?.email || req.user || null;
}

function mapEcosystemData(body, slug, name) {
  return {
    slug,
    name,
    description: body.description ?? null,
    region: body.region ?? null,
    climate: body.climate ?? null,
  };
}

router.get('/', async (req, res) => {
  const payload = await fetchPaginatedEcosystems(req);
  res.json(payload);
});

router.get('/:id', async (req, res) => {
  const item = await prisma.ecosystem.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }] } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.post('/', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const slug = normalizeSlug(req.body.slug || name);
    if (!slug) return res.status(400).json({ error: 'Slug is required' });
    const existingSlug = await prisma.ecosystem.findUnique({ where: { slug } });
    if (existingSlug) return res.status(409).json({ error: 'Slug already exists' });

    const created = await prisma.ecosystem.create({ data: mapEcosystemData(req.body, slug, name) });

    await prisma.auditLog.create({
      data: {
        entity: 'Ecosystem',
        entityId: created.id,
        action: 'CREATE',
        user: getUserEmail(req),
        payload: created,
      },
    });

    const payload = await fetchPaginatedEcosystems(req);
    res.status(201).json(payload);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Validation failed or bad input' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.ecosystem.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }] } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const slug = normalizeSlug(req.body.slug || name);
    if (!slug) return res.status(400).json({ error: 'Slug is required' });
    if (slug !== existing.slug) {
      const existingSlug = await prisma.ecosystem.findUnique({ where: { slug } });
      if (existingSlug && existingSlug.id !== existing.id) {
        return res.status(409).json({ error: 'Slug already exists' });
      }
    }

    const updated = await prisma.ecosystem.update({
      where: { id: existing.id },
      data: mapEcosystemData(req.body, slug, name),
    });

    await prisma.auditLog.create({
      data: {
        entity: 'Ecosystem',
        entityId: updated.id,
        action: 'UPDATE',
        user: getUserEmail(req),
        payload: req.body,
      },
    });

    const payload = await fetchPaginatedEcosystems(req);
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Validation failed or bad input' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.ecosystem.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }] } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.ecosystem.delete({ where: { id: existing.id } });

    await prisma.auditLog.create({
      data: {
        entity: 'Ecosystem',
        entityId: existing.id,
        action: 'DELETE',
        user: getUserEmail(req),
        payload: existing,
      },
    });

    const payload = await fetchPaginatedEcosystems(req);
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
