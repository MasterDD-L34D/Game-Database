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
function arg(name, def){ const i = args.indexOf(`--${name}`); return i>=0 ? (args[i+1] && !args[i+1].startsWith('--') ? args[i+1] : true) : def; }
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
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}
function parseFile(fp){
  const ext = path.extname(fp).toLowerCase();
  const raw = fs.readFileSync(fp, 'utf-8');
  if (ext === '.json') return JSON.parse(raw);
  if (ext === '.yaml' || ext === '.yml') return yaml.load(raw);
  if (ext === '.md') { const fm = matter(raw); const data = fm.data || {}; if (fm.content?.trim()) data.description = (data.description ? data.description + '\n' : '') + fm.content.trim(); return data; }
  if (ext === '.csv'){ const recs = parseCsv(raw, { columns: true, skip_empty_lines: true }); return recs; }
  return null;
}
function asArray(x){ if (x==null) return []; return Array.isArray(x) ? x : [x]; }
function pick(obj, keys){ const o={}; for(const k of keys){ if (obj && obj[k]!=null) o[k]=obj[k]; } return o; }

function normalizeTrait(d){
  if (Array.isArray(d)) return d.map(normalizeTrait);
  const name = d.name || d.trait || d.label || d.nome; if (!name) return null;
  const dataType = (d.dataType || d.type || d.kind || '').toString().toUpperCase();
  let dt = ['BOOLEAN','NUMERIC','CATEGORICAL','TEXT'].includes(dataType) ? dataType : 'TEXT';
  return {
    slug: slugify(d.slug || name),
    name,
    description: d.description || d.descrizione || null,
    category: d.category || d.categoria || null,
    unit: d.unit || d.unita || null,
    dataType: dt,
    allowedValues: d.allowedValues || d.valori || null,
    rangeMin: d.min ?? d.rangeMin ?? null,
    rangeMax: d.max ?? d.rangeMax ?? null,
  };
}
function normalizeBiome(d){
  if (Array.isArray(d)) return d.map(normalizeBiome);
  const name = d.name || d.nome || d.biome || d.bioma; if (!name) return null;
  return {
    slug: slugify(d.slug || name), name,
    description: d.description || d.descrizione || null,
    climate: d.climate || d.clima || null,
    parentSlug: d.parentSlug || (d.parent && (d.parent.slug || d.parent.name || d.parent)) || null,
  };
}
function normalizeSpecies(d){
  if (Array.isArray(d)) return d.map(normalizeSpecies);
  const scientificName = d.scientificName || d.binomial || d.nomeScientifico || d.name; if (!scientificName) return null;
  return {
    slug: slugify(d.slug || scientificName),
    scientificName,
    commonName: d.commonName || d.nomeComune || d.vernacular || null,
    kingdom: d.kingdom || null, phylum: d.phylum || null, class: d.class || d.classe || null, order: d.order || d.ordine || null,
    family: d.family || d.famiglia || null, genus: d.genus || null, epithet: d.epithet || d.species || d.specie || null,
    status: d.status || d.iucn || null,
    description: d.description || d.descrizione || null,
    traits: asArray(d.traits || d.tratti || d.caratteri).map(t => {
      if (!t) return null; const traitName = t.trait || t.name || t.nome; if (!traitName) return null;
      let val = t.value ?? t.valore ?? t.val ?? null;
      let kind = (t.kind || t.type || '').toString().toUpperCase();
      if (!['BOOLEAN','NUMERIC','CATEGORICAL','TEXT'].includes(kind)){
        if (typeof val === 'number') kind='NUMERIC'; else if (typeof val === 'boolean') kind='BOOLEAN';
        else if (Array.isArray(val)) kind='CATEGORICAL'; else kind='TEXT';
      }
      return {
        traitSlug: slugify(t.slug || traitName),
        traitName, kind, value: val,
        unit: t.unit || t.unita || null, category: t.category || t.categoria || null,
        source: t.source || null, confidence: t.confidence != null ? Number(t.confidence) : null,
      };
    }).filter(Boolean),
    biomes: asArray(d.biomes || d.biomi || d.habitats || d.habitat).map(b => {
      if (!b) return null;
      if (typeof b === 'string') return { biomeSlug: slugify(b), presence: 'resident' };
      return {
        biomeSlug: slugify(b.slug || b.name || b.nome || b.biome || b.bioma || b),
        presence: (b.presence || b.presenza || 'resident').toString().toLowerCase(),
        abundance: b.abundance != null ? Number(b.abundance) : null,
      };
    }).filter(Boolean)
  };
}
function normalizeEcosystem(d){
  if (Array.isArray(d)) return d.map(normalizeEcosystem);
  const name = d.name || d.nome || d.ecosystem || d.ecosistema; if (!name) return null;
  return {
    slug: slugify(d.slug || name), name,
    description: d.description || d.descrizione || null,
    region: d.region || d.regione || null,
    climate: d.climate || d.clima || null,
    biomes: asArray(d.biomes || d.biomi).map(b => {
      if (!b) return null;
      if (typeof b === 'string') return { biomeSlug: slugify(b), proportion: null };
      return { biomeSlug: slugify(b.slug || b.name || b.nome || b), proportion: b.proportion != null ? Number(b.proportion) : null };
    }).filter(Boolean),
    species: asArray(d.species || d.specie).map(s => {
      if (!s) return null;
      const sci = s.scientificName || s.binomial || s.nomeScientifico || s.name || s;
      return { speciesSlug: slugify(s.slug || sci), role: (s.role || 'common').toString().toLowerCase(), abundance: s.abundance != null ? Number(s.abundance) : null };
    }).filter(Boolean),
  };
}

