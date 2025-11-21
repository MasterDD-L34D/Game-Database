const express = require('express');
const prisma = require('../db/prisma');
const { requireTaxonomyWrite } = require('../middleware/permissions');

const router = express.Router();

const DEFAULT_CATEGORY = 'baseline';
const TRAIT_DATA_FIELDS = ['value', 'num', 'bool', 'text', 'unit', 'source', 'confidence'];
const ALLOWED_FIELDS_BY_TYPE = {
  BOOLEAN: ['bool'],
  NUMERIC: ['num', 'confidence', 'unit'],
  CATEGORICAL: ['value', 'text'],
  TEXT: ['text', 'source'],
};

function normalizeId(value) {
  if (value == null) return '';
  const normalized = String(value).trim();
  return normalized;
}

function normalizeCategory(value, fallback = DEFAULT_CATEGORY) {
  if (value === undefined) return fallback;
  if (value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function normalizeNumber(value, fieldName) {
  if (value === undefined) return { skip: true };
  if (value === null) return { value: null };
  const numValue = Number(value);
  if (!Number.isFinite(numValue)) {
    return { error: `Invalid value for field "${fieldName}"` };
  }
  return { value: numValue };
}

function normalizeBoolean(value) {
  if (value === undefined) return { skip: true };
  if (value === null) return { value: null };
  if (value === true || value === false) return { value };
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return { value: true };
    if (normalized === 'false') return { value: false };
  }
  return { error: 'Invalid value for field "bool"' };
}

function normalizeString(value, fieldName, { allowEmpty = true } = {}) {
  if (value === undefined) return { skip: true };
  if (value === null) return { value: null };
  if (typeof value !== 'string') {
    return { error: `Invalid value for field "${fieldName}"` };
  }
  const normalized = value.trim();
  if (!allowEmpty && normalized === '') {
    return { error: `Invalid value for field "${fieldName}"` };
  }
  return { value: normalized };
}

function normalizeTraitFieldValue(dataType, field, value) {
  switch (dataType) {
    case 'NUMERIC': {
      if (field === 'num' || field === 'confidence') {
        return normalizeNumber(value, field);
      }
      if (field === 'unit') {
        return normalizeString(value, field);
      }
      break;
    }
    case 'BOOLEAN':
      return normalizeBoolean(value);
    case 'CATEGORICAL': {
      if (field === 'value') return normalizeString(value, field, { allowEmpty: false });
      if (field === 'text') return normalizeString(value, field, { allowEmpty: false });
      break;
    }
    case 'TEXT': {
      if (field === 'text' || field === 'source') return normalizeString(value, field);
      break;
    }
    default:
      break;
  }
  return { error: 'Unsupported trait data type' };
}

function collectWritableFields(body, allowedFields, trait) {
  const data = {};
  const allowedSet = allowedFields ? new Set(allowedFields) : null;

  for (const field of TRAIT_DATA_FIELDS) {
    if (!(field in body)) continue;
    if (allowedSet && !allowedSet.has(field)) continue;
    const normalized = normalizeTraitFieldValue(trait.dataType, field, body[field]);
    if (normalized.skip) continue;
    if (normalized.error) return { error: normalized.error };
    data[field] = normalized.value;
  }

  return { data };
}

function validateTraitData(body, trait) {
  const allowedFields = ALLOWED_FIELDS_BY_TYPE[trait?.dataType];
  if (!allowedFields) {
    return { error: 'Unsupported trait data type' };
  }

  const allowedSet = new Set(allowedFields);
  const invalidFields = TRAIT_DATA_FIELDS.filter(
    key => key in body && !allowedSet.has(key),
  );

  if (invalidFields.length) {
    return {
      error: `Fields not allowed for trait type ${trait.dataType}: ${invalidFields.join(', ')}`,
    };
  }

  const collected = collectWritableFields(body, allowedFields, trait);
  if (collected.error) return collected;

  if (!Object.keys(collected.data).length) {
    const requiredFields = allowedFields.join('/');
    return {
      error: `Provide value for ${trait.dataType.toLowerCase()} trait: ${requiredFields}`,
    };
  }

  if (trait.dataType === 'CATEGORICAL') {
    const allowedValues =
      Array.isArray(trait.allowedValues) && trait.allowedValues.length
        ? trait.allowedValues
            .filter(value => typeof value === 'string')
            .map(value => value.trim())
            .filter(Boolean)
        : null;

    if (!allowedValues || allowedValues.length === 0) {
      return { error: 'allowedValues is required for categorical traits' };
    }

    const allowedSet = new Set(allowedValues);
    for (const field of ['value', 'text']) {
      if (field in collected.data && collected.data[field] !== undefined) {
        const fieldValue = collected.data[field];
        if (fieldValue != null && !allowedSet.has(fieldValue)) {
          return {
            error: `Invalid ${field} for categorical trait. Allowed values: ${allowedValues.join(
              ', ',
            )}`,
          };
        }
      }
    }
  }

  return collected;
}

async function buildTraitPayload(body, existing = {}) {
  const speciesId = normalizeId('speciesId' in body ? body.speciesId : existing.speciesId);
  if (!speciesId) return { error: 'speciesId is required' };

  const traitId = normalizeId('traitId' in body ? body.traitId : existing.traitId);
  if (!traitId) return { error: 'traitId is required' };

  const validation = await ensureSpeciesAndTrait(speciesId, traitId);
  if (validation.error) return { error: validation.error };

  const traitValidation = validateTraitData(body, validation.trait);
  if (traitValidation.error) return { error: traitValidation.error };

  const category =
    'category' in body
      ? normalizeCategory(body.category)
      : existing.category || DEFAULT_CATEGORY;

  return {
    speciesId,
    traitId,
    category,
    trait: validation.trait,
    data: traitValidation.data,
  };
}

function buildFilter(query = {}) {
  const where = {};
  if (query.speciesId) where.speciesId = String(query.speciesId);
  if (query.traitId) where.traitId = String(query.traitId);
  if (query.category) where.category = String(query.category);
  return where;
}

async function ensureSpeciesAndTrait(speciesId, traitId) {
  const [species, trait] = await Promise.all([
    prisma.species.findUnique({ where: { id: speciesId } }),
    prisma.trait.findUnique({ where: { id: traitId } }),
  ]);

  if (!species) {
    return { error: 'Invalid speciesId' };
  }
  if (!trait) {
    return { error: 'Invalid traitId' };
  }
  return { species, trait };
}

router.get('/', async (req, res) => {
  const where = buildFilter(req.query);
  const items = await prisma.speciesTrait.findMany({
    where,
    orderBy: [
      { speciesId: 'asc' },
      { traitId: 'asc' },
      { category: 'asc' },
    ],
  });
  res.json(items);
});

router.post('/', requireTaxonomyWrite, async (req, res) => {
  try {
    const payload = await buildTraitPayload(req.body);
    if (payload.error) return res.status(400).json({ error: payload.error });

    const { speciesId, traitId, category, data } = payload;

    const existing = await prisma.speciesTrait.findFirst({
      where: { speciesId, traitId, category },
    });
    if (existing) return res.status(409).json({ error: 'Species trait already exists' });

    const created = await prisma.speciesTrait.create({
      data: {
        speciesId,
        traitId,
        category,
        ...data,
      },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.patch('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const existing = await prisma.speciesTrait.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const payload = await buildTraitPayload(req.body, existing);
    if (payload.error) return res.status(400).json({ error: payload.error });

    const { speciesId, traitId, category, data } = payload;

    const duplicate = await prisma.speciesTrait.findFirst({
      where: { speciesId, traitId, category },
    });
    if (duplicate && duplicate.id !== existing.id) {
      return res.status(409).json({ error: 'Species trait already exists' });
    }

    const updated = await prisma.speciesTrait.update({
      where: { id: existing.id },
      data: {
        speciesId,
        traitId,
        category,
        ...data,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/:id', requireTaxonomyWrite, async (req, res) => {
  try {
    const existing = await prisma.speciesTrait.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.speciesTrait.delete({ where: { id: existing.id } });

    res.sendStatus(204);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
