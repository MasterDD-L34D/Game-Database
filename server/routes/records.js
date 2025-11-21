
const express = require('express');
const prisma = require('../db/prisma');
const { RecordStato } = require('@prisma/client');
const { logAudit } = require('../utils/audit');
const router = express.Router();

const ALLOWED_SORT_FIELDS = ['createdAt', 'nome', 'stato', 'stile', 'pattern', 'peso', 'curvatura'];

class BadRequestError extends Error {}

function normalizeDateInput(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestError('Data non valida: usa una stringa ISO 8601 o null');
    }
    return parsed;
  }
  throw new BadRequestError('Data non valida: usa una stringa ISO 8601 o null');
}

function validateRecordPayload(body, { requireNome = false, requireStato = false } = {}) {
  const errors = [];

  const shouldValidateNome = requireNome || Object.prototype.hasOwnProperty.call(body, 'nome');
  if (shouldValidateNome) {
    if (typeof body.nome !== 'string' || body.nome.trim() === '') {
      errors.push('Il campo nome è obbligatorio e non può essere vuoto');
    }
  }

  const shouldValidateStato = requireStato || Object.prototype.hasOwnProperty.call(body, 'stato');
  if (shouldValidateStato) {
    if (body.stato === undefined || body.stato === null) {
      errors.push('Il campo stato è obbligatorio');
    } else if (!Object.values(RecordStato).includes(body.stato)) {
      errors.push(`Valore stato non valido: ${body.stato}`);
    }
  }

  if (errors.length) {
    throw new BadRequestError(errors.join('; '));
  }
}

function buildWhereAndOrder(req) {
  const q = (req.query.q || '').trim();
  const [sf, sd] = String(req.query.sort || '').split(':');
  if (sf && !ALLOWED_SORT_FIELDS.includes(sf)) {
    throw new BadRequestError(`Campo di ordinamento non valido: ${sf}`);
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
    ? { AND: [ filterFields, { OR: [{ nome: { contains: q, mode: 'insensitive' } }, { descrizione: { contains: q, mode: 'insensitive' } }] } ] }
    : filterFields;
  return { where, orderBy };
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '0', 10), 0);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '25', 10), 1), 100);
    const { where, orderBy } = buildWhereAndOrder(req);
    const [total, items] = await Promise.all([
      prisma.record.count({ where }),
      prisma.record.findMany({ where, orderBy, skip: page * pageSize, take: pageSize }),
    ]);
    res.json({ items, page, pageSize, total });
  } catch (e) {
    if (e instanceof BadRequestError) return res.status(400).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { where, orderBy } = buildWhereAndOrder(req);
    const format = (req.query.format || 'csv').toString().toLowerCase();
    const filename = `records_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.${format === 'json' ? 'json' : 'csv'}`;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.write('[');
      const batchSize = 1000; let page = 0, first = true;
      while (true) {
        const items = await prisma.record.findMany({ where, orderBy, skip: page * batchSize, take: batchSize });
        if (!items.length) break;
        for (const it of items) { if (!first) res.write(','); first = false; res.write(JSON.stringify(it)); }
        page++; await new Promise(resolve => setImmediate(resolve));
      }
      res.write(']'); return res.end();
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const header = ['id','nome','stato','stile','pattern','peso','curvatura','descrizione','data','createdBy','updatedBy','createdAt','updatedAt'];
    res.write(header.join(',') + '\n');
    function csvEscape(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
    const batchSize = 1000; let page = 0;
    while (true) {
      const items = await prisma.record.findMany({ where, orderBy, skip: page * batchSize, take: batchSize });
      if (!items.length) break;
      for (const it of items) {
        const row = [it.id, it.nome, it.stato, it.stile, it.pattern, it.peso, it.curvatura, it.descrizione, it.data?.toISOString?.().slice(0,10), it.createdBy, it.updatedBy, it.createdAt?.toISOString?.(), it.updatedAt?.toISOString?.()];
        res.write(row.map(csvEscape).join(',') + '\n');
      }
      page++; await new Promise(resolve => setImmediate(resolve));
    }
    res.end();
  } catch (e) {
    if (e instanceof BadRequestError) return res.status(400).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/:id', async (req, res) => {
  const item = await prisma.record.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.post('/', async (req, res) => {
  try {
    validateRecordPayload(req.body, { requireNome: true, requireStato: true });
    const normalizedDate = normalizeDateInput(req.body.data ?? undefined);
    const created = await prisma.record.create({
      data: {
        nome: req.body.nome,
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
    res.status(201).json(created);
  } catch (e) {
    if (e instanceof BadRequestError) return res.status(400).json({ error: e.message });
    console.error(e);
    res.status(400).json({ error: 'Validation failed or bad input' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    validateRecordPayload(req.body, { requireNome: false, requireStato: false });
    const normalizedDate = 'data' in req.body ? normalizeDateInput(req.body.data) : undefined;
    const updated = await prisma.record.update({
      where: { id: req.params.id },
      data: {
        ...('nome' in req.body ? { nome: req.body.nome } : {}),
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
    res.json(updated);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    if (e instanceof BadRequestError) return res.status(400).json({ error: e.message });
    console.error(e);
    res.status(400).json({ error: 'Validation failed or bad input' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.record.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.record.delete({ where: { id: req.params.id } });
    await logAudit(req, 'Record', existing.id, 'DELETE', existing);
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