async function loadAll(globs){
  const files = await fg(globs, { cwd: repoRoot, absolute: true, dot: true, ignore: ['**/node_modules/**','**/.git/**'] });
  const out = [];
  for (const fp of files){
    try{
      const data = parseFile(fp);
      if (Array.isArray(data)) out.push(...data.map(d => ({ file: fp, data: d })));
      else if (data && typeof data === 'object') out.push({ file: fp, data });
      else if (data == null) ; else if (typeof data === 'string') out.push({ file: fp, data: { name: data } });
    } catch(e){ console.warn('Impossibile leggere', fp, e.message); }
  }
  return out;
}

async function upsertTraits(items){
  let n=0;
  for (const it of items){
    const t = normalizeTrait(it.data); if (!t) continue;
    if (verbose) console.log('Trait:', t.slug);
    if (!dryRun) await prisma.trait.upsert({ where: { slug: t.slug }, create: t, update: { name: t.name, description: t.description, category: t.category, unit: t.unit, dataType: t.dataType, allowedValues: t.allowedValues, rangeMin: t.rangeMin, rangeMax: t.rangeMax } });
    n++;
  }
  return n;
}
async function upsertBiomes(items){
  let n=0; const parents=[];
  for (const it of items){
    const b = normalizeBiome(it.data); if (!b) continue;
    if (verbose) console.log('Biome:', b.slug);
    if (!dryRun){ await prisma.biome.upsert({ where: { slug: b.slug }, create: { slug: b.slug, name: b.name, description: b.description, climate: b.climate }, update: { name: b.name, description: b.description, climate: b.climate } }); if (b.parentSlug) parents.push(b); }
    n++;
  }
  if (!dryRun){
    for (const b of parents){
      const parent = await prisma.biome.findUnique({ where: { slug: b.parentSlug } });
      const self = await prisma.biome.findUnique({ where: { slug: b.slug } });
      if (parent && self && self.parentId !== parent.id){ await prisma.biome.update({ where: { id: self.id }, data: { parentId: parent.id } }); }
    }
  }
  return n;
}
async function upsertSpecies(items){
  let n=0;
  for (const it of items){
    const s = normalizeSpecies(it.data); if (!s) continue;
    if (verbose) console.log('Species:', s.slug);
    if (!dryRun){
      const base = { slug: s.slug, scientificName: s.scientificName, commonName: s.commonName, kingdom: s.kingdom, phylum: s.phylum, class: s.class, order: s.order, family: s.family, genus: s.genus, epithet: s.epithet, status: s.status, description: s.description };
      const species = await prisma.species.upsert({ where: { slug: s.slug }, create: base, update: base });
      for (const tv of s.traits){
        const trait = await prisma.trait.upsert({ where: { slug: tv.traitSlug }, create: { slug: tv.traitSlug, name: tv.traitName, dataType: 'TEXT' }, update: {} });
        const data = { speciesId: species.id, traitId: trait.id, unit: tv.unit || null, category: tv.category || null, source: tv.source || null, confidence: tv.confidence != null ? Number(tv.confidence) : null, value: tv.value != null ? tv.value : null, num: typeof tv.value === 'number' ? Number(tv.value) : null, bool: typeof tv.value === 'boolean' ? !!tv.value : null, text: typeof tv.value === 'string' ? tv.value : null };
        await prisma.speciesTrait.upsert({ where: { speciesId_traitId_category: { speciesId: species.id, traitId: trait.id, category: data.category || null } }, create: data, update: data });
      }
      for (const hb of s.biomes){
        const biome = await prisma.biome.upsert({ where: { slug: hb.biomeSlug }, create: { slug: hb.biomeSlug, name: hb.biomeSlug }, update: {} });
        let presence = ['resident','migrant','introduced','endemic','unknown'].includes(hb.presence) ? hb.presence : 'resident';
        await prisma.speciesBiome.upsert({ where: { speciesId_biomeId: { speciesId: species.id, biomeId: biome.id } }, create: { speciesId: species.id, biomeId: biome.id, presence, abundance: hb.abundance ?? null }, update: { presence, abundance: hb.abundance ?? null } });
      }
    }
    n++;
  }
  return n;
}
async function upsertEcosystems(items){
  let n=0;
  for (const it of items){
    const e = normalizeEcosystem(it.data); if (!e) continue;
    if (verbose) console.log('Ecosystem:', e.slug);
    if (!dryRun){
      const eco = await prisma.ecosystem.upsert({ where: { slug: e.slug }, create: { slug: e.slug, name: e.name, description: e.description, region: e.region, climate: e.climate }, update: { name: e.name, description: e.description, region: e.region, climate: e.climate } });
      for (const b of e.biomes){
        const biome = await prisma.biome.upsert({ where: { slug: b.biomeSlug }, create: { slug: b.biomeSlug, name: b.biomeSlug }, update: {} });
        await prisma.ecosystemBiome.upsert({ where: { ecosystemId_biomeId: { ecosystemId: eco.id, biomeId: biome.id } }, create: { ecosystemId: eco.id, biomeId: biome.id, proportion: b.proportion ?? null }, update: { proportion: b.proportion ?? null } });
      }
      for (const s of e.species){
        const sp = await prisma.species.upsert({ where: { slug: s.speciesSlug }, create: { slug: s.speciesSlug, scientificName: s.speciesSlug }, update: {} });
        const role = ['keystone','dominant','engineer','common','invasive','other'].includes(s.role) ? s.role : 'common';
        await prisma.ecosystemSpecies.upsert({ where: { ecosystemId_speciesId_role: { ecosystemId: eco.id, speciesId: sp.id, role } }, create: { ecosystemId: eco.id, speciesId: sp.id, role, abundance: s.abundance ?? null }, update: { abundance: s.abundance ?? null } });
      }
    }
    n++;
  }
  return n;
}

