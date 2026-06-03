const { rateLimit } = require('express-rate-limit');
const { sendError } = require('../utils/httpErrors');

// Methods that mutate taxonomy state. GET/HEAD/OPTIONS are intentionally NOT
// here: the Game backend consumes Game-database read-only (GET
// /api/traits/glossary, see ADR-2026-04-14) so reads must never be limited,
// or legitimate imports would 429 and break the integration.
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_MUTATIONS = 100; // per IP per window

/**
 * Parses a positive integer from the environment.
 *
 * @param {string} name - The name of the environment variable.
 * @param {number} fallback - The default value to return if parsing fails.
 * @returns {number} The parsed integer or the fallback value.
 */
function parsePositiveIntEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Mutation-scoped rate limiter.
 *
 * Limits only POST/PUT/PATCH/DELETE (the CMS write surface, already gated by
 * requireTaxonomyWrite). Read traffic -- including the read-only Game backend
 * integration -- is skipped entirely, so this can never 429 a legitimate
 * taxonomy import.
 *
 * Configurable via env (conservative defaults):
 *   RATE_LIMIT_WINDOW_MS     window size in ms           (default 900000 = 15m)
 *   RATE_LIMIT_MAX_MUTATIONS max writes per IP / window  (default 100)
 *   RATE_LIMIT_ENABLED=false kill-switch (disables limiting entirely)
 *
 * @param {{ windowMs?: number, limit?: number }} [options] explicit overrides
 *        (used by tests); when omitted, env / defaults apply.
 */
function createMutationRateLimiter(options = {}) {
  const windowMs = options.windowMs || parsePositiveIntEnv('RATE_LIMIT_WINDOW_MS', DEFAULT_WINDOW_MS);
  const limit = options.limit || parsePositiveIntEnv('RATE_LIMIT_MAX_MUTATIONS', DEFAULT_MAX_MUTATIONS);

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip(req) {
      if (process.env.RATE_LIMIT_ENABLED === 'false') return true;
      return !MUTATION_METHODS.has(req.method);
    },
    handler(req, res) {
      sendError(res, 429, 'RATE_LIMITED', 'Too many write requests, please retry later.');
    },
  });
}

module.exports = { createMutationRateLimiter, MUTATION_METHODS };
