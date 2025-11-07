
const express = require('express');
const prisma = require('../db/prisma');
const router = express.Router();

router.get('/', async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '0', 10), 0);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '25', 10), 1), 100);
  const q = (req.query.q || '').trim();
  const where = q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] } : {};
  const [total, items] = await Promise.all([
    prisma.species.count({ where }),
    prisma.species.findMany({ where, skip: page * pageSize, take: pageSize, orderBy: { name: 'asc' } }),
  ]);
  res.json({ items, page, pageSize, total });
});

router.get('/:id', async (req, res) => {
  const item = await prisma.species.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }] } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

module.exports = router;
