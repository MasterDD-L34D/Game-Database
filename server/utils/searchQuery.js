const { Prisma } = require('@prisma/client');
const { AppError } = require('./httpErrors');

// Allowlist: entity key -> { table, cols (searchable text), label col, slug col|null }.
// Table/column names are hardcoded here and NEVER taken from user input.
// All identifiers are double-quoted because the Prisma schema uses default
// (case-sensitive PascalCase/camelCase) mapping — no @@map.
const ENTITY_MAP = {
  trait:     { table: 'Trait',     cols: ['name', 'slug'],                         label: 'name',           slug: 'slug', entity: 'Trait', softDeletable: true },
  biome:     { table: 'Biome',     cols: ['name', 'slug'],                         label: 'name',           slug: 'slug', entity: 'Biome', softDeletable: true },
  ecosystem: { table: 'Ecosystem', cols: ['name', 'slug'],                         label: 'name',           slug: 'slug', entity: 'Ecosystem', softDeletable: true },
  species:   { table: 'Species',   cols: ['scientificName', 'commonName', 'slug'], label: 'scientificName', slug: 'slug', entity: 'Species', softDeletable: true },
  record:    { table: 'Record',    cols: ['nome', 'descrizione'],                  label: 'nome',           slug: null,   entity: 'Record' },
};

const ALL_ENTITIES = Object.keys(ENTITY_MAP);

function parseEntities(csv) {
  if (!csv) return [...ALL_ENTITIES];
  const tokens = String(csv)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return [...ALL_ENTITIES];
  const seen = [];
  for (const t of tokens) {
    if (!ENTITY_MAP[t]) {
      throw new AppError(400, 'VALIDATION_ERROR', `Unknown entity: ${t}`, {
        field: 'entities',
        allowed: ALL_ENTITIES,
      });
    }
    if (!seen.includes(t)) seen.push(t);
  }
  return seen;
}

function ident(name) {
  // name is from the hardcoded allowlist only — safe to inject raw, quoted.
  return Prisma.raw(`"${name}"`);
}

function armFor(key, q) {
  const { table, cols, label, slug, entity } = ENTITY_MAP[key];
  const simExprs = cols.map((c) => Prisma.sql`similarity(${ident(c)}, ${q})`);
  const score = Prisma.sql`GREATEST(${Prisma.join(simExprs, ', ')})`;
  // WHERE uses the pg_trgm `%` operator (GIN-trgm-index accelerated). The
  // similarity floor is supplied per-request via set_limit() (see route), so
  // `col % q` means similarity(col, q) >= the session threshold. similarity()
  // is still computed in SELECT for ranking only.
  const matchExprs = cols.map((c) => Prisma.sql`${ident(c)} % ${q}`);
  const whereMatch = Prisma.join(matchExprs, ' OR ');
  const slugExpr = slug ? Prisma.sql`${ident(slug)}` : Prisma.sql`NULL`;
  const live = ENTITY_MAP[key].softDeletable ? Prisma.sql` AND "deletedAt" IS NULL` : Prisma.empty;
  return Prisma.sql`
    SELECT ${entity}::text AS entity, "id", ${slugExpr} AS slug, ${ident(label)} AS label, ${score} AS score
      FROM ${ident(table)}
     WHERE (${whereMatch})${live}`;
}

function buildFuzzySearchSql({ entities, q, limit }) {
  const list = parseEntities(entities);
  const arms = list.map((key) => armFor(key, q));
  return Prisma.sql`
    SELECT entity, id, slug, label, score FROM (
      ${Prisma.join(arms, ' UNION ALL ')}
    ) ranked
    ORDER BY score DESC, label ASC
    LIMIT ${limit}`;
}

module.exports = { ENTITY_MAP, ALL_ENTITIES, parseEntities, buildFuzzySearchSql };
