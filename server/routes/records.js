const express = require('express');
const prisma = require('../db/prisma');
const { RecordStato } = require('@prisma/client');
const { logAudit } = require('../utils/audit');
const { AppError, sendError, handleError } = require('../utils/httpErrors');
const { assertPagination, assertIdParam, assertString, assertEnum } = require('../utils/validation');

const router = express.Router();

const ALLOWED_SORT_FIELDS = ['createdAt', 'nome', 'stato', 'stile', 'pattern', 'peso', 'curvatura'];

function normalizeDateInput(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid date: use ISO 8601 string or null', { field: 'data', location: 'body' });
    }
    return parsed;
  }
  throw new AppError(400, 'VALIDATION_ERROR', 'Invalid date: use ISO 8601 string or null', { field: 'data', location: 'body' });
}

function validateRecordPayload(body, { requireNome = false, requireStato = false } = {}) {
  if (requireNome || Object.prototype.hasOwnProperty.call(body, 'nome')) {
    assertString(body.nome, 'nome', { required: true, trim: true });
  }
  if (requireStato || Object.prototype.hasOwnProperty.call(body, 'stato')) {
    assertEnum(body.stato, Object.values(RecordStato), 'stato', { required: true });
  }
}

function buildWhereAndOrder(req) {
  const q = (req.query.q || '').trim();
  const [sf, sd] = String(req.query.sort || '').split(':');
  if (sf && !ALLOWED_SORT_FIELDS.includes(sf)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Invalid sort field: ${sf}`, { field: 'sort', location: 'query' });
  }

  const orderBy = sf ? { [sf]: sd === 'desc' ? 'desc' : 'asc' } : { createdAt: 'desc' };
  const stile = req.query.stile || undefined;
  const pattern = req.query.pattern || undefined;
  const peso = req.query.peso || undefined;
  const curvatura = req.query.curvatura || undefined;

  const filterFields = {
    ...(stile ? { stile } : {}),
    ...(pattern ? { pattern } : {}),
    ...(peso ? { peso } : {}),
    ...(curvatura ? { curvatura } : {}),
  };

  const where = q
    ? { AND: [filterFields, { OR: [{ nome: { contains: q, mode: 'insensitive' } }, { descrizione: { contains: q, mode: 'insensitive' } }] }] }
    : filterFields;
  return { where, orderBy };
}

router.get('/', async (req, res) => {
  try {
    const { page, pageSize } = assertPagination(req.query);
    const { where, orderBy } = buildWhereAndOrder(req);
    const [total, items] = await Promise.all([
      prisma.record.count({ where }),
      prisma.record.findMany({ where, orderBy, skip: page * pageSize, take: pageSize }),
    ]);
    res.json({ items, page, pageSize, total });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/export', async (req, res) => {
  try {
    const { where, orderBy } = buildWhereAndOrder(req);
    const format = (req.query.format || 'csv').toString().toLowerCase();
    const filename = `records_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${format === 'json' ? 'json' : 'csv'}`;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.write('[');
      const batchSize = 1000;
      let page = 0;
      let first = true;
      while (true) {
        const items = await prisma.record.findMany({ where, orderBy, skip: page * batchSize, take: batchSize });
        if (!items.length) break;
        for (const it of items) {
          if (!first) res.write(',');
          first = false;
          res.write(JSON.stringify(it));
        }
        page += 1;
        await new Promise(resolve => setImmediate(resolve));
      }
      res.write(']');
      return res.end();
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const header = ['id', 'nome', 'stato', 'stile', 'pattern', 'peso', 'curvatura', 'descrizione', 'data', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt'];
    res.write(`${header.join(',')}\n`);
    function csvEscape(v) {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }

    const batchSize = 1000;
    let page = 0;
    while (true) {
      const items = await prisma.record.findMany({ where, orderBy, skip: page * batchSize, take: batchSize });
      if (!items.length) break;
      for (const it of items) {
        const date = it.data ? it.data.toISOString().slice(0, 10) : '';
        const createdAt = it.createdAt ? it.createdAt.toISOString() : '';
        const updatedAt = it.updatedAt ? it.updatedAt.toISOString() : '';
        const row = [it.id, it.nome, it.stato, it.stile, it.pattern, it.peso, it.curvatura, it.descrizione, date, it.createdBy, it.updatedBy, createdAt, updatedAt];
        res.write(`${row.map(csvEscape).join(',')}\n`);
      }
      page += 1;
      await new Promise(resolve => setImmediate(resolve));
    }
    return res.end();
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const item = await prisma.record.findUnique({ where: { id } });
    if (!item) return sendError(res, 404, 'NOT_FOUND', 'Record not found', { id });
    return res.json(item);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/', async (req, res) => {
  try {
    validateRecordPayload(req.body, { requireNome: true, requireStato: true });
    const normalizedDate = normalizeDateInput(req.body.data ?? undefined);
    const created = await prisma.record.create({
      data: {
        nome: req.body.nome.trim(),
        stato: req.body.stato,
        descrizione: req.body.descrizione ?? null,
        data: normalizedDate ?? null,
        stile: req.body.stile ?? null,
        pattern: req.body.pattern ?? null,
        peso: req.body.peso ?? null,
        curvatura: req.body.curvatura ?? null,
        createdBy: req.user || null,
        updatedBy: req.user || null,
      },
    });
    await logAudit(req, 'Record', created.id, 'CREATE', created);
    return res.status(201).json(created);
  } catch (error) {
    return handleError(res, error);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    validateRecordPayload(req.body, { requireNome: false, requireStato: false });
    const normalizedDate = 'data' in req.body ? normalizeDateInput(req.body.data) : undefined;

    const updated = await prisma.record.update({
      where: { id },
      data: {
        ...('nome' in req.body ? { nome: req.body.nome.trim() } : {}),
        ...('stato' in req.body ? { stato: req.body.stato } : {}),
        ...('descrizione' in req.body ? { descrizione: req.body.descrizione ?? null } : {}),
        ...('data' in req.body ? { data: normalizedDate ?? null } : {}),
        ...('stile' in req.body ? { stile: req.body.stile ?? null } : {}),
        ...('pattern' in req.body ? { pattern: req.body.pattern ?? null } : {}),
        ...('peso' in req.body ? { peso: req.body.peso ?? null } : {}),
        ...('curvatura' in req.body ? { curvatura: req.body.curvatura ?? null } : {}),
        updatedBy: req.user || undefined,
      },
    });

    await logAudit(req, 'Record', updated.id, 'UPDATE', req.body);
    return res.json(updated);
  } catch (error) {
    if (error?.code === 'P2025') return sendError(res, 404, 'NOT_FOUND', 'Record not found', { id: req.params.id });
    return handleError(res, error);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const existing = await prisma.record.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, 'NOT_FOUND', 'Record not found', { id });

    await prisma.record.delete({ where: { id } });
    await logAudit(req, 'Record', existing.id, 'DELETE', existing);
    return res.status(204).end();
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
