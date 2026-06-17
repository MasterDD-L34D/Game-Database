'use strict';

const { normalizeSlug } = require('../../utils/slug');

const PATHS = {
  TRAIT_GLOSSARY: 'packs/evo_tactics_pack/docs/catalog/trait_glossary.json',
  TRAIT_REFERENCE: 'packs/evo_tactics_pack/docs/catalog/trait_reference.json',
  CORE_GLOSSARY: 'data/core/traits/glossary.json',
  SPECIES_DIR: 'packs/evo_tactics_pack/docs/catalog/species',
};

const MODEL_GAP = [
  // Future gaps
  'description',
  'last_synced_at',
];

// RFC #4 S2-Q1: top-level provenance marker stamped on every exported species
// JSON. Volatile by design (release tag + export timestamp). The fidelity diff
// excludes these keys (a stale marker in the Game file must never count as
// drift) and the importer (normalizeSpecies) only reads known fields, so the
// marker never round-trips into the DB.
const SPECIES_PROVENANCE_KEYS = ['_generated_from', 'generated_at'];

function orderObjKeys(dbObj, templateObj) {
  // Order keys to match the Game template at every depth so a re-export stays
  // byte-faithful to the hand-authored file (only genuine value changes diff).
  // Scalars and arrays pass through untouched (array order is significant data).
  if (!templateObj || typeof templateObj !== 'object' || Array.isArray(templateObj)) return dbObj;
  if (!dbObj || typeof dbObj !== 'object' || Array.isArray(dbObj)) return dbObj;
  const ordered = {};
  for (const key of Object.keys(templateObj)) {
    if (Object.hasOwn(dbObj, key)) {
      ordered[key] = orderObjKeys(dbObj[key], templateObj[key]);
    }
  }
  for (const key of Object.keys(dbObj)) {
    if (!Object.hasOwn(ordered, key)) {
      ordered[key] = dbObj[key];
    }
  }
  return ordered;
}

function renderGlossary(traits, updatedAt, schemaVersion, template = null) {
  const traitsMap = {};
  const dbTraitsByKey = {};
  for (const trait of traits) {
    dbTraitsByKey[trait.sourceKey || trait.slug] = trait;
  }

  const buildObj = (trait) => ({
    label_it: trait.name,
    label_en: trait.nameEn || trait.name,
    description_it: trait.description,
    description_en: trait.descriptionEn || trait.description,
  });

  const processedKeys = new Set();

  if (template && template.traits) {
    for (const key of Object.keys(template.traits)) {
      if (Object.hasOwn(dbTraitsByKey, key)) {
        const dbObj = buildObj(dbTraitsByKey[key]);
        traitsMap[key] = orderObjKeys(dbObj, template.traits[key]);
        processedKeys.add(key);
      }
    }
  }

  const sortedTraits = [...traits].sort((a, b) => (a.sourceKey || a.slug).localeCompare(b.sourceKey || b.slug));
  for (const trait of sortedTraits) {
    const key = trait.sourceKey || trait.slug;
    if (!processedKeys.has(key)) {
      traitsMap[key] = buildObj(trait);
    }
  }

  return {
    schema_version: schemaVersion,
    updated_at: updatedAt,
    sources: { trait_reference: 'data/traits/index.json' },
    traits: traitsMap,
  };
}

function renderReference(traits, template = null) {
  const traitsMap = {};
  const dbTraitsByKey = {};
  for (const trait of traits) {
    dbTraitsByKey[trait.sourceKey || trait.slug] = trait;
  }

  const buildObj = (trait) => {
    const obj = {};
    if (trait.name != null) obj.label = trait.name;
    if (trait.familyType != null) obj.famiglia_tipologia = trait.familyType;
    if (trait.energyMaintenance != null) obj.fattore_mantenimento_energetico = trait.energyMaintenance;
    if (trait.tier != null) obj.tier = trait.tier;
    if (trait.slotProfile != null) obj.slot_profile = trait.slotProfile;
    if (trait.usageTags != null) obj.usage_tags = trait.usageTags;
    if (trait.synergies != null) obj.sinergie = trait.synergies;
    if (trait.conflicts != null) obj.conflitti = trait.conflicts;
    if (trait.environmentalRequirements != null) obj.requisiti_ambientali = trait.environmentalRequirements;
    if (trait.inducedMutation != null) obj.mutazione_indotta = trait.inducedMutation;
    if (trait.functionalUse != null) obj.uso_funzione = trait.functionalUse;
    if (trait.selectiveDrive != null) obj.spinta_selettiva = trait.selectiveDrive;
    if (trait.weakness != null) obj.debolezza = trait.weakness;

    if (trait.sourceExtras && Object.keys(trait.sourceExtras).length > 0) {
      return { ...obj, ...trait.sourceExtras };
    }
    return obj;
  };

  const processedKeys = new Set();

  if (template && template.traits) {
    for (const key of Object.keys(template.traits)) {
      if (Object.hasOwn(dbTraitsByKey, key)) {
        const dbObj = buildObj(dbTraitsByKey[key]);
        traitsMap[key] = orderObjKeys(dbObj, template.traits[key]);
        processedKeys.add(key);
      }
    }
  }

  const sortedTraits = [...traits].sort((a, b) => (a.sourceKey || a.slug).localeCompare(b.sourceKey || b.slug));
  for (const trait of sortedTraits) {
    const key = trait.sourceKey || trait.slug;
    if (!processedKeys.has(key)) {
      traitsMap[key] = buildObj(trait);
    }
  }

  return {
    schema_version: '2.0',
    trait_glossary: 'data/core/traits/glossary.json',
    traits: traitsMap,
  };
}

