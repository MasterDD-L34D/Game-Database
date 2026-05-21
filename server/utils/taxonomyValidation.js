const buildIdOrSlugWhere = identifier => ({
  OR: [
    { id: identifier },
    { slug: identifier },
  ],
});

async function findByIdOrSlug(model, identifier) {
  if (!identifier) return null;
  return model.findFirst({ where: buildIdOrSlugWhere(identifier) });
}

const { AppError } = require('./httpErrors');

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
