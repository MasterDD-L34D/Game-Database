const express = require('express');
const prisma = require('../db/prisma');
const { requireRole } = require('../middleware/permissions');
const { logAudit } = require('../utils/audit');
const { AppError, sendError, handleError } = require('../utils/httpErrors');
const { assertString } = require('../utils/validation');
const { snapshotAllMasters, FIELD_MAP } = require('../utils/versionSnapshot');

const router = express.Router();
const requireAdmin = requireRole('admin');
const SEMVER_RE = /^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

function validateTag(body) {
  const tag = assertString(body.tag, 'tag', { required: true });
  if (!SEMVER_RE.test(tag)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'tag must be semver-like (e.g. v1.2.0, v2.0.0-rc1)', { field: 'tag', location: 'body' });
  }
  return tag;
}

async function snapshotCounts(versionId) {
  const entries = await Promise.all(
    Object.entries(FIELD_MAP).map(async ([key, cfg]) => [key, await prisma[cfg.snapshot].count({ where: { versionId } })]),
  );
  return Object.fromEntries(entries);
}

router.get('/', async (req, res) => {
  try {
    const includeRetired = req.query.includeRetired === 'true';
    const where = includeRetired ? {} : { status: { not: 'retired' } };
    const versions = await prisma.taxonomyVersion.findMany({
      where,
      orderBy: { releasedAt: { sort: 'desc', nulls: 'first' } },
    });
    return res.json({ versions });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:tag', async (req, res) => {
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: req.params.tag } });
    if (!version) return sendError(res, 404, 'NOT_FOUND', 'Version not found', { tag: req.params.tag });
    const counts = await snapshotCounts(version.id);
    return res.json({ version, counts });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const tag = validateTag(req.body);
    const description = assertString(req.body.description, 'description') ?? null;

    const existingDraft = await prisma.taxonomyVersion.findFirst({ where: { status: 'draft' } });
    if (existingDraft) {
      return sendError(res, 409, 'DRAFT_EXISTS', `A draft (${existingDraft.tag}) already exists; release or delete it first`);
    }

    let created;
    try {
      created = await prisma.taxonomyVersion.create({ data: { tag, description, status: 'draft' } });
    } catch (err) {
      if (err.code === 'P2002') return sendError(res, 409, 'TAG_EXISTS', 'Version tag already exists', { tag });
      throw err;
    }

    await logAudit(req, 'TaxonomyVersion', created.id, 'CREATE', { tag, status: 'draft' });
    return res.status(201).json({ version: created });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:tag/release', requireAdmin, async (req, res) => {
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: req.params.tag } });
    if (!version) return sendError(res, 404, 'NOT_FOUND', 'Version not found', { tag: req.params.tag });
    if (version.status !== 'draft') {
      return sendError(res, 409, 'INVALID_STATE', `Only a draft can be released (status=${version.status})`);
    }
    const releasedBy = req.user || null;
    const counts = await prisma.$transaction(async (tx) => {
      const c = await snapshotAllMasters(tx, version.id);
      await tx.taxonomyVersion.update({
        where: { id: version.id },
        data: { status: 'released', releasedAt: new Date(), releasedBy },
      });
      return c;
    });
    const updated = await prisma.taxonomyVersion.findUnique({ where: { id: version.id } });
    await logAudit(req, 'TaxonomyVersion', version.id, 'UPDATE', { tag: version.tag, status: 'released', counts });
    return res.json({ version: updated, counts });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:tag/retire', requireAdmin, async (req, res) => {
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: req.params.tag } });
    if (!version) return sendError(res, 404, 'NOT_FOUND', 'Version not found', { tag: req.params.tag });
    if (version.status !== 'released') {
      return sendError(res, 409, 'INVALID_STATE', `Only a released version can be retired (status=${version.status})`);
    }
    const updated = await prisma.taxonomyVersion.update({ where: { id: version.id }, data: { status: 'retired' } });
    await logAudit(req, 'TaxonomyVersion', version.id, 'UPDATE', { tag: version.tag, status: 'retired' });
    return res.json({ version: updated });
  } catch (error) {
    return handleError(res, error);
  }
});

router.delete('/:tag', requireAdmin, async (req, res) => {
  try {
    const version = await prisma.taxonomyVersion.findUnique({ where: { tag: req.params.tag } });
    if (!version) return sendError(res, 404, 'NOT_FOUND', 'Version not found', { tag: req.params.tag });
    if (version.status !== 'draft') {
      return sendError(res, 409, 'INVALID_STATE', `Only a draft can be deleted (status=${version.status})`);
    }
    await prisma.taxonomyVersion.delete({ where: { id: version.id } });
    await logAudit(req, 'TaxonomyVersion', version.id, 'DELETE', { tag: version.tag, status: version.status });
    return res.json({ success: true, tag: version.tag });
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
