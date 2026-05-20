// server/utils/slug.js
// Canonical slug normalization for Game-Database.
// Lifted from server/scripts/ingest/import-taxonomy.js slugify() with
// added max-length truncation. Per spec PR-α (2026-05-20) Q1 resolved.

'use strict';

const MAX_SLUG_LENGTH = 80;

function buildSlug(source) {
  // TODO Task 2: implement after writing failing tests
  return '';
}

function normalizeSlug(value, fallback) {
  // TODO Task 2: implement after writing failing tests
  return '';
}

module.exports = { normalizeSlug, MAX_SLUG_LENGTH };
