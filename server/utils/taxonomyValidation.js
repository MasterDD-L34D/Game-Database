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

async function findExistingByIdOrSlug(model, identifier, res, notFoundMessage = 'Not found') {
  const entity = await findByIdOrSlug(model, identifier);
  if (!entity) {
    res.status(404).json({ error: notFoundMessage });
    return null;
  }
  return entity;
}

module.exports = {
  buildIdOrSlugWhere,
  findByIdOrSlug,
  findExistingByIdOrSlug,
};
