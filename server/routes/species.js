const express = require('express');
const prisma = require('../db/prisma');
const { requireTaxonomyWrite } = require('../middleware/permissions');
const { logAudit } = require('../utils/audit');
const { findExistingByIdOrSlug } = require('../utils/taxonomyValidation');
const { AppError, sendError, handleError } = require('../utils/httpErrors');
const { assertPagination, assertIdParam, assertString } = require('../utils/validation');

const router = express.Router();

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
  const { page, pageSize } = assertPagination(req.query);
  const where = buildWhere(req);
  const [total, items] = await Promise.all([
    prisma.species.count({ where }),
    prisma.species.findMany({ where, skip: page * pageSize, take: pageSize, orderBy: { scientificName: 'asc' } }),
  ]);
  return { items, page, pageSize, total };
}

async function fetchSpeciesDetail(identifier, res) {
  const item = await findExistingByIdOrSlug(prisma.species, identifier, res, 'Species not found');
  if (!item) return null;

  const [traits, biomes, ecosystems] = await Promise.all([
    prisma.speciesTrait.findMany({
      where: { speciesId: item.id },
      orderBy: [{ category: 'asc' }, { traitId: 'asc' }],
    }),
    prisma.speciesBiome.findMany({
      where: { speciesId: item.id },
      orderBy: [{ presence: 'asc' }, { biomeId: 'asc' }],
    }),
    prisma.ecosystemSpecies.findMany({
      where: { speciesId: item.id },
      orderBy: [{ role: 'asc' }, { ecosystemId: 'asc' }],
    }),
  ]);

  const traitIds = [...new Set(traits.map((entry) => entry.traitId).filter(Boolean))];
  const biomeIds = [...new Set(biomes.map((entry) => entry.biomeId).filter(Boolean))];
  const ecosystemIds = [...new Set(ecosystems.map((entry) => entry.ecosystemId).filter(Boolean))];

  const [traitRecords, biomeRecords, ecosystemRecords] = await Promise.all([
    traitIds.length ? prisma.trait.findMany({ where: { id: { in: traitIds } }, orderBy: { name: 'asc' } }) : [],
    biomeIds.length ? prisma.biome.findMany({ where: { id: { in: biomeIds } }, orderBy: { name: 'asc' } }) : [],
    ecosystemIds.length ? prisma.ecosystem.findMany({ where: { id: { in: ecosystemIds } }, orderBy: { name: 'asc' } }) : [],
  ]);

  const traitsById = new Map(traitRecords.map((entry) => [entry.id, entry]));
  const biomesById = new Map(biomeRecords.map((entry) => [entry.id, entry]));
  const ecosystemsById = new Map(ecosystemRecords.map((entry) => [entry.id, entry]));

  return {
    ...item,
    traits: traits.map((entry) => ({ ...entry, trait: traitsById.get(entry.traitId) ?? null })),
    biomes: biomes.map((entry) => ({ ...entry, biome: biomesById.get(entry.biomeId) ?? null })),
    ecosystems: ecosystems.map((entry) => ({ ...entry, ecosystem: ecosystemsById.get(entry.ecosystemId) ?? null })),
    relationCounts: {
      traits: traits.length,
      biomes: biomes.length,
      ecosystems: ecosystems.length,
    },
  };
}

function normalizeSlug(input) {
  if (!input) return '';
  return input.toString().trim().toLowerCase().replace(/\s+/g, '-');
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

function validateSpeciesPayload(body) {
  const scientificName = assertString(body.scientificName, 'scientificName', { required: true });
  const slug = normalizeSlug(body.slug || body.commonName || scientificName);
  if (!slug) {
    throw new AppError(400, 'VALIDATION_ERROR', 'slug is required', { field: 'slug', location: 'body' });
  }
  return { scientificName, slug };
}

router.get('/', async (req, res) => {
  try {
    const payload = await fetchPaginatedSpecies(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const item = await fetchSpeciesDetail(id, res);
    if (!item) return null;
    return res.json(item);
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/', requireTaxonomyWrite, async (req, res) => {
  try {
    const validated = validateSpeciesPayload(req.body);
    const existingSlug = await prisma.species.findUnique({ where: { slug: validated.slug } });
    if (existingSlug) return sendError(res, 409, 'CONFLICT', 'Slug already exists', { field: 'slug', value: validated.slug });

    const created = await prisma.species.create({ data: mapSpeciesData(req.body, validated.slug, validated.scientificName) });
    await logAudit(req, 'Species', created.id, 'CREATE', created);

    const payload = await fetchPaginatedSpecies(req);
    return res.status(201).json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.put('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const existing = await findExistingByIdOrSlug(prisma.species, id, res, 'Species not found');
    if (!existing) return null;

    const validated = validateSpeciesPayload(req.body);
    if (validated.slug !== existing.slug) {
      const existingSlug = await prisma.species.findUnique({ where: { slug: validated.slug } });
      if (existingSlug && existingSlug.id !== existing.id) {
        return sendError(res, 409, 'CONFLICT', 'Slug already exists', { field: 'slug', value: validated.slug });
      }
    }

    const updated = await prisma.species.update({
      where: { id: existing.id },
      data: mapSpeciesData(req.body, validated.slug, validated.scientificName),
    });

    await logAudit(req, 'Species', updated.id, 'UPDATE', req.body);

    const payload = await fetchPaginatedSpecies(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

router.delete('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const id = assertIdParam(req.params);
    const existing = await findExistingByIdOrSlug(prisma.species, id, res, 'Species not found');
    if (!existing) return null;

    await prisma.species.delete({ where: { id: existing.id } });
    await logAudit(req, 'Species', existing.id, 'DELETE', existing);

    const payload = await fetchPaginatedSpecies(req);
    return res.json(payload);
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
