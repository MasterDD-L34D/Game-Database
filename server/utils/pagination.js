function normalizeSearchQuery(query = {}) {
  const raw = query.q ?? query.search ?? '';
  return String(raw).trim();
}

function normalizeSort(rawSort, { allowedFields = [], fallback } = {}) {
  if (!rawSort) return fallback;

  const normalized = String(rawSort).trim();
  if (!normalized) return fallback;

  let field = normalized;
  let direction = 'asc';

  if (normalized.startsWith('-')) {
    field = normalized.slice(1);
    direction = 'desc';
  } else if (normalized.includes(':')) {
    const [sortField, sortDirection] = normalized.split(':', 2);
    field = sortField;
    if (sortDirection && sortDirection.toLowerCase() === 'desc') {
      direction = 'desc';
    }
  }

  if (!allowedFields.includes(field)) return fallback;
  return [{ [field]: direction }];
}

function toPagedResult(items, page, pageSize, total) {
  const safeTotal = Number.isFinite(total) ? Number(total) : 0;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Number(pageSize) : 25;
  return {
    items,
    pagination: {
      page,
      pageSize: safePageSize,
      total: safeTotal,
      totalPages: Math.ceil(safeTotal / safePageSize),
    },
  };
}

module.exports = {
  normalizeSearchQuery,
  normalizeSort,
  toPagedResult,
};
