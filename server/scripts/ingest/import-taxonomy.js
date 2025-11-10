#!/usr/bin/env node
/* Importatore: trait, biomi, specie, ecosistemi da repo locale (JSON/YAML/MD/CSV).
 * Upsert per idempotenza (slug), relazioni specie↔tratti/biomi ed ecosistema↔biomi/specie.
 */
const fs = require('fs');
const path = require('path');
const fg = require('fast-glob');
const matter = require('gray-matter');
const yaml = require('js-yaml');
const { parse: parseCsv } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const args = process.argv.slice(2);
function arg(name, def){
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const next = args[i + 1];
  if (next && !next.startsWith('--')) return next;
  return true;
}
const repoRoot = path.resolve(arg('repo', process.cwd()));
const dryRun = !!arg('dry-run', false);
const verbose = !!arg('verbose', false);
const configPath = arg('config', null);

const defaultConfig = {
  species: ['**/{species,specie}/**/*.{json,yaml,yml,md,csv}','**/species*.{json,yaml,yml,md,csv}'],
  traits: ['**/{traits,tratti,caratteri}/**/*.{json,yaml,yml,md,csv}','**/traits*.{json,yaml,yml,md,csv}'],
  biomes: ['**/{biomes,biomi}/**/*.{json,yaml,yml,md,csv}','**/biomes*.{json,yaml,yml,md,csv}'],
  ecosystems: ['**/{ecosystems,ecosistemi}/**/*.{json,yaml,yml,md,csv}','**/ecosystem*.{json,yaml,yml,md,csv}']
};

function slugify(s){
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseFile(fp){
  const ext = path.extname(fp).toLowerCase();
  const raw = fs.readFileSync(fp, 'utf-8');
  if (ext === '.json') return JSON.parse(raw);
  if (ext === '.yaml' || ext === '.yml') return yaml.load(raw);
  if (ext === '.md'){
    const fm = matter(raw);
    const data = fm.data || {};
    if (fm.content?.trim()){
      data.description = (data.description ? data.description + '\n' : '') + fm.content.trim();
    }
    return data;
  }
  if (ext === '.csv'){
    return parseCsv(raw, { columns: true, skip_empty_lines: true });
  }
  return null;
}

function asArray(x){
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function expandRecords(data, keys = []){
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object'){
    for (const key of keys){
      const val = data[key];
      if (Array.isArray(val)) return val;
      if (val && typeof val === 'object' && Array.isArray(val.items)) return val.items;
    }
  }
  return data != null ? [data] : [];
}

function firstOf(obj){
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) return obj.length ? obj[0] : null;
  const values = Object.values(obj);
  return values.length ? values[0] : null;
}

function normalizeTrait(d){
  if (Array.isArray(d)) return d.map(normalizeTrait);
  if (!d || typeof d !== 'object') return null;
  const label = d.name || d.trait || d.label || d.nome || d.title || firstOf(d.labels) || (d.labels && d.labels.default);
  if (!label) return null;
  const slug = slugify(d.slug || d._id || label);
  const description = d.description || d.descrizione || firstOf(d.descriptions) || (d.reference && (d.reference.description || d.reference.summary)) || null;
  const category = d.category || d.categoria || (d.reference && (d.reference.slot || d.reference.tier)) || null;
  const unit = d.unit || d.unita || (d.reference && (d.reference.unit || (d.reference.usage && d.reference.usage.unit))) || null;
  const allowed = d.allowedValues || d.valori || d.environment_recommendations || null;
  const range = d.balance || d.range || {};
  const dataTypeRaw = (d.dataType || d.type || d.kind || (d.reference && d.reference.type) || '').toString().toUpperCase();
  let dt = ['BOOLEAN','NUMERIC','CATEGORICAL','TEXT'].includes(dataTypeRaw) ? dataTypeRaw : null;
  if (!dt){
    if (Array.isArray(allowed)) dt = 'CATEGORICAL';
    else if (typeof range.min === 'number' || typeof range.max === 'number' || typeof d.min === 'number' || typeof d.max === 'number') dt = 'NUMERIC';
    else dt = 'TEXT';
  }
  return {
    slug,
    name: label,
    description,
    category,
    unit,
    dataType: dt,
    allowedValues: allowed,
    rangeMin: d.min ?? d.rangeMin ?? range.min ?? null,
    rangeMax: d.max ?? d.rangeMax ?? range.max ?? null,
  };
}

