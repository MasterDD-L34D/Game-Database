const { AppError } = require('./httpErrors');

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

function assertIdParam(params, field = 'id') {
  const raw = params[field];
  if (!raw || typeof raw !== 'string' || raw.trim() === '') {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} param is required`, { field, location: 'params' });
  }
  return raw;
}

module.exports = {
  assertString,
  assertEnum,
  assertPagination,
  assertIdParam,
};
