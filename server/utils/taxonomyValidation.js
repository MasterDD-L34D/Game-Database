/**
 * Builds a where condition to find by id or slug.
 *
 * @param {string} identifier - The id or slug to search for.
 * @returns {object} The where condition object.
 */
const buildIdOrSlugWhere = identifier => ({
  OR: [
    { id: identifier },
    { slug: identifier },
  ],
});

/**
 * Finds a record by its id or slug.
 *
 * @param {object} model - The Prisma model delegate.
 * @param {string} identifier - The id or slug to search for.
 * @returns {Promise<object|null>} The entity if found, or null otherwise.
 */
async function findByIdOrSlug(model, identifier) {
  if (!identifier) return null;
  return model.findFirst({ where: buildIdOrSlugWhere(identifier) });
}

const { AppError } = require('./httpErrors');

/**
 * Finds an existing record by id or slug. Throws an error or sends a 404 response if not found.
 *
 * @param {object} model - The Prisma model delegate.
 * @param {string} identifier - The id or slug to search for.
 * @param {object} [res] - Optional Express response object.
 * @param {string} [notFoundMessage='Not found'] - The error message to use if the record is not found.
 * @returns {Promise<object|null>} The entity if found.
 */
async function findExistingByIdOrSlug(model, identifier, res, notFoundMessage = 'Not found') {
  const entity = await findByIdOrSlug(model, identifier);
  if (!entity) {
    if (res) {
      const { sendError } = require('./httpErrors');
      sendError(res, 404, 'NOT_FOUND', notFoundMessage, { identifier });
      return null;
    }
    throw new AppError(404, 'NOT_FOUND', notFoundMessage, { identifier });
  }
  return entity;
}

/**
 * Asserts that a master record is not captured in a released taxonomy version snapshot.
 *
 * @param {object} snapshotDelegate - The Prisma model delegate for the snapshot.
 * @param {string} fkField - The foreign key field name.
 * @param {string} masterId - The ID of the master record.
 * @param {string} entityLabel - A label for the entity type.
 * @returns {Promise<void>}
 */
// RFC #1 Phase A immutability guard. A master row captured in a *released*
// taxonomy version must not be hard-deleted, otherwise the FK onDelete: Cascade
// would silently erase its frozen released snapshots. Soft-delete (which lets a
// master be retired while its released history survives) is deferred to Phase B
// (RFC #1 Q7); until then, deletion is blocked at the application layer.
async function assertNotInReleasedVersion(snapshotDelegate, fkField, masterId, entityLabel) {
  const released = await snapshotDelegate.count({
    where: { [fkField]: masterId, version: { status: 'released' } },
  });
  if (released > 0) {
    throw new AppError(
      409,
      'VERSION_IMMUTABLE',
      `Cannot hard-delete this ${entityLabel}: it is captured in ${released} released version snapshot(s). Soft-delete arrives in Phase B (RFC #1 Q7).`,
      { released },
    );
  }
}

module.exports = {
  buildIdOrSlugWhere,
  findByIdOrSlug,
  findExistingByIdOrSlug,
  assertNotInReleasedVersion,
};
