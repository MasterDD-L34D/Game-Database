/**
 * Custom application error.
 *
 * @param {number} status The HTTP status code.
 * @param {string} code The application error code.
 * @param {string} message The error message.
 * @param {*} [details] Additional error details.
 */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Creates an error payload object.
 *
 * @param {string} code The application error code.
 * @param {string} message The error message.
 * @param {*} [details] Additional error details.
 * @returns {object} The error payload object.
 */
function errorPayload(code, message, details) {
  const payload = { code, message };
  if (details !== undefined) payload.details = details;
  return payload;
}

/**
 * Sends an error response.
 *
 * @param {object} res The Express response object.
 * @param {number} status The HTTP status code.
 * @param {string} code The application error code.
 * @param {string} message The error message.
 * @param {*} [details] Additional error details.
 * @returns {object} The Express response.
 */
function sendError(res, status, code, message, details) {
  return res.status(status).json(errorPayload(code, message, details));
}

/**
 * Handles an error and sends the appropriate response.
 *
 * @param {object} res The Express response object.
 * @param {Error} error The error object.
 * @param {object} [fallback] The fallback error information.
 * @returns {object} The Express response.
 */
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
