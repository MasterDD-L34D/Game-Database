const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { AppError, errorPayload, sendError, handleError } = require('../utils/httpErrors');

describe('httpErrors', () => {
  describe('AppError', () => {
    it('should set name, status, code, message, and details', () => {
      const details = { field: 'value' };
      const err = new AppError(400, 'BAD_REQUEST', 'Bad request message', details);
      
      assert.equal(err.name, 'AppError');
      assert.equal(err.status, 400);
      assert.equal(err.code, 'BAD_REQUEST');
      assert.equal(err.message, 'Bad request message');
      assert.deepEqual(err.details, details);
      assert.ok(err instanceof Error);
    });

    it('should allow missing details', () => {
      const err = new AppError(404, 'NOT_FOUND', 'Not found');
      
      assert.equal(err.name, 'AppError');
      assert.equal(err.status, 404);
      assert.equal(err.code, 'NOT_FOUND');
      assert.equal(err.message, 'Not found');
      assert.equal(err.details, undefined);
    });
  });

  describe('errorPayload', () => {
    it('should include details only when provided', () => {
      const details = { info: 'extra' };
      const payloadWithDetails = errorPayload('ERR_CODE', 'Error message', details);
      
      assert.deepEqual(payloadWithDetails, {
        code: 'ERR_CODE',
        message: 'Error message',
        details
      });

      const payloadWithoutDetails = errorPayload('ERR_CODE', 'Error message');
      assert.deepEqual(payloadWithoutDetails, {
        code: 'ERR_CODE',
        message: 'Error message'
      });
      assert.equal('details' in payloadWithoutDetails, false);
    });
  });

  describe('sendError', () => {
    it('should call res.status(status).json(errorPayload(...))', () => {
      const res = {
        _s: null,
        _j: null,
        status(c) {
          this._s = c;
          return this;
        },
        json(b) {
          this._j = b;
          return this;
        }
      };

      const details = { some: 'detail' };
      const result = sendError(res, 403, 'FORBIDDEN', 'Access denied', details);

      assert.equal(result, res);
      assert.equal(res._s, 403);
      assert.deepEqual(res._j, {
        code: 'FORBIDDEN',
        message: 'Access denied',
        details
      });
    });
  });

  describe('handleError', () => {
    it('should map an AppError to its status and code', () => {
      const res = {
        _s: null,
        _j: null,
        status(c) {
          this._s = c;
          return this;
        },
        json(b) {
          this._j = b;
          return this;
        }
      };

      const err = new AppError(401, 'UNAUTHORIZED', 'Not authorized', { reason: 'expired' });
      const result = handleError(res, err);

      assert.equal(result, res);
      assert.equal(res._s, 401);
      assert.deepEqual(res._j, {
        code: 'UNAUTHORIZED',
        message: 'Not authorized',
        details: { reason: 'expired' }
      });
    });

    it('should fall back to 500 for a generic Error', () => {
      const res = {
        _s: null,
        _j: null,
        status(c) {
          this._s = c;
          return this;
        },
        json(b) {
          this._j = b;
          return this;
        }
      };

      // Suppress console.error during this test since handleError logs non-AppErrors
      const originalConsoleError = console.error;
      let loggedError = null;
      console.error = (err) => { loggedError = err; };

      const err = new Error('Some generic error');
      
      try {
        const result = handleError(res, err);

        assert.equal(result, res);
        assert.equal(res._s, 500);
        assert.deepEqual(res._j, {
          code: 'INTERNAL_ERROR',
          message: 'Internal error'
        });
        assert.equal(loggedError, err);
      } finally {
        console.error = originalConsoleError;
      }
    });

    it('should use custom fallback if provided', () => {
      const res = {
        _s: null,
        _j: null,
        status(c) {
          this._s = c;
          return this;
        },
        json(b) {
          this._j = b;
          return this;
        }
      };

      const originalConsoleError = console.error;
      console.error = () => {}; // suppress

      try {
        const err = new Error('Another generic error');
        const customFallback = { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Down', details: { retry: true } };
        const result = handleError(res, err, customFallback);

        assert.equal(result, res);
        assert.equal(res._s, 503);
        assert.deepEqual(res._j, {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Down',
          details: { retry: true }
        });
      } finally {
        console.error = originalConsoleError;
      }
    });
  });
});
