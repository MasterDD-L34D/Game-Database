'use strict';

const PATHS = {
  TRAIT_GLOSSARY: 'packs/evo_tactics_pack/docs/catalog/trait_glossary.json',
  TRAIT_REFERENCE: 'packs/evo_tactics_pack/docs/catalog/trait_reference.json',
  CORE_GLOSSARY: 'data/core/traits/glossary.json',
};

const MODEL_GAP = [
  // Future gaps
];

function orderObjKeys(dbObj, templateObj) {
  if (!templateObj) return dbObj;
  const ordered = {};
  for (const key of Object.keys(templateObj)) {
    if (key in dbObj) {
      ordered[key] = dbObj[key];
    }
  }
  for (const key of Object.keys(dbObj)) {
    if (!(key in ordered)) {
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
      if (key in dbTraitsByKey) {
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
      if (key in dbTraitsByKey) {
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

module.exports = {
  PATHS,
  MODEL_GAP,
  TRAIT_REF_MAPPED_FIELDS,
  renderGlossary,
  renderReference,
};
