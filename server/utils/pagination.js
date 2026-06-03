/**
 * Normalizes a search query object into a string.
 *
 * @param {Object} [query={}] - The query object.
 * @param {string} [query.q] - The search query string.
 * @param {string} [query.search] - An alternative search query string.
 * @returns {string} The normalized search query string.
 */
function normalizeSearchQuery(query = {}) {
  const raw = query.q ?? query.search ?? '';
  return String(raw).trim();
}

/**
 * Normalizes a sort string into a sort array.
 * Parses sort syntax where a leading '-' means descending (e.g. '-name'),
 * or a 'field:direction' form is used (e.g. 'name:desc').
 *
 * @param {string} rawSort - The raw sort string.
 * @param {Object} [options={}] - Options for normalization.
 * @param {string[]} [options.allowedFields=[]] - A whitelist of allowed fields.
 * @param {*} [options.fallback] - The fallback to return if the field is not allowed or input is empty.
 * @returns {Object[]|*} An array containing a sort object, or the fallback.
 */
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

/**
 * Wraps items in a paginated result object.
 *
 * @param {Array} items - The items to include in the result.
 * @param {number} page - The current page number.
 * @param {number} pageSize - The number of items per page.
 * @param {number} total - The total number of items available.
 * @returns {Object} The paginated result containing items and pagination details.
 */
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