function normalizeBiome(d){
  if (Array.isArray(d)) return d.map(normalizeBiome);
  if (!d || typeof d !== 'object') return null;
  const label = d.name || d.nome || d.label || d.biome || d.bioma;
  if (!label && Array.isArray(d.items)) return d.items.map(normalizeBiome);
  if (!label && d.data && typeof d.data === 'object') return normalizeBiome(d.data);
  if (!label) return null;
  const slug = slugify(d.slug || d._id || d.id || d.network_id || label);
  const description = d.description || d.descrizione || (d.profile && (d.profile.summary || d.profile.description)) || null;
  const climate = d.climate || d.clima || (d.profile && (d.profile.climate || d.profile.environment || d.profile.biome_type)) || null;
  const parentFromConnection = (asArray(d.connections).find(c => (c.type || c.relationship || c.kind) === 'parent') || {}).to;
  const parentSlugRaw = d.parentSlug || (d.parent && (d.parent.slug || d.parent.name || d.parent)) || parentFromConnection;
  const parentSlug = parentSlugRaw ? slugify(parentSlugRaw) : null;
  return {
    slug,
    name: label,
    description,
    climate,
    parentSlug: parentSlug || null,
  };
}

function normalizeSpecies(d){
  if (Array.isArray(d)) return d.map(normalizeSpecies);
  if (!d || typeof d !== 'object') return null;
  const baseName = d.scientificName || d.scientific_name || d.binomial || d.nomeScientifico || d.display_name || d.name;
  if (!baseName && Array.isArray(d.items)) return d.items.map(normalizeSpecies);
  if (!baseName && d.data && typeof d.data === 'object') return normalizeSpecies(d.data);
  if (!baseName) return null;
  const slug = slugify(d.slug || d._id || d.id || baseName);
  const traitSources = [];
  traitSources.push(...asArray(d.traits || d.tratti || d.caratteri));
  if (d.derived_from_environment){
    if (Array.isArray(d.derived_from_environment.traits)) traitSources.push(...d.derived_from_environment.traits);
    if (Array.isArray(d.derived_from_environment.rules)){
      for (const rule of d.derived_from_environment.rules){
        if (rule?.suggest?.traits) traitSources.push(...asArray(rule.suggest.traits));
      }
    }
  }
  if (d.environment_affinity?.traits) traitSources.push(...asArray(d.environment_affinity.traits));

  const normalizedTraits = traitSources.map(t => {
    if (!t) return null;
    const traitName = t.trait || t.name || t.nome || t.slug || t.id;
    if (!traitName) return null;
    let val = t.value ?? t.valore ?? t.val ?? t.score ?? t.rating ?? null;
    let kind = (t.kind || t.type || '').toString().toUpperCase();
    if (!['BOOLEAN','NUMERIC','CATEGORICAL','TEXT'].includes(kind)){
      if (typeof val === 'number') kind = 'NUMERIC';
      else if (typeof val === 'boolean') kind = 'BOOLEAN';
      else if (Array.isArray(val)) kind = 'CATEGORICAL';
      else kind = 'TEXT';
    }
    return {
      traitSlug: slugify(t.slug || t.id || traitName),
      traitName,
      kind,
      value: val,
      unit: t.unit || t.unita || null,
      category: t.category || t.categoria || t.group || null,
      source: t.source || t.origin || null,
      confidence: t.confidence != null ? Number(t.confidence) : (t.weight != null ? Number(t.weight) : null),
    };
  }).filter(Boolean);

  const biomeEntries = asArray(d.biomes || d.biomi || d.habitats || d.habitat || (d.catalog && d.catalog.biomes)).map(b => {
    if (!b) return null;
    if (typeof b === 'string') return { biomeSlug: slugify(b), presence: 'resident' };
    const slugCandidate = b.slug || b.id || b._id || b.name || b.label || b.biome || b.bioma || b.to;
    const presence = (b.presence || b.presenza || b.relationship || 'resident').toString().toLowerCase();
    const abundance = b.abundance != null ? Number(b.abundance) : (b.balance && typeof b.balance.abundance === 'number' ? Number(b.balance.abundance) : null);
    return {
      biomeSlug: slugify(slugCandidate || ''),
      presence,
      abundance,
    };
  }).filter(Boolean);

  return {
    slug,
    scientificName: baseName,
    commonName: d.commonName || d.nomeComune || d.vernacular || d.display_name || d.name || null,
    kingdom: d.kingdom || (d.taxonomy && d.taxonomy.kingdom) || null,
    phylum: d.phylum || (d.taxonomy && d.taxonomy.phylum) || null,
    class: d.class || d.classe || (d.taxonomy && (d.taxonomy.class || d.taxonomy.classe)) || null,
    order: d.order || d.ordine || (d.taxonomy && (d.taxonomy.order || d.taxonomy.ordine)) || null,
    family: d.family || d.famiglia || (d.taxonomy && (d.taxonomy.family || d.taxonomy.famiglia)) || null,
    genus: d.genus || (d.taxonomy && d.taxonomy.genus) || null,
    epithet: d.epithet || d.species || d.specie || (d.taxonomy && (d.taxonomy.epithet || d.taxonomy.species)) || null,
    status: d.status || d.iucn || (d.flags && (d.flags.category || d.flags.status)) || null,
    description: d.description || d.descrizione || d.summary || d.story || null,
    traits: normalizedTraits,
    biomes: biomeEntries,
  };
}

