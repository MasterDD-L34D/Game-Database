'use strict';
// Returns a Prisma where-fragment hiding soft-deleted rows, unless the caller
// opts in with ?includeDeleted=true. Spread into master where-clauses:
//   { ...liveFilter(req), ...otherConditions }
function liveFilter(req) {
  const includeDeleted = req && req.query && req.query.includeDeleted === 'true';
  return includeDeleted ? {} : { deletedAt: null };
}

module.exports = { liveFilter };
