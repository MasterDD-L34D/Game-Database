#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const fg = require('fast-glob');
const matter = require('gray-matter');
const yaml = require('js-yaml');
const { parse: parseCsv } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
const Ajv = require('ajv');
const { normalizeSlug } = require('../../utils/slug');

const prisma = new PrismaClient();
const ajv = new Ajv({ allErrors: true, coerceTypes: false });
const args = process.argv.slice(2);
const ROLE_VALUES = ['keystone', 'dominant', 'engineer', 'common', 'invasive', 'other'];
const PRESENCE_VALUES = ['resident', 'migrant', 'introduced', 'endemic', 'unknown'];
const TRAIT_TYPES = ['BOOLEAN', 'NUMERIC', 'CATEGORICAL', 'TEXT'];
const BATCH_SIZE = 50;

const validateNormalizedTrait = ajv.compile({
  type: 'object',
  required: ['slug', 'name', 'dataType'],
  properties: {
    slug: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    dataType: { type: 'string', enum: TRAIT_TYPES },
  },
});
const validateNormalizedBiome = ajv.compile({
  type: 'object',
  required: ['slug', 'name'],
  properties: {
    slug: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
  },
});
const validateNormalizedSpecies = ajv.compile({
  type: 'object',
  required: ['slug', 'scientificName'],
  properties: {
    slug: { type: 'string', minLength: 1 },
    scientificName: { type: 'string', minLength: 1 },
  },
});
const validateNormalizedEcosystem = ajv.compile({
  type: 'object',
  required: ['slug', 'name'],
  properties: {
    slug: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
  },
});

// Pure helper for CLI arg parsing — exported for unit tests.
// Supports both `--flag value` and `--flag=value` forms (Codex P1 fix
// from PR #125 review: documented `--fail-on=errors|schema|any` form
// was not parsed by space-separated lookup, silently fell back to
// default and could fail CI unexpectedly).
function parseFlagFromArgs(argv, name, def) {
  const prefix = `--${name}=`;
  const inlineIdx = argv.findIndex((a) => typeof a === 'string' && a.startsWith(prefix));
  if (inlineIdx >= 0) {
    return argv[inlineIdx].slice(prefix.length);
  }
  const index = argv.indexOf(`--${name}`);
  if (index < 0) return def;
  const next = argv[index + 1];
  if (next && !next.startsWith('--')) return next;
  return true;
}

function arg(name, def) {
  return parseFlagFromArgs(args, name, def);
}

const repoRoot = path.resolve(arg('repo', process.cwd()));
const validateOnly = !!arg('validate-only', false);
// --validate-only implies --dry-run (no DB writes) per spec PR-ε Q4 resolved.
const dryRun = validateOnly || !!arg('dry-run', false);
const verbose = !!arg('verbose', false);
const warnOnly = !!arg('warn-only', false);
const failOnRaw = arg('fail-on', 'errors,schema');
const failOn = String(failOnRaw)
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const configPath = arg('config', null);
const defaultConfig = {
  species: [
    'packs/evo_tactics_pack/docs/catalog/species/**/*.json',
    'packs/evo_tactics_pack/docs/catalog/catalog_data.json',
  ],
  traits: [
    'data/core/traits/glossary.json',
    'packs/evo_tactics_pack/docs/catalog/trait_glossary.json',
    'packs/evo_tactics_pack/docs/catalog/trait_reference.json',
    'packs/evo_tactics_pack/docs/catalog/env_traits.json',
  ],
  biomes: [
    'packs/evo_tactics_pack/docs/catalog/catalog_data.json',
    'packs/evo_tactics_pack/data/ecosystems/*.biome.yaml',
  ],
  ecosystems: [
    'packs/evo_tactics_pack/docs/catalog/catalog_data.json',
    'packs/evo_tactics_pack/data/ecosystems/*.ecosystem.yaml',
  ],
};

// Use shared normalizeSlug from server/utils/slug (canonical contract,
// includes max-80 truncation). Backward-compat alias preserves call sites.
const slugify = (value) => normalizeSlug(value);