const TRAIT_REF_MAPPED_FIELDS = [
  'label',
  'famiglia_tipologia',
  'fattore_mantenimento_energetico',
  'tier',
  'slot_profile',
  'usage_tags',
  'sinergie',
  'conflitti',
  'requisiti_ambientali',
  'mutazione_indotta',
  'uso_funzione',
  'spinta_selettiva',
  'debolezza',
];


// Emit biomes faithfully to the Game template: when the snapshot's biome set
// matches the template's, keep the template's exact strings and order (preserves
// `foresta_temperata`, no churn). The match uses the SAME canonical slug
// normalizer the importer used to build the DB slugs (normalizeSlug: NFD + strip
// diacritics), so accented Italian biome names match too (Codex P2 on #223) --
// a hand-rolled [^a-z0-9] regex would map `Cafe Nino` and `Cafe' Nino` apart.
// Only on a genuine set change fall back to canonical sorted DB slugs, still
// reusing a template string wherever one is slug-equal so only the real delta diffs.
function renderBiomes(dbSlugs, templateBiomes) {
  const dbSorted = [...dbSlugs].sort();
  if (!Array.isArray(templateBiomes)) return dbSorted;
  const dbSet = new Set(dbSlugs.map((b) => normalizeSlug(b)));
  const tmplSet = new Set(templateBiomes.map((b) => normalizeSlug(b)));
  const setsEqual = dbSet.size === tmplSet.size && [...dbSet].every((n) => tmplSet.has(n));
  if (setsEqual) return [...templateBiomes];
  const tmplByNorm = new Map(templateBiomes.map((b) => [normalizeSlug(b), b]));
  return dbSorted.map((s) => tmplByNorm.get(normalizeSlug(s)) ?? s);
}

// Treat null, undefined, and [] as the same "absent" value, matching how the
// fidelity differ compares fields -- used to keep the template's chosen
// representation instead of churning [] <-> null.
function isAbsentValue(v) {
  return v === null || v === undefined || (Array.isArray(v) && v.length === 0);
}

function renderSpecies(speciesRow, template = null, provenance = null) {
  const obj = {};

  if (speciesRow.slug !== undefined) obj.id = speciesRow.slug;
  if (speciesRow.trophicRole !== undefined) obj.role_trofico = speciesRow.trophicRole;
  if (speciesRow.functionalTags !== undefined) obj.functional_tags = speciesRow.functionalTags;
  if (speciesRow.vcCoefficients !== undefined) obj.vc = speciesRow.vcCoefficients;
  if (speciesRow.spawnRules !== undefined) obj.spawn_rules = speciesRow.spawnRules;
  if (speciesRow.environmentAffinity !== undefined) obj.environment_affinity = speciesRow.environmentAffinity;
  if (speciesRow.jobsBias !== undefined) obj.jobs_bias = speciesRow.jobsBias;
  if (speciesRow.playableUnit !== undefined) obj.playable_unit = speciesRow.playableUnit;
  if (speciesRow.displayName !== undefined) obj.display_name = speciesRow.displayName;
  
  if (speciesRow.flags !== undefined) obj.flags = speciesRow.flags;
  if (speciesRow.balance !== undefined) obj.balance = speciesRow.balance;
  if (speciesRow.telemetry !== undefined) obj.telemetry = speciesRow.telemetry;
  if (speciesRow.morphotype !== undefined) obj.morphotype = speciesRow.morphotype;

  if (speciesRow.biomeSlugs && Array.isArray(speciesRow.biomeSlugs)) {
    obj.biomes = renderBiomes(speciesRow.biomeSlugs, template && template.biomes);
  }

  if (speciesRow.sourceExtras && typeof speciesRow.sourceExtras === 'object') {
    const keys = ['derived_from_environment', 'receipt', 'hazards_expected', 'path', 'genetic_traits', 'services_links'];
    for (const k of keys) {
      if (speciesRow.sourceExtras[k] !== undefined) {
        obj[k] = speciesRow.sourceExtras[k];
      }
    }
  }

  // Non-destructive overlay (RFC #4 S2): the DB does not model every Game field.
  // Preserve MODEL_GAP fields (description, last_synced_at) verbatim from the
  // template, and keep the template's representation wherever both sides are
  // absent-equivalent (e.g. jobs_bias [] vs null), so a re-export only adds the
  // marker instead of deleting Game-authored data or churning empty values.
  if (template && typeof template === 'object' && !Array.isArray(template)) {
    for (const f of MODEL_GAP) {
      if (Object.hasOwn(template, f) && !Object.hasOwn(obj, f)) obj[f] = template[f];
    }
    for (const k of Object.keys(obj)) {
      if (Object.hasOwn(template, k) && isAbsentValue(obj[k]) && isAbsentValue(template[k])) {
        obj[k] = template[k];
      }
    }
  }

  const ordered = orderObjKeys(obj, template);

  // RFC #4 S2-Q1: prepend the provenance marker so it is the first top-level
  // key, independent of the Game template's key order. orderObjKeys never
  // re-emits these keys (obj does not carry them), so the body stays stable.
  if (provenance && provenance.generatedFrom) {
    return {
      _generated_from: provenance.generatedFrom,
      generated_at: provenance.generatedAt,
      ...ordered,
    };
  }

  return ordered;
}

module.exports = {
  PATHS,
  MODEL_GAP,
  SPECIES_PROVENANCE_KEYS,
  TRAIT_REF_MAPPED_FIELDS,
  renderGlossary,
  renderReference,
  renderSpecies,
  renderBiomes,
  orderObjKeys,
};
