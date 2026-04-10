class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function errorPayload(code, message, details) {
  const payload = { code, message };
  if (details !== undefined) payload.details = details;
  return payload;
}

function sendError(res, status, code, message, details) {
  return res.status(status).json(errorPayload(code, message, details));
}

function handleError(res, error, fallback = { status: 500, code: 'INTERNAL_ERROR', message: 'Internal error' }) {
  if (error instanceof AppError) {
    return sendError(res, error.status, error.code, error.message, error.details);
  }
  console.error(error);
  return sendError(res, fallback.status, fallback.code, fallback.message, fallback.details);
}

module.exports = {
  AppError,
  errorPayload,
  sendError,
  handleError,
};