function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, 'utf-8');
  if (ext === '.json') return JSON.parse(raw);
  if (ext === '.yaml' || ext === '.yml') return yaml.load(raw);
  if (ext === '.md') {
    const parsed = matter(raw);
    const data = parsed.data || {};
    if (parsed.content?.trim()) data.description = data.description ? `${data.description}\n${parsed.content.trim()}` : parsed.content.trim();
    return data;
  }
  if (ext === '.csv') return parseCsv(raw, { columns: true, skip_empty_lines: true });
  return null;
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function pickText(...values) {
  for (const value of values) if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function humanizeIdentifier(value) {
  if (value == null) return null;
  const normalized = String(value).trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return normalized || null;
}

function normalizeLabelList(values, maxItems = 5) {
  return asArray(values)
    .map((value) => humanizeIdentifier(value))
    .filter(Boolean)
    .slice(0, maxItems);
}

function safeNumber(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function summarizeClimate(climate) {
  if (!climate || typeof climate !== 'object') return null;
  const parts = [];
  const koppen = pickText(climate.classificazione_koppen, climate.koppen, climate.biome_class, climate.biome_profile);
  const meanTemp = safeNumber(climate.temperatura_C?.media_annua ?? climate.temperature_C?.media_annua ?? climate.temperature?.mean);
  const rain = safeNumber(climate.precipitazioni_mm?.totale_annuo ?? climate.precipitation_mm?.totale_annuo ?? climate.precipitation?.annual);
  const note = pickText(climate.precipitazioni_mm?.indice_stagionalita, climate.vento?.regime, climate.note);
  if (koppen) parts.push(`Koppen: ${koppen}`);
  if (meanTemp != null) parts.push(`T media: ${meanTemp} C`);
  if (rain != null) parts.push(`Pioggia: ${rain} mm/anno`);
  if (note) parts.push(note);
  return parts.length ? parts.join(' | ') : null;
}

function buildBiomeDescription(record) {
  const parts = [];
  const note = pickText(record.description, record.descrizione, record.ecosistema?.bioma?.note, record.ecosistema?.note);
  const ecoregion = pickText(record.ecosistema?.bioma?.ecoregione, record.ecoregion, record.biome_profile);
  const groups = asArray(record.manifest?.functional_groups_present);
  if (note) parts.push(note);
  if (ecoregion) parts.push(`Ecoregione: ${ecoregion}`);
  if (groups.length) parts.push(`Gruppi funzionali: ${groups.slice(0, 5).join(', ')}`);
  return parts.length ? parts.join(' | ') : null;
}

function isEventSpecies(record) {
  const displayName = pickText(record.display_name, record.name, record.label);
  return Boolean(
    record.flags?.event ||
      (typeof record.role_trofico === 'string' && record.role_trofico.includes('evento')) ||
      (displayName && displayName.toLowerCase().startsWith('evento:')),
  );
}

function inferTaxonomyFromScientificName(scientificName) {
  if (!scientificName || typeof scientificName !== 'string') return { genus: null, epithet: null };
  const tokens = scientificName.trim().split(/\s+/);
  if (tokens.length < 2) return { genus: null, epithet: null };
  const [first, second] = tokens;
  if (/^[A-Z][a-z-]+$/.test(first) && /^[a-z][a-z-]+$/.test(second)) {
    return { genus: first, epithet: second };
  }
  return { genus: null, epithet: null };
}

function buildSpeciesDescription(record, scientificName) {
  const rawDescription = pickText(record.description, record.descrizione, record.summary, record.story);
  if (rawDescription && !rawDescription.startsWith('i18n:')) return rawDescription;

  const parts = [];
  const role = humanizeIdentifier(pickText(record.role_trofico));
  const morphotype = humanizeIdentifier(pickText(record.morphotype));
  const biomeLabels = normalizeLabelList(record.biomes || record.biomi, 3);
  const tags = normalizeLabelList(record.functional_tags, 4);
  const hazards = normalizeLabelList(record.hazards_expected, 3);

  if (role) parts.push(`Ruolo trofico: ${role}`);
  if (morphotype) parts.push(`Morfotipo: ${morphotype}`);
  if (biomeLabels.length) parts.push(`Biomi: ${biomeLabels.join(', ')}`);
  if (tags.length) parts.push(`Tag funzionali: ${tags.join(', ')}`);
  if (hazards.length) parts.push(`Hazard attesi: ${hazards.join(', ')}`);
  if (typeof record.playable_unit === 'boolean') {
    parts.push(`Unità giocabile: ${record.playable_unit ? 'sì' : 'no'}`);
  }

  if (!parts.length && rawDescription) return rawDescription;
  if (!parts.length) return scientificName ? `Specie importata dal catalogo Game: ${scientificName}.` : null;
  return `${parts.join('. ')}.`;
}

function extractMapRecords(container, key) {
  const map = container?.[key];
  if (!map || Array.isArray(map) || typeof map !== 'object') return [];
  return Object.entries(map).map(([slug, value]) => ({ slug, ...(value && typeof value === 'object' ? value : { value }) }));
}

function expandDomainRecords(domain, filePath, data) {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (domain === 'traits') {
    const mapped = extractMapRecords(data, 'traits');
    if (mapped.length) return mapped;
    if (Array.isArray(data.rules)) {
      return data.rules.flatMap((rule, index) =>
        asArray(rule?.suggest?.traits)
          .map((rawTrait) => {
            if (typeof rawTrait === 'string') {
              return { slug: rawTrait, name: humanizeIdentifier(rawTrait), sourceRuleIndex: index };
            }
            if (rawTrait && typeof rawTrait === 'object') {
              const derivedSlug = pickText(rawTrait.slug, rawTrait.id, rawTrait.key, rawTrait.trait, rawTrait.name, rawTrait.label);
              if (!derivedSlug) return null;
              return {
                ...rawTrait,
                slug: derivedSlug,
                name: pickText(rawTrait.name, rawTrait.label, rawTrait.nome, humanizeIdentifier(derivedSlug)),
                sourceRuleIndex: index,
              };
            }
            return null;
          })
          .filter(Boolean),
      );
    }
  }
  if (domain === 'biomes') {
    if (Array.isArray(data.biomi)) return data.biomi;
    if (Array.isArray(data.biomes)) return data.biomes;
    if (data.ecosistema?.bioma || filePath.endsWith('.biome.yaml')) return [data];
  }
  if (domain === 'species') {
    if (Array.isArray(data.species)) return data.species;
    if (Array.isArray(data.specie)) return data.specie;
    if (Array.isArray(data.biomi)) return data.biomi.flatMap((biome) => asArray(biome?.species).map((species) => ({ ...species, biomes: species?.biomes || [biome.id || biome.label].filter(Boolean) })));
    const mapped = extractMapRecords(data, 'species');
    if (mapped.length) return mapped;
  }
  if (domain === 'ecosystems') {
    if (data.ecosistema) return [data];
    if (Array.isArray(data.ecosystems)) return data.ecosystems;
    const mapped = extractMapRecords(data, 'ecosystems');
    if (mapped.length) return mapped;
  }
  for (const key of ['items', 'entries', 'data']) if (Array.isArray(data[key])) return data[key];
  return [data];
}

function classifySource(filePath) {
  if (filePath.endsWith('data/core/traits/glossary.json')) return 'core_glossary';
  if (filePath.endsWith('trait_glossary.json')) return 'pack_glossary';
  if (filePath.endsWith('trait_reference.json')) return 'pack_reference';
  return 'env_or_other';
}

function mergeTraitRecords(records) {
  if (!records || records.length === 0) return null;

  const getRank = (cls, ranks) => {
    const idx = ranks.indexOf(cls);
    return idx === -1 ? 0 : ranks.length - idx;
  };

  const EDITORIAL_RANKS = ['core_glossary', 'pack_glossary', 'pack_reference', 'env_or_other'];
  const MECHANICS_RANKS = ['pack_reference', 'pack_glossary', 'core_glossary', 'env_or_other'];
  
  const merged = { ...records[0].record };
  merged.sourceFiles = [];
  
  const sourceSet = new Set();
  
  let bestEditorial = null;
  let bestEditorialRank = -1;
  let bestMechanicsRank = -1;
  
  // Track fields individually since a higher rank source might have a null value,
  // but we shouldn't overwrite a non-null value with null, though wait! The spec says:
  // "Higher rank wins even when lower rank is non-null; null/undefined never overwrites a value."
  // So if rank is higher AND value is not null, it wins.

  const currentValues = {
    editorial: { name: null, nameEn: null, description: null, descriptionEn: null },
    mechanics: { tier: null, familyType: null, energyMaintenance: null, slotProfile: null, usageTags: null, synergies: null, conflicts: null, environmentalRequirements: null, inducedMutation: null, functionalUse: null, selectiveDrive: null, weakness: null },
    other: { slug: null, dataType: null, allowedValues: null, rangeMin: null, rangeMax: null, category: null, unit: null },
    extrasRanks: {},
  };
  
  const currentRanks = {
    editorial: { name: -1, nameEn: -1, description: -1, descriptionEn: -1 },
    mechanics: { tier: -1, familyType: -1, energyMaintenance: -1, slotProfile: -1, usageTags: -1, synergies: -1, conflicts: -1, environmentalRequirements: -1, inducedMutation: -1, functionalUse: -1, selectiveDrive: -1, weakness: -1 }
  };

  const currentPlaceholder = { name: true, nameEn: true };

  let bestSourceKey = null;
  let bestSourceKeyRank = -1;
  const mergedExtras = {};

  for (const { record, sourceClass } of records) {
    sourceSet.add(sourceClass);
    const edRank = getRank(sourceClass, EDITORIAL_RANKS);
    const mechRank = getRank(sourceClass, MECHANICS_RANKS);
    
    // Editorial fields
    for (const field of ['name', 'nameEn', 'description', 'descriptionEn']) {
      if (record[field] != null) {
        if (field === 'name' || field === 'nameEn') {
          const isPlaceholder = slugify(record[field]) === record.slug;
          const currPlaceholder = currentPlaceholder[field];
          
          if (
            (currPlaceholder && !isPlaceholder) ||
            (isPlaceholder === currPlaceholder && edRank > currentRanks.editorial[field])
          ) {
            currentValues.editorial[field] = record[field];
            currentRanks.editorial[field] = edRank;
            currentPlaceholder[field] = isPlaceholder;
          }
        } else {
          if (edRank > currentRanks.editorial[field]) {
            currentValues.editorial[field] = record[field];
            currentRanks.editorial[field] = edRank;
          }
        }
      }
    }
    
    // SourceKey from highest editorial source that has one
    if (record.sourceKey != null && edRank > bestSourceKeyRank) {
      bestSourceKey = record.sourceKey;
      bestSourceKeyRank = edRank;
    }

    // Mechanics fields
    for (const field of ['tier', 'familyType', 'energyMaintenance', 'slotProfile', 'usageTags', 'synergies', 'conflicts', 'environmentalRequirements', 'inducedMutation', 'functionalUse', 'selectiveDrive', 'weakness']) {
      if (record[field] != null && mechRank > currentRanks.mechanics[field]) {
        currentValues.mechanics[field] = record[field];
        currentRanks.mechanics[field] = mechRank;
      }
    }
    
    // Other fields (first non-null)
    for (const field of ['slug', 'dataType', 'allowedValues', 'rangeMin', 'rangeMax', 'category', 'unit']) {
      if (currentValues.other[field] == null && record[field] != null) {
        currentValues.other[field] = record[field];
      }
    }

    // sourceExtras per-field mechanics precedence
    if (record.sourceExtras && typeof record.sourceExtras === 'object') {
      for (const [key, val] of Object.entries(record.sourceExtras)) {
        if (val != null) {
          const currentRank = currentValues.extrasRanks[key] ?? -1;
          if (mechRank > currentRank) {
            mergedExtras[key] = val;
            currentValues.extrasRanks[key] = mechRank;
          }
        }
      }
    }
  }
  
  merged.sourceFiles = Array.from(sourceSet).sort();
  merged.sourceKey = bestSourceKey;
  
  Object.assign(merged, currentValues.editorial);
  Object.assign(merged, currentValues.mechanics);
  Object.assign(merged, currentValues.other);
  merged.sourceExtras = Object.keys(mergedExtras).length > 0 ? mergedExtras : null;
  
  return merged;
}

const CONSUMED = new Set([
  'slug','_id','id','key','trait','name','label','label_it','label_en','name_en','nome','title',
  'description','description_it','description_en','descrizione','uso_funzione',
  'spinta_selettiva','debolezza','category','categoria','famiglia_tipologia','tier',
  'unit','unita','usage','min','max','rangeMin','rangeMax','range','balance','dataType','type',
  'kind','allowedValues','valori','default','usage_tags','tags','sinergie','synergies',
  'conflitti','conflicts','requisiti_ambientali',
  'fattore_mantenimento_energetico','energyMaintenance','slot_profile',
  'mutazione_indotta','inducedMutation','functionalUse','selectiveDrive','weakness',
  'sourceRuleIndex','value','origin','source','confidence','weight'
]);

function normalizeTrait(record) {
  if (!record || typeof record !== 'object') return null;
  const slugSource = pickText(record.slug, record._id, record.id, record.key, record.trait, record.name, record.label, record.label_it, record.label_en, record.nome, record.title);
  const slug = slugify(slugSource);
  const name = pickText(record.name, record.label, record.label_it, record.label_en, record.nome, record.title, record.trait, humanizeIdentifier(slugSource), humanizeIdentifier(slug));
  if (!slug || !name) return null;
  const allowedValues = Array.isArray(record.allowedValues || record.valori) ? record.allowedValues || record.valori : null;
  const rangeMin = safeNumber(record.min ?? record.rangeMin ?? record.range?.min ?? record.balance?.min);
  const rangeMax = safeNumber(record.max ?? record.rangeMax ?? record.range?.max ?? record.balance?.max);
  const rawType = String(record.dataType || record.type || record.kind || '').toUpperCase();
  let dataType = TRAIT_TYPES.includes(rawType) ? rawType : null;
  if (!dataType) {
    if (allowedValues?.length) dataType = 'CATEGORICAL';
    else if (rangeMin != null || rangeMax != null) dataType = 'NUMERIC';
    else if (typeof record.default === 'boolean') dataType = 'BOOLEAN';
    else dataType = 'TEXT';
  }
  const usageTags = asArray(record.usage_tags || record.tags).filter(Boolean);
  const synergies = asArray(record.sinergie || record.synergies).filter(Boolean);
  const conflicts = asArray(record.conflitti || record.conflicts).filter(Boolean);
  
  const sourceExtras = {};
  let hasExtras = false;
  for (const key of Object.keys(record)) {
    if (!CONSUMED.has(key)) {
      sourceExtras[key] = record[key];
      hasExtras = true;
    }
  }

  return {
    slug,
    sourceKey: pickText(record.slug, record._id, record.id, record.key) || null,
    name,
    description: pickText(record.description, record.description_it, record.description_en, record.descrizione, record.uso_funzione, record.spinta_selettiva, record.debolezza),
    nameEn: pickText(record.label_en, record.name_en),
    descriptionEn: pickText(record.description_en),
    category: pickText(record.category, record.categoria, record.famiglia_tipologia, record.slot_profile?.core, record.tier),
    unit: pickText(record.unit, record.unita, record.usage?.unit),
    dataType,
    allowedValues,
    rangeMin,
    rangeMax,
    tier: pickText(record.tier),
    familyType: pickText(record.famiglia_tipologia, record.familyType),
    energyMaintenance: pickText(record.fattore_mantenimento_energetico, record.energyMaintenance),
    slotProfile: record.slot_profile && typeof record.slot_profile === 'object' ? record.slot_profile : null,
    usageTags: usageTags.length ? usageTags : null,
    synergies: synergies.length ? synergies : null,
    conflicts: conflicts.length ? conflicts : null,
    environmentalRequirements: Array.isArray(record.requisiti_ambientali) ? record.requisiti_ambientali : null,
    inducedMutation: pickText(record.mutazione_indotta, record.inducedMutation),
    functionalUse: pickText(record.uso_funzione, record.functionalUse),
    selectiveDrive: pickText(record.spinta_selettiva, record.selectiveDrive),
    weakness: pickText(record.debolezza, record.weakness),
    sourceExtras: hasExtras ? sourceExtras : null,
  };
}

function extractBiomeRichFields(record) {
  const ecosystem = record.ecosistema || record;
  const climateTags = asArray(ecosystem.climate_tags || record.climate_tags).filter(Boolean);
  const hazardRaw = ecosystem.hazard || record.hazard;
  const ecologyRaw = ecosystem.ecology || ecosystem.ecologia || record.ecology;
  const roleTemplatesRaw = asArray(ecosystem.role_templates || record.role_templates).filter(Boolean);
  const size = ecosystem.size || record.size;
  return {
    summary: pickText(ecosystem.summary, record.summary),
    climateTags: climateTags.length ? climateTags : null,
    hazard: hazardRaw && typeof hazardRaw === 'object' ? hazardRaw : null,
    ecology: ecologyRaw && typeof ecologyRaw === 'object' ? ecologyRaw : null,
    roleTemplates: roleTemplatesRaw.length ? roleTemplatesRaw : null,
    sizeMin: safeNumber(size?.min),
    sizeMax: safeNumber(size?.max),
  };
}

function normalizeBiome(record, filePath) {
  if (!record || typeof record !== 'object') return null;
  if (record.ecosistema?.bioma || filePath.endsWith('.biome.yaml')) {
    const ecosystem = record.ecosistema || {};
    const slug = slugify(ecosystem.bioma?.classe_bioma || record.links?.biome_id || ecosystem.id || path.basename(filePath).replace(/\.biome\.ya?ml$/i, ''));
    const name = pickText(ecosystem.metadati?.nome, ecosystem.label, record.label, slug);
    if (!slug || !name) return null;
    return {
      slug,
      name,
      description: buildBiomeDescription(record),
      climate: summarizeClimate(ecosystem.clima || ecosystem.climate),
      parentSlug: null,
      ...extractBiomeRichFields(record),
    };
  }
  const slug = slugify(record.slug || record._id || record.id || record.network_id || record.label || record.name);
  const name = pickText(record.name, record.nome, record.label, slug);
  if (!slug || !name) return null;
  return {
    slug,
    name,
    description: buildBiomeDescription(record),
    climate: summarizeClimate(record.climate || record.clima || record.profile) || pickText(record.biome_profile),
    parentSlug: null,
    ...extractBiomeRichFields(record),
  };
}

function collectSpeciesTraits(record) {
  const entries = [];
  for (const raw of asArray(record.traits || record.tratti || record.caratteri)) {
    if (!raw) continue;
    if (typeof raw === 'string') {
      entries.push({ traitSlug: slugify(raw), traitName: raw, kind: 'TEXT', value: raw });
      continue;
    }
    const traitName = pickText(raw.trait, raw.name, raw.nome, raw.slug, raw.id);
    if (!traitName) continue;
    const value = raw.value ?? raw.valore ?? raw.val ?? raw.score ?? raw.rating ?? null;
    let kind = String(raw.kind || raw.type || '').toUpperCase();
    if (!TRAIT_TYPES.includes(kind)) {
      if (typeof value === 'number') kind = 'NUMERIC';
      else if (typeof value === 'boolean') kind = 'BOOLEAN';
      else if (Array.isArray(value)) kind = 'CATEGORICAL';
      else kind = 'TEXT';
    }
    entries.push({
      traitSlug: slugify(raw.slug || raw.id || traitName),
      traitName,
      kind,
      value,
      unit: pickText(raw.unit, raw.unita),
      category: pickText(raw.category, raw.categoria, raw.group),
      source: pickText(raw.source, raw.origin),
      confidence: safeNumber(raw.confidence ?? raw.weight),
    });
  }
  for (const traitSlug of [
    ...asArray(record.derived_from_environment?.traits),
    ...asArray(record.derived_from_environment?.suggested_traits),
    ...asArray(record.derived_from_environment?.optional_traits),
    ...asArray(record.genetic_traits?.core),
    ...asArray(record.genetic_traits?.optional),
  ]) {
    const slug = slugify(traitSlug);
    if (!slug) continue;
    entries.push({ traitSlug: slug, traitName: traitSlug, kind: 'TEXT', value: traitSlug, category: 'environment-derived', source: 'game:evo', confidence: null });
  }
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.traitSlug}:${entry.category || ''}`;
    if (!entry.traitSlug || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSpecies(record) {
  if (!record || typeof record !== 'object' || isEventSpecies(record)) return null;
  const scientificName = pickText(record.scientificName, record.scientific_name, record.binomial, record.nomeScientifico, record.display_name, record.name, record.id);
  const slug = slugify(record.slug || record._id || record.id || scientificName);
  if (!slug || !scientificName) return null;
  const inferredTaxonomy = inferTaxonomyFromScientificName(scientificName);
  const biomes = asArray(record.biomes || record.biomi || record.habitats || record.habitat).map((biome) => {
    if (!biome) return null;
    if (typeof biome === 'string') return { biomeSlug: slugify(biome), presence: 'resident', abundance: null };
    const biomeSlug = slugify(biome.slug || biome.id || biome._id || biome.name || biome.label || biome.biome);
    return {
      biomeSlug,
      presence: PRESENCE_VALUES.includes(String(biome.presence || biome.presenza || 'resident').toLowerCase()) ? String(biome.presence || biome.presenza || 'resident').toLowerCase() : 'resident',
      abundance: safeNumber(biome.abundance ?? biome.balance?.abundance),
    };
  }).filter(Boolean);
  if (!biomes.length && record.environment_affinity?.biome_class) biomes.push({ biomeSlug: slugify(record.environment_affinity.biome_class), presence: 'resident', abundance: null });
  const threatTier = pickText(record.balance?.threat_tier);
  const rarity = pickText(record.balance?.rarity);
  const derivedStatus = [threatTier, rarity].filter(Boolean).join(' / ') || null;
  return {
    slug,
    scientificName,
    commonName: pickText(record.commonName, record.nomeComune, record.vernacular, record.display_name, record.name),
    kingdom: pickText(record.kingdom, record.taxonomy?.kingdom),
    phylum: pickText(record.phylum, record.taxonomy?.phylum),
    class: pickText(record.class, record.classe, record.taxonomy?.class, record.taxonomy?.classe),
    order: pickText(record.order, record.ordine, record.taxonomy?.order, record.taxonomy?.ordine),
    family: pickText(record.family, record.famiglia, record.taxonomy?.family, record.taxonomy?.famiglia),
    genus: pickText(record.genus, record.taxonomy?.genus, inferredTaxonomy.genus),
    epithet: pickText(record.epithet, record.species, record.specie, record.taxonomy?.epithet, record.taxonomy?.species, inferredTaxonomy.epithet),
    status: pickText(record.status, record.iucn, record.flags?.category, derivedStatus),
    description: buildSpeciesDescription(record, scientificName),
    displayName: pickText(record.display_name, record.displayName),
    trophicRole: pickText(record.role_trofico, record.trophicRole),
    functionalTags: asArray(record.functional_tags || record.functionalTags).filter(Boolean) || null,
    flags: record.flags && typeof record.flags === 'object' ? record.flags : null,
    balance: record.balance && typeof record.balance === 'object' ? record.balance : null,
    playableUnit: typeof record.playable_unit === 'boolean' ? record.playable_unit : (typeof record.playableUnit === 'boolean' ? record.playableUnit : null),
    morphotype: pickText(record.morphotype),
    vcCoefficients: record.vc && typeof record.vc === 'object' ? record.vc : null,
    spawnRules: record.spawn_rules && typeof record.spawn_rules === 'object' ? record.spawn_rules : null,
    environmentAffinity: record.environment_affinity && typeof record.environment_affinity === 'object' ? record.environment_affinity : null,
    jobsBias: asArray(record.jobs_bias || record.jobsBias).filter(Boolean) || null,
    telemetry: record.telemetry && typeof record.telemetry === 'object' ? record.telemetry : null,
    traits: collectSpeciesTraits(record),
    biomes,
  };
}

function normalizeEcosystem(record, filePath) {
  if (!record || typeof record !== 'object') return null;
  const ecosystem = record.ecosistema || record;
  const slug = slugify(ecosystem.slug || ecosystem._id || ecosystem.id || ecosystem.label || ecosystem.nome || ecosystem.metadati?.nome || path.basename(filePath).replace(/\.ecosystem\.ya?ml$/i, ''));
  const name = pickText(ecosystem.name, ecosystem.nome, ecosystem.label, ecosystem.metadati?.nome, slug);
  if (!slug || !name) return null;
  const biomes = [];
  for (const biome of asArray(record.biomi || ecosystem.biomi)) {
    if (!biome) continue;
    biomes.push({ biomeSlug: slugify(biome.slug || biome.id || biome.network_id || biome.label), proportion: safeNumber(biome.proportion ?? biome.weight), notes: pickText(biome.label, biome.biome_profile) });
  }
  if (!biomes.length) {
    const biomeSlug = slugify(record.links?.biome_id || ecosystem.biome_id);
    if (biomeSlug) biomes.push({ biomeSlug, proportion: null, notes: null });
  }
  const species = [];
  if (Array.isArray(record.biomi)) {
    for (const biome of record.biomi) {
      for (const sp of asArray(biome?.species)) {
        if (!sp || isEventSpecies(sp)) continue;
        species.push({
          speciesSlug: slugify(sp.slug || sp.id || sp.display_name || sp.name),
          role: sp.flags?.keystone ? 'keystone' : sp.flags?.apex ? 'dominant' : 'common',
          abundance: null,
          notes: pickText(sp.display_name, sp.role_trofico),
        });
      }
    }
  } else {
    for (const consumer of asArray(ecosystem.trofico?.consumatori?.terziari)) {
      const slugValue = slugify(consumer);
      if (slugValue) species.push({ speciesSlug: slugValue, role: 'dominant', abundance: null, notes: null });
    }
  }
  const uniqueSpecies = new Map();
  for (const sp of species) if (sp.speciesSlug && !uniqueSpecies.has(sp.speciesSlug)) uniqueSpecies.set(sp.speciesSlug, sp);
  return {
    slug,
    name,
    description: pickText(ecosystem.description, ecosystem.descrizione, ecosystem.note, record.summary),
    region: pickText(ecosystem.region, ecosystem.regione, ecosystem.metadati?.localizzazione?.area, ecosystem.id),
    climate: summarizeClimate(ecosystem.clima || ecosystem.climate),
    biomes,
    species: [...uniqueSpecies.values()],
  };
}

function createDomainReport(name, files) {
  return { domain: name, files, read: 0, normalized: 0, complete: 0, partial: 0, upserted: 0, skipped: 0, errors: 0, skippedSamples: [], skipReasons: {} };
}

function noteSkip(report, message, reason = 'unclassified') {
  report.skipped += 1;
  report.skipReasons[reason] = (report.skipReasons[reason] || 0) + 1;
  if (report.skippedSamples.length < 10) report.skippedSamples.push(message);
  if (verbose) console.log(`[skip:${report.domain}] ${message}`);
}

function noteError(report, message) {
  report.errors += 1;
  if (report.skippedSamples.length < 10) report.skippedSamples.push(`ERROR: ${message}`);
  console.error(`[error:${report.domain}] ${message}`);
}

function assessCompleteness(domain, normalized) {
  if (!normalized || typeof normalized !== 'object') return 'partial';
  if (domain === 'traits') {
    return normalized.description && normalized.category ? 'complete' : 'partial';
  }
  if (domain === 'biomes') {
    return normalized.description && normalized.climate ? 'complete' : 'partial';
  }
  if (domain === 'species') {
    const hasTaxonomy = normalized.family || normalized.genus || normalized.order || normalized.class;
    const hasOperationalProfile = normalized.status || normalized.description;
    return normalized.commonName && (hasTaxonomy || hasOperationalProfile) ? 'complete' : 'partial';
  }
  if (domain === 'ecosystems') {
    return normalized.description && normalized.region && normalized.climate ? 'complete' : 'partial';
  }
  return 'partial';
}

function noteCompleteness(report, domain, normalized) {
  const bucket = assessCompleteness(domain, normalized);
  if (bucket === 'complete') report.complete += 1;
  else report.partial += 1;
}

function buildTraitUpsertArgs(normalized) {
  const isFallbackNameOnly =
    slugify(normalized.name) === normalized.slug &&
    !normalized.description &&
    !normalized.category &&
    !normalized.unit &&
    !(normalized.allowedValues && normalized.allowedValues.length) &&
    normalized.rangeMin == null &&
    normalized.rangeMax == null;
  const richCreate = {
    tier: normalized.tier ?? null,
    familyType: normalized.familyType ?? null,
    energyMaintenance: normalized.energyMaintenance ?? null,
    slotProfile: normalized.slotProfile ?? undefined,
    usageTags: normalized.usageTags ?? undefined,
    synergies: normalized.synergies ?? undefined,
    conflicts: normalized.conflicts ?? undefined,
    environmentalRequirements: normalized.environmentalRequirements ?? undefined,
    inducedMutation: normalized.inducedMutation ?? null,
    functionalUse: normalized.functionalUse ?? null,
    selectiveDrive: normalized.selectiveDrive ?? null,
    weakness: normalized.weakness ?? null,
  };
  const richUpdate = {
    tier: normalized.tier ?? undefined,
    familyType: normalized.familyType ?? undefined,
    energyMaintenance: normalized.energyMaintenance ?? undefined,
    slotProfile: normalized.slotProfile ?? undefined,
    usageTags: normalized.usageTags ?? undefined,
    synergies: normalized.synergies ?? undefined,
    conflicts: normalized.conflicts ?? undefined,
    environmentalRequirements: normalized.environmentalRequirements ?? undefined,
    inducedMutation: normalized.inducedMutation ?? undefined,
    functionalUse: normalized.functionalUse ?? undefined,
    selectiveDrive: normalized.selectiveDrive ?? undefined,
    weakness: normalized.weakness ?? undefined,
  };
  // Pure args builder (unit-testable); callers wrap it in prisma.trait.upsert.
  return {
    where: { slug: normalized.slug },
    create: {
      slug: normalized.slug,
      sourceKey: normalized.sourceKey ?? null,
      sourceFiles: normalized.sourceFiles ?? null,
      sourceExtras: normalized.sourceExtras ?? null,
      name: normalized.name,
      description: normalized.description ?? null,
      nameEn: normalized.nameEn ?? null,
      descriptionEn: normalized.descriptionEn ?? null,
      category: normalized.category ?? null,
      unit: normalized.unit ?? null,
      dataType: normalized.dataType,
      allowedValues: normalized.allowedValues ?? null,
      rangeMin: normalized.rangeMin ?? null,
      rangeMax: normalized.rangeMax ?? null,
      ...richCreate,
    },
    update: {
      sourceKey: normalized.sourceKey ?? undefined,
      // sourceFiles/sourceExtras: pass null THROUGH on update (no ?? undefined)
      // -- Codex P1 on #199: extras removed upstream must be erased, not left
      // stale (null ?? undefined would make Prisma skip the column). The merge
      // always yields null|value here, never undefined.
      sourceFiles: normalized.sourceFiles !== undefined ? normalized.sourceFiles : undefined,
      sourceExtras: normalized.sourceExtras !== undefined ? normalized.sourceExtras : undefined,
      name: isFallbackNameOnly ? undefined : normalized.name,
      description: normalized.description ?? undefined,
      nameEn: normalized.nameEn ?? undefined,
      descriptionEn: normalized.descriptionEn ?? undefined,
      category: normalized.category ?? undefined,
      unit: normalized.unit ?? undefined,
      dataType: normalized.dataType,
      allowedValues: normalized.allowedValues ?? undefined,
      rangeMin: normalized.rangeMin ?? undefined,
      rangeMax: normalized.rangeMax ?? undefined,
      ...richUpdate,
    },
  };
}

function buildBiomeUpsertArgs(normalized) {
  return prisma.biome.upsert({
    where: { slug: normalized.slug },
    create: {
      slug: normalized.slug, name: normalized.name, description: normalized.description, climate: normalized.climate,
      summary: normalized.summary ?? null, climateTags: normalized.climateTags ?? undefined,
      hazard: normalized.hazard ?? undefined, ecology: normalized.ecology ?? undefined,
      roleTemplates: normalized.roleTemplates ?? undefined,
      sizeMin: normalized.sizeMin ?? null, sizeMax: normalized.sizeMax ?? null,
    },
    update: {
      name: normalized.name, description: normalized.description, climate: normalized.climate,
      summary: normalized.summary ?? undefined, climateTags: normalized.climateTags ?? undefined,
      hazard: normalized.hazard ?? undefined, ecology: normalized.ecology ?? undefined,
      roleTemplates: normalized.roleTemplates ?? undefined,
      sizeMin: normalized.sizeMin ?? undefined, sizeMax: normalized.sizeMax ?? undefined,
    },
  });
}

function buildSpeciesUpsertArgs(normalized) {
  return prisma.species.upsert({
    where: { slug: normalized.slug },
    create: {
      slug: normalized.slug, scientificName: normalized.scientificName,
      commonName: normalized.commonName, kingdom: normalized.kingdom, phylum: normalized.phylum,
      class: normalized.class, order: normalized.order, family: normalized.family,
      genus: normalized.genus, epithet: normalized.epithet,
      status: normalized.status, description: normalized.description,
      displayName: normalized.displayName ?? null, trophicRole: normalized.trophicRole ?? null,
      functionalTags: normalized.functionalTags?.length ? normalized.functionalTags : undefined,
      flags: normalized.flags ?? undefined, balance: normalized.balance ?? undefined,
      playableUnit: normalized.playableUnit ?? null, morphotype: normalized.morphotype ?? null,
      vcCoefficients: normalized.vcCoefficients ?? undefined, spawnRules: normalized.spawnRules ?? undefined,
      environmentAffinity: normalized.environmentAffinity ?? undefined,
      jobsBias: normalized.jobsBias?.length ? normalized.jobsBias : undefined,
      telemetry: normalized.telemetry ?? undefined,
    },
    update: {
      scientificName: normalized.scientificName, commonName: normalized.commonName,
      kingdom: normalized.kingdom, phylum: normalized.phylum, class: normalized.class,
      order: normalized.order, family: normalized.family, genus: normalized.genus,
      epithet: normalized.epithet, status: normalized.status, description: normalized.description,
      displayName: normalized.displayName ?? undefined, trophicRole: normalized.trophicRole ?? undefined,
      functionalTags: normalized.functionalTags?.length ? normalized.functionalTags : undefined,
      flags: normalized.flags ?? undefined, balance: normalized.balance ?? undefined,
      playableUnit: normalized.playableUnit ?? undefined, morphotype: normalized.morphotype ?? undefined,
      vcCoefficients: normalized.vcCoefficients ?? undefined, spawnRules: normalized.spawnRules ?? undefined,
      environmentAffinity: normalized.environmentAffinity ?? undefined,
      jobsBias: normalized.jobsBias?.length ? normalized.jobsBias : undefined,
      telemetry: normalized.telemetry ?? undefined,
    },
  });
}

async function processTraits(items) {
  const t0 = performance.now();
  const report = createDomainReport('traits', items.length);
  
  const pendingBySlug = new Map();
  for (const item of items) {
    const sourceClass = classifySource(item.file);
    for (const record of expandDomainRecords('traits', item.file, item.data)) {
      report.read += 1;
      const normalized = normalizeTrait(record);
      if (!normalized) {
        noteSkip(report, `${path.basename(item.file)}: trait non normalizzabile`, 'trait_non_normalizzabile');
        continue;
      }
      if (!validateNormalizedTrait(normalized)) {
        noteSkip(report, `${path.basename(item.file)}: ${normalized.slug || '?'} schema validation failed`, 'schema_validation');
        continue;
      }
      report.normalized += 1;
      noteCompleteness(report, 'traits', normalized);
      
      if (!pendingBySlug.has(normalized.slug)) {
        pendingBySlug.set(normalized.slug, []);
      }
      pendingBySlug.get(normalized.slug).push({ record: normalized, sourceClass });
    }
  }
  
  const pending = [];
  for (const [slug, records] of pendingBySlug.entries()) {
    const merged = mergeTraitRecords(records);
    if (verbose) console.log(`Trait: ${merged.slug} (sources: ${merged.sourceFiles.join(', ')})`);
    pending.push(merged);
  }

  if (!dryRun) {
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      try {
        await prisma.$transaction(batch.map((n) => prisma.trait.upsert(buildTraitUpsertArgs(n))));
        report.upserted += batch.length;
      } catch (error) {
        for (const normalized of batch) {
          try {
            await prisma.trait.upsert(buildTraitUpsertArgs(normalized));
            report.upserted += 1;
          } catch (innerError) {
            noteError(report, `${normalized.slug}: ${innerError.message}`);
          }
        }
      }
      if (verbose && pending.length > BATCH_SIZE) {
        console.log(`[progress:traits] ${Math.min(i + BATCH_SIZE, pending.length)}/${pending.length} records`);
      }
    }
  } else {
    report.upserted = pending.length;
  }
  report.elapsed_ms = Math.round(performance.now() - t0);
  return report;
}

async function processBiomes(items) {
  const t0 = performance.now();
  const report = createDomainReport('biomes', items.length);
  const pending = [];
  const parentLinks = [];
  for (const item of items) {
    for (const record of expandDomainRecords('biomes', item.file, item.data)) {
      report.read += 1;
      const normalized = normalizeBiome(record, item.file);
      if (!normalized) {
        noteSkip(report, `${path.basename(item.file)}: bioma non normalizzabile`, 'bioma_non_normalizzabile');
        continue;
      }
      if (!validateNormalizedBiome(normalized)) {
        noteSkip(report, `${path.basename(item.file)}: ${normalized.slug || '?'} schema validation failed`, 'schema_validation');
        continue;
      }
      report.normalized += 1;
      noteCompleteness(report, 'biomes', normalized);
      if (verbose) console.log(`Biome: ${normalized.slug}`);
      pending.push(normalized);
    }
  }
  if (!dryRun) {
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      try {
        await prisma.$transaction(batch.map(buildBiomeUpsertArgs));
        report.upserted += batch.length;
        for (const normalized of batch) {
          if (normalized.parentSlug) parentLinks.push(normalized);
        }
      } catch (error) {
        for (const normalized of batch) {
          try {
            await buildBiomeUpsertArgs(normalized);
            report.upserted += 1;
            if (normalized.parentSlug) parentLinks.push(normalized);
          } catch (innerError) {
            noteError(report, `${normalized.slug}: ${innerError.message}`);
          }
        }
      }
      if (verbose && pending.length > BATCH_SIZE) {
        console.log(`[progress:biomes] ${Math.min(i + BATCH_SIZE, pending.length)}/${pending.length} records`);
      }
    }
    const slugsToFetch = new Set();
    for (const normalized of parentLinks) {
      slugsToFetch.add(normalized.slug);
      slugsToFetch.add(normalized.parentSlug);
    }

    const allRelevantBiomes = await prisma.biome.findMany({
      where: { slug: { in: Array.from(slugsToFetch) } },
    });

    const biomeMap = new Map();
    for (const b of allRelevantBiomes) {
      biomeMap.set(b.slug, b);
    }

    for (const normalized of parentLinks) {
      const parent = biomeMap.get(normalized.parentSlug);
      const current = biomeMap.get(normalized.slug);
      if (parent && current && current.parentId !== parent.id) {
        await prisma.biome.update({ where: { id: current.id }, data: { parentId: parent.id } });
        current.parentId = parent.id;
      }
    }
  } else {
    report.upserted = pending.length;
  }
  report.elapsed_ms = Math.round(performance.now() - t0);
  return report;
}

async function processSpecies(items) {
  const t0 = performance.now();
  const report = createDomainReport('species', items.length);
  const pending = [];
  for (const item of items) {
    for (const record of expandDomainRecords('species', item.file, item.data)) {
      report.read += 1;
      if (isEventSpecies(record)) {
        noteSkip(report, `${path.basename(item.file)}: specie evento ignorata`, 'specie_evento_ignorata');
        continue;
      }
      const normalized = normalizeSpecies(record);
      if (!normalized) {
        noteSkip(report, `${path.basename(item.file)}: specie non normalizzabile`, 'specie_non_normalizzabile');
        continue;
      }
      if (!validateNormalizedSpecies(normalized)) {
        noteSkip(report, `${path.basename(item.file)}: ${normalized.slug || '?'} schema validation failed`, 'schema_validation');
        continue;
      }
      report.normalized += 1;
      noteCompleteness(report, 'species', normalized);
      if (verbose) console.log(`Species: ${normalized.slug}`);
      pending.push(normalized);
    }
  }
  if (!dryRun) {
    // Phase A: batch upsert species master records
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      try {
        const results = await prisma.$transaction(batch.map(buildSpeciesUpsertArgs));
        for (let j = 0; j < batch.length; j++) {
          batch[j]._resolvedId = results[j].id;
        }
        report.upserted += batch.length;
      } catch (error) {
        for (const normalized of batch) {
          try {
            const result = await buildSpeciesUpsertArgs(normalized);
            normalized._resolvedId = result.id;
            report.upserted += 1;
          } catch (innerError) {
            noteError(report, `${normalized.slug}: ${innerError.message}`);
          }
        }
      }
      if (verbose && pending.length > BATCH_SIZE) {
        console.log(`[progress:species] ${Math.min(i + BATCH_SIZE, pending.length)}/${pending.length} master records`);
      }
    }
    // Phase B: junction records (traits + biomes) per species
    for (const normalized of pending) {
      if (!normalized._resolvedId) continue;
      const speciesId = normalized._resolvedId;
      try {
        for (const traitValue of normalized.traits) {
          // Junction-created trait STUBS get the non-exportable membership
          // 'species_link' (Codex P2 on Game#2745: species attributes like
          // body-length leaked into every export target because stubs had
          // null sourceFiles = the curator everywhere-rule). A real source
          // later re-importing the slug overwrites membership via the
          // per-slug merge; the update path never touches sourceFiles.
          const trait = await prisma.trait.upsert({
            where: { slug: traitValue.traitSlug },
            create: { slug: traitValue.traitSlug, name: traitValue.traitName, dataType: traitValue.kind || 'TEXT', category: traitValue.category || null, sourceFiles: ['species_link'] },
            update: { category: traitValue.category || undefined },
          });
          const payload = {
            speciesId,
            traitId: trait.id,
            unit: traitValue.unit || null,
            category: traitValue.category || null,
            source: traitValue.source || null,
            confidence: traitValue.confidence ?? null,
            value: traitValue.value != null ? traitValue.value : null,
            num: typeof traitValue.value === 'number' ? traitValue.value : null,
            bool: typeof traitValue.value === 'boolean' ? traitValue.value : null,
            text: typeof traitValue.value === 'string' ? traitValue.value : null,
          };
          await prisma.speciesTrait.upsert({
            where: { speciesId_traitId_category: { speciesId, traitId: trait.id, category: payload.category } },
            create: payload,
            update: payload,
          });
        }
        for (const biomeEntry of normalized.biomes) {
          if (!biomeEntry.biomeSlug) continue;
          const biome = await prisma.biome.upsert({ where: { slug: biomeEntry.biomeSlug }, create: { slug: biomeEntry.biomeSlug, name: biomeEntry.biomeSlug }, update: {} });
          await prisma.speciesBiome.upsert({
            where: { speciesId_biomeId: { speciesId, biomeId: biome.id } },
            create: { speciesId, biomeId: biome.id, presence: biomeEntry.presence || 'resident', abundance: biomeEntry.abundance },
            update: { presence: biomeEntry.presence || 'resident', abundance: biomeEntry.abundance },
          });
        }
      } catch (error) {
        noteError(report, `${normalized.slug} junctions: ${error.message}`);
      }
    }
  } else {
    report.upserted = pending.length;
  }
  report.elapsed_ms = Math.round(performance.now() - t0);
  return report;
}

async function processEcosystems(items) {
  const t0 = performance.now();
  const report = createDomainReport('ecosystems', items.length);
  const pending = [];
  for (const item of items) {
    for (const record of expandDomainRecords('ecosystems', item.file, item.data)) {
      report.read += 1;
      const normalized = normalizeEcosystem(record, item.file);
      if (!normalized) {
        noteSkip(report, `${path.basename(item.file)}: ecosistema non normalizzabile`, 'ecosistema_non_normalizzabile');
        continue;
      }
      if (!validateNormalizedEcosystem(normalized)) {
        noteSkip(report, `${path.basename(item.file)}: ${normalized.slug || '?'} schema validation failed`, 'schema_validation');
        continue;
      }
      report.normalized += 1;
      noteCompleteness(report, 'ecosystems', normalized);
      if (verbose) console.log(`Ecosystem: ${normalized.slug}`);
      pending.push(normalized);
    }
  }
  if (!dryRun) {
    // Phase A: batch upsert ecosystem master records
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      try {
        const results = await prisma.$transaction(
          batch.map((normalized) =>
            prisma.ecosystem.upsert({
              where: { slug: normalized.slug },
              create: { slug: normalized.slug, name: normalized.name, description: normalized.description, region: normalized.region, climate: normalized.climate },
              update: { name: normalized.name, description: normalized.description, region: normalized.region, climate: normalized.climate },
            }),
          ),
        );
        for (let j = 0; j < batch.length; j++) {
          batch[j]._resolvedId = results[j].id;
        }
        report.upserted += batch.length;
      } catch (error) {
        for (const normalized of batch) {
          try {
            const ecosystem = await prisma.ecosystem.upsert({
              where: { slug: normalized.slug },
              create: { slug: normalized.slug, name: normalized.name, description: normalized.description, region: normalized.region, climate: normalized.climate },
              update: { name: normalized.name, description: normalized.description, region: normalized.region, climate: normalized.climate },
            });
            normalized._resolvedId = ecosystem.id;
            report.upserted += 1;
          } catch (innerError) {
            noteError(report, `${normalized.slug}: ${innerError.message}`);
          }
        }
      }
      if (verbose && pending.length > BATCH_SIZE) {
        console.log(`[progress:ecosystems] ${Math.min(i + BATCH_SIZE, pending.length)}/${pending.length} master records`);
      }
    }
    // Phase B: junction records (biomes + species) per ecosystem
    for (const normalized of pending) {
      if (!normalized._resolvedId) continue;
      const ecosystemId = normalized._resolvedId;
      try {
        for (const biomeEntry of normalized.biomes) {
          if (!biomeEntry.biomeSlug) continue;
          const biome = await prisma.biome.upsert({ where: { slug: biomeEntry.biomeSlug }, create: { slug: biomeEntry.biomeSlug, name: biomeEntry.notes || biomeEntry.biomeSlug }, update: {} });
          await prisma.ecosystemBiome.upsert({
            where: { ecosystemId_biomeId: { ecosystemId, biomeId: biome.id } },
            create: { ecosystemId, biomeId: biome.id, proportion: biomeEntry.proportion, notes: biomeEntry.notes || null },
            update: { proportion: biomeEntry.proportion, notes: biomeEntry.notes || null },
          });
        }
        for (const speciesEntry of normalized.species) {
          if (!speciesEntry.speciesSlug) continue;
          const species = await prisma.species.upsert({ where: { slug: speciesEntry.speciesSlug }, create: { slug: speciesEntry.speciesSlug, scientificName: speciesEntry.speciesSlug }, update: {} });
          const role = ROLE_VALUES.includes(speciesEntry.role) ? speciesEntry.role : 'common';
          await prisma.ecosystemSpecies.upsert({
            where: { ecosystemId_speciesId_role: { ecosystemId, speciesId: species.id, role } },
            create: { ecosystemId, speciesId: species.id, role, abundance: speciesEntry.abundance, notes: speciesEntry.notes || null },
            update: { abundance: speciesEntry.abundance, notes: speciesEntry.notes || null },
          });
        }
      } catch (error) {
        noteError(report, `${normalized.slug} junctions: ${error.message}`);
      }
    }
  } else {
    report.upserted = pending.length;
  }
  report.elapsed_ms = Math.round(performance.now() - t0);
  return report;
}

// Compute process exit code from import summary based on user-supplied flags.
// Per spec PR-ε Q4 resolved: STRICT default (errori + schema_validation = exit 1,
// partial completeness = warn only). Opt-out via --warn-only. Granular via
// --fail-on=errors|schema|any.
//
// Pure function exported for unit testing.
function computeExitCode(summary, opts = {}) {
  const { validateOnly = false, warnOnly = false, failOn = ['errors', 'schema'] } = opts;
  if (!validateOnly) return 0;
  if (warnOnly) return 0;

  const checkErrors = failOn.includes('errors') || failOn.includes('any');
  const checkSchema = failOn.includes('schema') || failOn.includes('any');

  if (checkErrors && (summary.errori || 0) > 0) return 1;

  if (checkSchema) {
    for (const detail of Object.values(summary.dettaglio || {})) {
      const schemaSkips = detail?.motivi_scarto?.schema_validation || 0;
      if (schemaSkips > 0) return 1;
    }
  }

  return 0;
}

async function main() {
  const mainT0 = performance.now();
  const config = configPath ? JSON.parse(fs.readFileSync(configPath, 'utf-8')) : defaultConfig;
  // Progress to stderr to keep stdout JSON-only for machine consumers
  // (Game's evo-import-gate.yml and any --validate-only consumer).
  const modeLabel = validateOnly ? ' (validate-only)' : dryRun ? ' (dry-run)' : '';
  console.error(`Repo: ${repoRoot}${modeLabel}`);
  const globOptions = {
    cwd: repoRoot,
    absolute: true,
    dot: true,
    ignore: ['**/node_modules/**', '**/.git/**', '**/archive/**', '**/incoming/**', '**/reports/**'],
  };
  const [traitFiles, biomeFiles, speciesFiles, ecosystemFiles] = await Promise.all([
    fg(config.traits || defaultConfig.traits, globOptions),
    fg(config.biomes || defaultConfig.biomes, globOptions),
    fg(config.species || defaultConfig.species, globOptions),
    fg(config.ecosystems || defaultConfig.ecosystems, globOptions),
  ]);
  const loadItems = (files) => files.map((file) => ({ file, data: parseFile(file) }));
  const reports = [];
  reports.push(await processTraits(loadItems(traitFiles)));
  reports.push(await processBiomes(loadItems(biomeFiles)));
  reports.push(await processSpecies(loadItems(speciesFiles)));
  reports.push(await processEcosystems(loadItems(ecosystemFiles)));
  const summary = reports.reduce(
    (acc, report) => {
      acc.totali_letti += report.read;
      acc.normalizzati += report.normalized;
      acc.completi += report.complete;
      acc.parziali += report.partial;
      acc.aggiornati_o_upsertati += report.upserted;
      acc.scartati += report.skipped;
      acc.errori += report.errors;
      acc.dettaglio[report.domain] = {
        files: report.files,
        letti: report.read,
        normalizzati: report.normalized,
        completi: report.complete,
        parziali: report.partial,
        aggiornati: report.upserted,
        scartati: report.skipped,
        errori: report.errors,
        elapsed_ms: report.elapsed_ms || 0,
        motivi_scarto: report.skipReasons,
        esempi_scarti: report.skippedSamples,
      };
      return acc;
    },
    { mode: validateOnly ? 'validate-only' : dryRun ? 'dry-run' : 'import', repo: repoRoot, totali_letti: 0, normalizzati: 0, completi: 0, parziali: 0, aggiornati_o_upsertati: 0, scartati: 0, errori: 0, dettaglio: {} },
  );
  summary.elapsed_ms = Math.round(performance.now() - mainT0);
  // JSON-only on stdout (machine-readable). Anything else (Repo, progress,
  // errors) routes to stderr.
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

if (require.main === module) {
  // Codex P1 fix from PR #125 review: use process.exitCode + let the
  // event loop drain instead of process.exit(). Hard-exit can truncate
  // stdout JSON when piped (the exact CI/gating use case for this
  // command) because Node may not flush buffered stdout before exit.
  // Setting exitCode lets the natural promise-chain shutdown happen.
  main()
    .then((summary) => {
      const code = computeExitCode(summary, { validateOnly, warnOnly, failOn });
      if (code !== 0) {
        console.error(`validate-only: exit ${code} (errori=${summary.errori || 0}, fail-on=${failOn.join(',')})`);
      }
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 2;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { computeExitCode, parseFlagFromArgs, normalizeTrait, classifySource, mergeTraitRecords, buildTraitUpsertArgs };
