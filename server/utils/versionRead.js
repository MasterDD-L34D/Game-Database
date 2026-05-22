'use strict';
// Read-side counterpart to versionSnapshot.js. Resolves a release tag to its
// version row and maps a snapshot row back into the master trait shape. Pure
// mapper + a single prisma read; no audit, no side effects.

const prisma = require('../db/prisma');
const { AppError } = require('./httpErrors');
const { FIELD_MAP } = require('./versionSnapshot');

// Resolve a release tag to a readable version row.
// 404 if unknown, 400 if still a draft. Released or retired both serve the
// snapshot (retired stays readable as historical data).
async function resolveReleasedVersion(tag) {
  const version = await prisma.taxonomyVersion.findUnique({ where: { tag } });
  if (!version) {
    throw new AppError(404, 'VERSION_NOT_FOUND', 'Version not found', { tag });
  }
  if (version.status === 'draft') {
    throw new AppError(400, 'VERSION_NOT_RELEASED', 'Version is a draft and has no snapshot', { tag });
  }
  return version;
}

// Map a TraitVersion snapshot row into the master trait shape. id is the
// stable master traitId; snapshot-only columns are dropped.
function traitVersionToTrait(row) {
  const out = { id: row.traitId };
  for (const f of FIELD_MAP.trait.fields) out[f] = row[f];
  return out;
}

module.exports = { resolveReleasedVersion, traitVersionToTrait };
