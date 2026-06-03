const { AppError } = require('./httpErrors');

/**
 * Asserts that a value is a valid string.
 *
 * @param {any} value - The value to check.
 * @param {string} field - The name of the field being validated.
 * @param {Object} [options] - Validation options.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @param {boolean} [options.trim=true] - Whether to trim the string before validating length.
 * @param {number} [options.minLength=0] - The minimum length required for the string.
 * @returns {string|undefined} The validated (and possibly trimmed) string, or undefined if not required and absent.
 * @throws {AppError} If validation fails.
 */
function assertString(value, field, { required = false, trim = true, minLength = 0 } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new AppError(400, 'VALIDATION_ERROR', `${field} is required`, { field, location: 'body' });
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be a string`, { field, location: 'body' });
  }

  const normalized = trim ? value.trim() : value;
  if (required && normalized.length < Math.max(minLength, 1)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} cannot be empty`, { field, location: 'body' });
  }

  return normalized;
}

/**
 * Asserts that a value is one of the allowed values.
 *
 * @param {any} value - The value to check.
 * @param {Array<any>} allowedValues - The allowed values.
 * @param {string} field - The name of the field being validated.
 * @param {Object} [options] - Validation options.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @returns {any|undefined} The validated value, or undefined if not required and absent.
 * @throws {AppError} If validation fails.
 */
function assertEnum(value, allowedValues, field, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new AppError(400, 'VALIDATION_ERROR', `${field} is required`, { field, location: 'body' });
    return undefined;
  }
  if (!allowedValues.includes(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} has an invalid value`, {
      field,
      location: 'body',
      allowedValues,
    });
  }
  return value;
}

/**
 * Asserts that pagination parameters in a query object are valid.
 *
 * @param {Object} query - The query object.
 * @param {string|number} [query.page='0'] - The requested page number.
 * @param {string|number} [query.pageSize='25'] - The requested page size.
 * @returns {{page: number, pageSize: number}} The parsed and validated pagination parameters.
 * @throws {AppError} If validation fails.
 */
function assertPagination(query) {
  const parsedPage = Number.parseInt(query.page ?? '0', 10);
  const parsedPageSize = Number.parseInt(query.pageSize ?? '25', 10);

  if (Number.isNaN(parsedPage) || parsedPage < 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'page must be an integer >= 0', { field: 'page', location: 'query' });
  }
  if (Number.isNaN(parsedPageSize) || parsedPageSize < 1 || parsedPageSize > 100) {
    throw new AppError(400, 'VALIDATION_ERROR', 'pageSize must be an integer between 1 and 100', { field: 'pageSize', location: 'query' });
  }

  return { page: parsedPage, pageSize: parsedPageSize };
}

/**
 * Asserts that an ID parameter in a params object is valid.
 *
 * @param {Object} params - The parameters object.
 * @param {string} [field='id'] - The field name of the ID.
 * @returns {string} The validated ID string.
 * @throws {AppError} If validation fails.
 */
function assertIdParam(params, field = 'id') {
  const raw = params[field];
  if (!raw || typeof raw !== 'string' || raw.trim() === '') {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} param is required`, { field, location: 'params' });
  }
  return raw;
}

/**
 * Normalizes an ID value by converting it to a string and trimming it.
 *
 * @param {any} value - The ID value to normalize.
 * @returns {string} The normalized ID string, or an empty string if null or undefined.
 */
function normalizeId(value) {
  if (value == null) return '';
  return String(value).trim();
}

module.exports = {
  assertString,
  assertEnum,
  assertPagination,
  assertIdParam,
  normalizeId,
};