function normalizeEcosystem(d){
  if (Array.isArray(d)) return d.map(normalizeEcosystem);
  if (!d || typeof d !== 'object') return null;
  const name = d.name || d.nome || d.label || d.ecosystem || d.ecosistema;
  if (!name && Array.isArray(d.items)) return d.items.map(normalizeEcosystem);
  if (!name && d.data && typeof d.data === 'object') return normalizeEcosystem(d.data);
  if (!name) return null;
  return {
    slug: slugify(d.slug || d._id || d.id || name),
    name,
    description: d.description || d.descrizione || d.summary || null,
    region: d.region || d.regione || (d.profile && d.profile.region) || null,
    climate: d.climate || d.clima || (d.profile && (d.profile.climate || d.profile.environment)) || null,
    biomes: asArray(d.biomes || d.biomi || (d.network && d.network.biomes)).map(b => {
      if (!b) return null;
      if (typeof b === 'string') return { biomeSlug: slugify(b), proportion: null };
      const slugCandidate = b.slug || b.id || b._id || b.name || b.label || b;
      const proportion = b.proportion != null ? Number(b.proportion) : (b.weight != null ? Number(b.weight) : null);
      return { biomeSlug: slugify(slugCandidate || ''), proportion };
    }).filter(Boolean),
    species: asArray(d.species || d.specie || (d.network && d.network.species)).map(s => {
      if (!s) return null;
      const sci = s.scientificName || s.scientific_name || s.binomial || s.nomeScientifico || s.name || s.label || s;
      const role = (s.role || s.relationship || 'common').toString().toLowerCase();
      const abundance = s.abundance != null ? Number(s.abundance) : (s.weight != null ? Number(s.weight) : null);
      return { speciesSlug: slugify(s.slug || s._id || s.id || sci), role, abundance };
    }).filter(Boolean),
  };
}

async function upsertTraits(items){
  let n = 0;
  for (const it of items){
    const records = expandRecords(it.data, ['traits', 'items', 'entries', 'data']);
    for (const record of records){
      const t = normalizeTrait(record);
      if (!t) continue;
      if (verbose) console.log('Trait:', t.slug);
      if (!dryRun){
        await prisma.trait.upsert({
          where: { slug: t.slug },
          create: t,
          update: {
            name: t.name,
            description: t.description,
            category: t.category,
            unit: t.unit,
            dataType: t.dataType,
            allowedValues: t.allowedValues,
            rangeMin: t.rangeMin,
            rangeMax: t.rangeMax,
          },
        });
      }
      n++;
    }
  }
  return n;
}

async function upsertBiomes(items){
  let n = 0;
  const parents = [];
  for (const it of items){
    const records = expandRecords(it.data, ['biomes', 'items', 'data']);
    for (const record of records){
      const b = normalizeBiome(record);
      if (!b) continue;
      if (verbose) console.log('Biome:', b.slug);
      if (!dryRun){
        await prisma.biome.upsert({
          where: { slug: b.slug },
          create: { slug: b.slug, name: b.name, description: b.description, climate: b.climate },
          update: { name: b.name, description: b.description, climate: b.climate },
        });
        if (b.parentSlug) parents.push(b);
      }
      n++;
    }
  }
  if (!dryRun){
    for (const b of parents){
      const parent = await prisma.biome.findUnique({ where: { slug: b.parentSlug } });
      const self = await prisma.biome.findUnique({ where: { slug: b.slug } });
      if (parent && self && self.parentId !== parent.id){
        await prisma.biome.update({ where: { id: self.id }, data: { parentId: parent.id } });
      }
    }
  }
  return n;
}

