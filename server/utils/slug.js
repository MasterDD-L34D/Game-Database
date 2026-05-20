// server/utils/slug.js
// Canonical slug normalization for Game-Database.
// Pipeline: NFD normalize → strip combining marks → lowercase →
// replace non-alphanum with hyphen → trim → length cap → re-trim.
// Per spec PR-α (2026-05-20) Q1 resolved: custom regex consolidate,
// no npm dependency. Aligned with codemasterdd ADR-0021 ASCII-first.

'use strict';

const MAX_SLUG_LENGTH = 80;

function buildSlug(source) {
  if (source == null) return '';
  const raw = String(source);
  if (!raw) return '';
  const normalized = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  if (!normalized) return '';
  if (normalized.length <= MAX_SLUG_LENGTH) return normalized;
  return normalized.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '');
}

function normalizeSlug(value, fallback) {
  const fromValue = buildSlug(value);
  if (fromValue) return fromValue;
  if (fallback !== undefined && fallback !== null) {
    return buildSlug(fallback);
  }
  return '';
}

module.exports = { normalizeSlug, MAX_SLUG_LENGTH };