(async () => {
  const cfg = configPath ? JSON.parse(fs.readFileSync(configPath, 'utf-8')) : defaultConfig;
  console.log('Repo:', repoRoot, dryRun ? '(dry-run)' : '');
  const [traitFiles, biomeFiles, speciesFiles, ecosystemFiles] = await Promise.all([
    (await require('fast-glob')(cfg.traits, { cwd: repoRoot, absolute: true, dot: true, ignore: ['**/node_modules/**','**/.git/**'] })).map(f=>({file:f,data:parseFile(f)})),
    (await require('fast-glob')(cfg.biomes, { cwd: repoRoot, absolute: true, dot: true, ignore: ['**/node_modules/**','**/.git/**'] })).map(f=>({file:f,data:parseFile(f)})),
    (await require('fast-glob')(cfg.species, { cwd: repoRoot, absolute: true, dot: true, ignore: ['**/node_modules/**','**/.git/**'] })).map(f=>({file:f,data:parseFile(f)})),
    (await require('fast-glob')(cfg.ecosystems, { cwd: repoRoot, absolute: true, dot: true, ignore: ['**/node_modules/**','**/.git/**'] })).map(f=>({file:f,data:parseFile(f)})),
  ]);
  const t = await upsertTraits(traitFiles);
  const b = await upsertBiomes(biomeFiles);
  const s = await upsertSpecies(speciesFiles);
  const e = await upsertEcosystems(ecosystemFiles);
  console.log('Import completato:', { traits: t, biomes: b, species: s, ecosystems: e });
  await prisma.$disconnect();
})().catch(err => { console.error(err); process.exit(1); });