async function upsertSpecies(items){
  let n = 0;
  for (const it of items){
    const records = expandRecords(it.data, ['species', 'items', 'entries', 'data']);
    for (const record of records){
      const s = normalizeSpecies(record);
      if (!s) continue;
      if (verbose) console.log('Species:', s.slug);
      if (!dryRun){
        const base = {
          slug: s.slug,
          scientificName: s.scientificName,
          commonName: s.commonName,
          kingdom: s.kingdom,
          phylum: s.phylum,
          class: s.class,
          order: s.order,
          family: s.family,
          genus: s.genus,
          epithet: s.epithet,
          status: s.status,
          description: s.description,
        };
        const species = await prisma.species.upsert({ where: { slug: s.slug }, create: base, update: base });
        for (const tv of s.traits){
          const trait = await prisma.trait.upsert({
            where: { slug: tv.traitSlug },
            create: { slug: tv.traitSlug, name: tv.traitName, dataType: tv.kind || 'TEXT' },
            update: { name: tv.traitName },
          });
          const data = {
            speciesId: species.id,
            traitId: trait.id,
            unit: tv.unit || null,
            category: tv.category || null,
            source: tv.source || null,
            confidence: tv.confidence != null ? Number(tv.confidence) : null,
            value: tv.value != null ? tv.value : null,
            num: typeof tv.value === 'number' ? Number(tv.value) : null,
            bool: typeof tv.value === 'boolean' ? !!tv.value : null,
            text: typeof tv.value === 'string' ? tv.value : null,
          };
          await prisma.speciesTrait.upsert({
            where: { speciesId_traitId_category: { speciesId: species.id, traitId: trait.id, category: data.category || null } },
            create: data,
            update: data,
          });
        }
        for (const hb of s.biomes){
          if (!hb.biomeSlug) continue;
          const biome = await prisma.biome.upsert({
            where: { slug: hb.biomeSlug },
            create: { slug: hb.biomeSlug, name: hb.biomeSlug },
            update: {},
          });
          const presence = ['resident','migrant','introduced','endemic','unknown'].includes(hb.presence) ? hb.presence : 'resident';
          await prisma.speciesBiome.upsert({
            where: { speciesId_biomeId: { speciesId: species.id, biomeId: biome.id } },
            create: { speciesId: species.id, biomeId: biome.id, presence, abundance: hb.abundance ?? null },
            update: { presence, abundance: hb.abundance ?? null },
          });
        }
      }
      n++;
    }
  }
  return n;
}

async function upsertEcosystems(items){
  let n = 0;
  for (const it of items){
    const records = expandRecords(it.data, ['ecosystems', 'items', 'entries', 'data']);
    for (const record of records){
      const e = normalizeEcosystem(record);
      if (!e) continue;
      if (verbose) console.log('Ecosystem:', e.slug);
      if (!dryRun){
        const eco = await prisma.ecosystem.upsert({
          where: { slug: e.slug },
          create: { slug: e.slug, name: e.name, description: e.description, region: e.region, climate: e.climate },
          update: { name: e.name, description: e.description, region: e.region, climate: e.climate },
        });
        for (const b of e.biomes){
          if (!b.biomeSlug) continue;
          const biome = await prisma.biome.upsert({
            where: { slug: b.biomeSlug },
            create: { slug: b.biomeSlug, name: b.biomeSlug },
            update: {},
          });
          await prisma.ecosystemBiome.upsert({
            where: { ecosystemId_biomeId: { ecosystemId: eco.id, biomeId: biome.id } },
            create: { ecosystemId: eco.id, biomeId: biome.id, proportion: b.proportion ?? null },
            update: { proportion: b.proportion ?? null },
          });
        }
        for (const s of e.species){
          if (!s.speciesSlug) continue;
          const sp = await prisma.species.upsert({
            where: { slug: s.speciesSlug },
            create: { slug: s.speciesSlug, scientificName: s.speciesSlug },
            update: {},
          });
          const role = ['keystone','dominant','engineer','common','invasive','other'].includes(s.role) ? s.role : 'common';
          await prisma.ecosystemSpecies.upsert({
            where: { ecosystemId_speciesId_role: { ecosystemId: eco.id, speciesId: sp.id, role } },
            create: { ecosystemId: eco.id, speciesId: sp.id, role, abundance: s.abundance ?? null },
            update: { abundance: s.abundance ?? null },
          });
        }
      }
      n++;
    }
  }
  return n;
}

(async () => {
  const cfg = configPath ? JSON.parse(fs.readFileSync(configPath, 'utf-8')) : defaultConfig;
  console.log('Repo:', repoRoot, dryRun ? '(dry-run)' : '');
  const globOpts = { cwd: repoRoot, absolute: true, dot: true, ignore: ['**/node_modules/**','**/.git/**'] };
  const [traitFiles, biomeFiles, speciesFiles, ecosystemFiles] = await Promise.all([
    (await fg(cfg.traits || defaultConfig.traits, globOpts)).map(f => ({ file: f, data: parseFile(f) })),
    (await fg(cfg.biomes || defaultConfig.biomes, globOpts)).map(f => ({ file: f, data: parseFile(f) })),
    (await fg(cfg.species || defaultConfig.species, globOpts)).map(f => ({ file: f, data: parseFile(f) })),
    (await fg(cfg.ecosystems || defaultConfig.ecosystems, globOpts)).map(f => ({ file: f, data: parseFile(f) })),
  ]);
  const t = await upsertTraits(traitFiles);
  const b = await upsertBiomes(biomeFiles);
  const s = await upsertSpecies(speciesFiles);
  const e = await upsertEcosystems(ecosystemFiles);
  console.log('Import completato:', { traits: t, biomes: b, species: s, ecosystems: e });
  await prisma.$disconnect();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
