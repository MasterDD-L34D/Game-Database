#!/usr/bin/env node
// server/scripts/generate-schema-doc.js
// Auto-generate docs/schema-reference.md from server/prisma/schema.prisma.
// Per PR-γ (2026-05-20) Q3 resolved: schema-reference.md = canonical schema
// source (auto-gen), modal-game-database.md = manual dominio/runtime context.
//
// Usage:
//   node ./scripts/generate-schema-doc.js          # write doc
//   node ./scripts/generate-schema-doc.js --check  # exit 1 if doc out-of-sync

'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');
const DOC_PATH = path.resolve(__dirname, '..', '..', 'docs', 'schema-reference.md');

function stripLineComments(src) {
  return src
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, '').trimEnd())
    .join('\n');
}

function extractBlocks(src) {
  // Top-level blocks: kind name { ... }
  const blocks = [];
  const re = /(model|enum|generator|datasource)\s+(\w+)\s*\{([\s\S]*?)\}/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    blocks.push({ kind: m[1], name: m[2], body: m[3] });
  }
  return blocks;
}

function parseEnum(body) {
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('@'));
}

function parseModelFields(body) {
  const fields = [];
  const directives = []; // @@index, @@unique, @@map, etc.
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('@@')) {
      directives.push(line);
      continue;
    }
    // Field: name type modifiers...
    const m = line.match(/^(\w+)\s+([^\s]+)(?:\s+(.*))?$/);
    if (!m) continue;
    const [, name, type, modifiersRaw] = m;
    const modifiers = (modifiersRaw || '').trim();
    fields.push({ name, type, modifiers });
  }
  return { fields, directives };
}

function isRelationField(field) {
  return /^@relation\b/.test(field.modifiers) || / @relation\(/.test(field.modifiers);
}

function fieldKind(field) {
  if (isRelationField(field)) return 'relation';
  // Bare model-name type (e.g. Biome, Biome?, Biome[]) without @relation = back-side relation
  const base = field.type.replace(/[\?\[\]]/g, '');
  // Heuristic: capitalized non-primitive non-enum
  const PRIMITIVES = new Set(['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'Decimal', 'BigInt']);
  if (PRIMITIVES.has(base)) return 'scalar';
  // Will be reconciled in render (we treat as relation if name matches a known model)
  return 'maybeRelation';
}

function renderModifiers(modifiers) {
  if (!modifiers) return '';
  // Trim trailing whitespace, collapse multiple spaces
  return modifiers.replace(/\s+/g, ' ').trim();
}

function renderModel(name, body, modelNames) {
  const { fields, directives } = parseModelFields(body);
  const scalars = [];
  const relations = [];
  for (const f of fields) {
    const base = f.type.replace(/[\?\[\]]/g, '');
    const kind = fieldKind(f);
    const isRel = kind === 'relation' || (kind === 'maybeRelation' && modelNames.has(base));
    if (isRel) {
      relations.push(f);
    } else {
      scalars.push(f);
    }
  }

  const lines = [];
  lines.push(`### ${name}`);
  lines.push('');
  if (scalars.length > 0) {
    lines.push('| Field | Type | Modifiers |');
    lines.push('| --- | --- | --- |');
    for (const f of scalars) {
      const mods = renderModifiers(f.modifiers) || '—';
      lines.push(`| \`${f.name}\` | \`${f.type}\` | ${mods} |`);
    }
    lines.push('');
  }
  if (relations.length > 0) {
    lines.push('**Relations**');
    lines.push('');
    for (const f of relations) {
      const mods = renderModifiers(f.modifiers);
      const suffix = mods ? ` — ${mods}` : '';
      lines.push(`- \`${f.name}\`: \`${f.type}\`${suffix}`);
    }
    lines.push('');
  }
  if (directives.length > 0) {
    lines.push('**Block directives**');
    lines.push('');
    for (const d of directives) {
      lines.push(`- \`${d}\``);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function renderEnum(name, body) {
  const values = parseEnum(body);
  const lines = [];
  lines.push(`### ${name}`);
  lines.push('');
  for (const v of values) {
    lines.push(`- \`${v}\``);
  }
  lines.push('');
  return lines.join('\n');
}

function generate() {
  const raw = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const stripped = stripLineComments(raw);
  const blocks = extractBlocks(stripped);

  const models = blocks.filter((b) => b.kind === 'model');
  const enums = blocks.filter((b) => b.kind === 'enum');

  const modelNames = new Set(models.map((m) => m.name));

  const out = [];
  out.push('# Schema Reference');
  out.push('');
  out.push('**Auto-generated** from `server/prisma/schema.prisma` by');
  out.push('`server/scripts/generate-schema-doc.js`. Do **not** edit by hand —');
  out.push('changes will be overwritten next time `npm run schema:doc` runs');
  out.push('(also gated in CI via `npm run schema:doc:check`).');
  out.push('');
  out.push('For dominio/runtime/operational context (not schema), see');
  out.push('[`modal-game-database.md`](./modal-game-database.md).');
  out.push('');
  out.push(`> Generator entry: \`server/scripts/generate-schema-doc.js\``);
  out.push(`> Source schema: \`server/prisma/schema.prisma\``);
  out.push(`> Models: ${models.length} · Enums: ${enums.length}`);
  out.push('');
  out.push('## Table of contents');
  out.push('');
  out.push('- [Models](#models)');
  for (const m of models) {
    const anchor = m.name.toLowerCase();
    out.push(`  - [${m.name}](#${anchor})`);
  }
  out.push('- [Enums](#enums)');
  for (const e of enums) {
    const anchor = e.name.toLowerCase();
    out.push(`  - [${e.name}](#${anchor})`);
  }
  out.push('');
  out.push('## Models');
  out.push('');
  for (const m of models) {
    out.push(renderModel(m.name, m.body, modelNames));
  }
  out.push('## Enums');
  out.push('');
  for (const e of enums) {
    out.push(renderEnum(e.name, e.body));
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function readDocIfExists() {
  try {
    return fs.readFileSync(DOC_PATH, 'utf8');
  } catch {
    return null;
  }
}

function main() {
  const args = new Set(process.argv.slice(2));
  const check = args.has('--check');
  const generated = generate();

  if (check) {
    const current = readDocIfExists();
    if (current === generated) {
      process.stdout.write('schema-reference.md is up-to-date\n');
      process.exit(0);
    }
    process.stderr.write('schema-reference.md is OUT-OF-SYNC with schema.prisma\n');
    process.stderr.write('Run: npm run schema:doc\n');
    process.exit(1);
  }

  fs.writeFileSync(DOC_PATH, generated, 'utf8');
  process.stdout.write(`Wrote ${DOC_PATH} (${generated.length} chars)\n`);
}

if (require.main === module) {
  main();
}

module.exports = { generate };
