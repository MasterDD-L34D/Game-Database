const express = require('express');
const { Prisma } = require('@prisma/client');
const prisma = require('../db/prisma');
const { AppError, handleError } = require('../utils/httpErrors');
const { buildFuzzySearchSql } = require('../utils/searchQuery');

const router = express.Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_THRESHOLD = 0.3;

function clampNumber(raw, fallback, min, max) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      throw new AppError(400, 'VALIDATION_ERROR', 'q is required', { field: 'q', location: 'query' });
    }
    const limit = Math.trunc(clampNumber(req.query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT));
    const threshold = clampNumber(req.query.threshold, DEFAULT_THRESHOLD, 0, 1);

    const sql = buildFuzzySearchSql({ entities: req.query.entities, q, limit });
    // set_limit() sets pg_trgm.similarity_threshold for the connection so the
    // `col % q` filter (GIN-trgm accelerated) means similarity >= threshold.
    // Both statements must share one connection ⇒ run inside a transaction.
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT set_limit(${threshold}::real)`);
      return tx.$queryRaw(sql);
    });

    const results = rows.map((r) => ({
      entity: r.entity,
      id: r.id,
      slug: r.slug ?? null,
      label: r.label,
      score: Number(r.score),
    }));
    return res.json({ q, results });
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
