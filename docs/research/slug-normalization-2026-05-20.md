# Research — Slug normalization edge cases

**Date**: 2026-05-20
**Component**: `server/utils/slug.js` (PR-α)
**Author**: parallel-#2 session (Ryzen)
**Spec reference**: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` Q1 resolved

## Goal

Document the 3+ edge case scenarios that motivated PR-α slug consolidation, the chosen pipeline, and the trade-offs accepted.

## Edge case scenarios investigated

### Scenario 1 — Unicode diacritics (Italian taxonomy)

**Input**: Italian common names with grave/acute accents (e.g. "Lùpus rufus", "Erbàcee perenni", "Maremma toscàna").

**Pre-PR behavior**: All 4 routes used `trim().toLowerCase().replace(/\s+/g, '-')` — left diacritics intact. Result: `"lùpus-rufus"`.

**Problem**: Postgres `varchar @unique` accepts the Unicode slug, but URL-encoding for HTTP routes (`/api/species/lùpus-rufus`) produces `/api/species/l%C3%B9pus-rufus` — works but ugly, breaks copy-paste workflows, and inconsistent with the import pipeline (`import-taxonomy.js:85-92` already NFD-strips).

**Post-PR behavior**: NFD decomposition + combining-marks strip (U+0300–U+036F) → `"lupus-rufus"`. Round-trip via import preserves canonical form.

**Evidence**: `slug.test.js` tests `unicode: strips Italian diacritics`, `unicode: strips French and Spanish diacritics`, `unicode: strips combining marks while preserving base latin chars`.

### Scenario 2 — Length blow-out (no cap pre-PR)

**Input**: User pastes long descriptive name as slug source (e.g. a 250-char scientific binomial with subspecies + locality).

**Pre-PR behavior**: No length cap. `Prisma String @unique` accepts but Postgres B-tree index on long varchar bloats and `/api/.../:id` URL exceeds 2KB browser limit at ~500 chars.

**Post-PR behavior**: Max 80 chars, post-slice trailing-dash strip prevents `aaaaaaaa-` artifacts when slice lands on a hyphen boundary.

**Evidence**: `slug.test.js` tests `length: truncates to MAX_SLUG_LENGTH (80)`, `length: post-slice trims trailing dash if slice lands on hyphen boundary`.

**Trade-off**: Pre-existing slugs >80 chars (if any) would fail re-normalization round-trip. Audit via `npm run audit:slug` catches them. **Baseline measured at PR-α commit time: 433 rows scanned (192 trait + 209 biome + 23 species + 9 ecosystem), `totalOverMax = 0`, `totalDrift = 0`, `totalCollisions = 0`.** Migration plan: if any production row >80, separate follow-up PR to truncate + handle collisions.

### Scenario 3 — Trailing/leading dash from punctuation prefix/suffix

**Input**: Names with leading/trailing punctuation, apostrophes, emoji (e.g. "—Trait", "L'arbre du desert", "Trait 🌿 green").

**Pre-PR behavior**: Weak regex only handled whitespace, so apostrophes and emoji passed through OR were mangled inconsistently across routes (some lower-cased, some not depending on call site).

**Post-PR behavior**: `[^a-z0-9]+ → -` then `(^-|-$) → ''` strips all non-alphanum to single hyphens, trims edges.

**Evidence**: `slug.test.js` tests `punct: replaces apostrophes`, `punct: replaces consecutive special chars`, `punct: strips emoji and non-ASCII symbols`, `trim: removes leading dash`, `trim: removes trailing dash`, `trim: handles wrap-only special chars`.

### Scenario 4 — Empty + fallback semantics

**Input**: API client sends `body.slug` empty, expects fallback derivation from `body.name` / `body.scientificName` / `body.commonName`.

**Pre-PR behavior**: Route call sites used `normalizeSlug(body.slug || name)` — short-circuits to `name` if slug empty, but `test/utils.js` used a 2-arg `normalizeSlug(value, fallback)` with different semantics (fallback even if value normalizes to empty post-pipeline). Two contracts coexisted.

**Post-PR behavior**: Single 2-arg signature. `normalizeSlug(value, fallback)`:
- Tries `value` first.
- If `value` yields empty post-pipeline (special-chars-only, whitespace-only, null/undefined), tries `fallback`.
- Returns `''` only when both fail.

Routes can still call `normalizeSlug(body.slug || name)` (single-arg) — equivalent to old behavior except now also rejects empty-post-pipeline value before considering fallback (no fallback available in single-arg, so empty wins).

**Evidence**: `slug.test.js` tests `fallback: uses fallback when value is empty`, `fallback: prefers value over fallback when both present`, `fallback: tries fallback if value normalizes to empty (special-chars-only)`.

## Cross-repo audit (per spec NO-GO contract)

Read-only audit confirmed during autoresearch for spec Q1 (2026-05-20):

- **Game** (`C:/dev/Game`): 4 separate JS slugifiers + 2 Python slugifiers. JS variants use `_` separator (e.g. `apps/backend/app.js:80`); Python uses `-`. Static YAML `legacy_slug` values are underscore-form (`arbusti_xerofili`, `sand_burrower`). Game-Database's `import-taxonomy.js` already re-slugifies on read to hyphen-form — PR-α preserves this contract.
- **codemasterdd-ai-station** ADR-0021 + CLAUDE.md mandate **ASCII-first**: PR-α pipeline produces pure ASCII (`[a-z0-9-]+`) — fully compliant.
- **vault**, **Game-Godot-v2**: NOT inspected (NO-GO per parallel-session boundary contract).

No breaking change for Game runtime or YAML files. Game-side `_`-vs-`-` slug inconsistency is **out-of-scope** for PR-α; flagged as candidate for future cross-repo RFC.

## Trade-offs accepted

1. **No non-Latin transliteration**: PR-α does not convert Cyrillic/CJK/Arabic to Latin. Result: non-Latin-only input → empty slug → fallback parameter (or empty if no fallback). For Evo-Tactics (Latin binomials + Italian commons), this is correct. Future taxonomies with non-Latin names would need explicit fallback values (e.g. scientific name field).
2. **Max-length 80 hard-coded**: Single constant `MAX_SLUG_LENGTH` in module. Easy to change but not env-configurable. Acceptable for a single-tenant designer CMS.
3. **Backward-compat in import script**: `slugify(value)` alias preserved over `normalizeSlug(value)` rename to avoid 30+ call-site churn in `import-taxonomy.js`. Internal contract identical.

## Baseline measurement (QG Step 3 — Tuning)

```json
{
  "timestamp": "2026-05-20T11:XX:XX.XXXZ",
  "maxSlugLength": 80,
  "summary": {
    "totalRows": 433,
    "totalOverMax": 0,
    "totalDrift": 0,
    "totalCollisions": 0
  }
}
```

Per-model breakdown (trait/biome/species/ecosystem):
- trait: 192 rows
- biome: 209 rows
- species: 23 rows
- ecosystem: 9 rows

All four models report zero drift, zero overMax, zero collisions on seed data. Post-PR-α invariant established: any future seed/import regression on these axes is now detectable via `npm run audit:slug`.

## Open follow-ups (out-of-scope for PR-α)

- Prisma migration to add `slug @db.VarChar(80)` constraint. Baseline shows `overMaxCount = 0` so safe to enforce, but defer to follow-up PR to keep PR-α scope focused.
- Cross-repo slug-format RFC for `_` vs `-` consistency between Game and Game-Database. Defer to future RFC (coordinator gate).
- pg_trgm index on slug for Fase 2 search-as-you-type. Defer to PR Fase 2.

## References

- Spec: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` Q1
- Source pipeline: `server/scripts/ingest/import-taxonomy.js:85-92` (pre-PR-α)
- Anti-pattern catalog: `~/.claude/CLAUDE.md` #1 (DRY across processes), ADR-0021 ASCII-first
- Past coverage: PR #114 (PUT ecosystems), PR #116 (masters CRUD coverage)
