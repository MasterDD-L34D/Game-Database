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

module.exports = {
  buildIdOrSlugWhere,
  findByIdOrSlug,
  findExistingByIdOrSlug,
};
