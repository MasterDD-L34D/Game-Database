
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
  const { page, pageSize } = parsePagination(req);
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

function getUserEmail(req) {
  return req.user?.email || req.user || null;
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

router.get('/', async (req, res) => {
  const payload = await fetchPaginatedSpecies(req);
  res.json(payload);
});

router.get('/:id', async (req, res) => {
  const item = await prisma.species.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }] } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.post('/', async (req, res) => {
  try {
    const scientificName = (req.body.scientificName || '').trim();
    if (!scientificName) return res.status(400).json({ error: 'scientificName is required' });

    const slug = normalizeSlug(req.body.slug || req.body.commonName || scientificName);
    if (!slug) return res.status(400).json({ error: 'Slug is required' });
    const existingSlug = await prisma.species.findUnique({ where: { slug } });
    if (existingSlug) return res.status(409).json({ error: 'Slug already exists' });

    const created = await prisma.species.create({ data: mapSpeciesData(req.body, slug, scientificName) });

    await prisma.auditLog.create({
      data: {
        entity: 'Species',
        entityId: created.id,
        action: 'CREATE',
        user: getUserEmail(req),
        payload: created,
      },
    });

    const payload = await fetchPaginatedSpecies(req);
    res.status(201).json(payload);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Validation failed or bad input' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.species.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }] } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const scientificName = (req.body.scientificName || '').trim();
    if (!scientificName) return res.status(400).json({ error: 'scientificName is required' });

    const slug = normalizeSlug(req.body.slug || req.body.commonName || scientificName);
    if (!slug) return res.status(400).json({ error: 'Slug is required' });
    if (slug !== existing.slug) {
      const existingSlug = await prisma.species.findUnique({ where: { slug } });
      if (existingSlug && existingSlug.id !== existing.id) {
        return res.status(409).json({ error: 'Slug already exists' });
      }
    }

    const updated = await prisma.species.update({
      where: { id: existing.id },
      data: mapSpeciesData(req.body, slug, scientificName),
    });

    await prisma.auditLog.create({
      data: {
        entity: 'Species',
        entityId: updated.id,
        action: 'UPDATE',
        user: getUserEmail(req),
        payload: req.body,
      },
    });

    const payload = await fetchPaginatedSpecies(req);
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Validation failed or bad input' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.species.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }] } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.species.delete({ where: { id: existing.id } });

    await prisma.auditLog.create({
      data: {
        entity: 'Species',
        entityId: existing.id,
        action: 'DELETE',
        user: getUserEmail(req),
        payload: existing,
      },
    });

    const payload = await fetchPaginatedSpecies(req);
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
