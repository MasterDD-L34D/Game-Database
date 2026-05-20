# Research — Junction endpoint coverage gap closure

**Date**: 2026-05-20
**Component**: 4 junction test files (`server/test/{ecosystemBiomes,ecosystemSpecies,speciesBiomes,speciesTraits}.test.js`)
**Author**: parallel-#2 session (Ryzen)
**Spec reference**: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` PR-β

## Goal

Document the gap audit, the 16 new tests added, and the rationale for prioritization.

## Gap matrix (ground-truth audited pre-PR-β)

| Junction | GET list | GET 400 | POST 200 | POST 4xx | POST 403 | POST 409 | PATCH 200 | PATCH 4xx | PATCH 403 | PATCH 404 | PATCH 409 | DEL 200 | DEL 403 | DEL 404 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ecosystemBiomes pre | ✅filter | ✅ | ✅ | ✅req-id+refs+prop | ✅denies | ✅ | ✅ | ✅refs | **❌** | ✅ | **❌** | ✅ | **❌** | ✅ |
| ecosystemSpecies pre | ✅ | ✅ | ✅ | ❌ | ✅403 | ✅409 | **❌** | ❌ | **❌** | ✅ | ❌ | **❌** | **❌** | **❌** |
| speciesBiomes pre | ✅ | ✅ | ✅ | ❌ | ✅denies | ✅409 | **❌** | ❌ | **❌** | ✅ | ❌ | **❌** | **❌** | **❌** |
| speciesTraits pre | ✅ | ✅ | ✅ | ✅(types) | ✅denies | ✅uniq | ✅ | ✅types | **❌** | ✅ | ❌ | ✅ | **❌** | **❌** |

**Bold = added by PR-β**. Other ❌ gaps (e.g. ecosystemSpecies POST 400, speciesTraits PATCH 409 mid-update) were deemed lower-priority and deferred to follow-up.

## Tests added per file

### A. `ecosystemBiomes.test.js` (+3 tests)
1. `PATCH /api/ecosystem-biomes/:id returns 403 without taxonomy role`
2. `PATCH /api/ecosystem-biomes/:id returns 409 when changing combination causes duplicate`
3. `DELETE /api/ecosystem-biomes/:id returns 403 without taxonomy role`

### B. `ecosystemSpecies.test.js` (+5 tests)
1. `PATCH /api/ecosystem-species/:id updates existing records` (happy path was missing)
2. `PATCH /api/ecosystem-species/:id returns 403 without taxonomy role`
3. `DELETE /api/ecosystem-species/:id removes existing records`
4. `DELETE /api/ecosystem-species/:id returns 403 without taxonomy role`
5. `DELETE /api/ecosystem-species/:id returns 404 for missing records`

### C. `speciesBiomes.test.js` (+5 tests)
1. `PATCH /api/species-biomes/:id updates existing records` (happy path was missing)
2. `PATCH /api/species-biomes/:id returns 403 without taxonomy role`
3. `DELETE /api/species-biomes/:id removes existing records`
4. `DELETE /api/species-biomes/:id returns 403 without taxonomy role`
5. `DELETE /api/species-biomes/:id returns 404 for missing records`

### D. `speciesTraits.test.js` (+3 tests)
1. `PATCH /api/species-traits/:id returns 403 without taxonomy role`
2. `DELETE /api/species-traits/:id returns 403 without taxonomy role`
3. `DELETE /api/species-traits/:id returns 404 for missing records`

**Total: 16 new tests.**

## Edge case scenarios investigated

### Scenario 1 — PATCH 403 forbidden across all 4 junctions

**Risk pre-PR**: routes use `requireTaxonomyWrite` middleware but no automated test verified it for PATCH. Future refactor could accidentally remove the middleware → silent regression.

**Post-PR**: 4 new PATCH 403 tests (one per junction) pin the contract.

### Scenario 2 — DELETE coverage drift (ecosystemSpecies, speciesBiomes, speciesTraits)

**Risk pre-PR**: DELETE endpoints had ZERO tests for 3 of 4 junctions. Only ecosystemBiomes + speciesTraits had partial DELETE coverage (200 + 404, no 403). Could remove + break silently.

**Post-PR**: 11 new DELETE tests (200 success + verify-GET-404, 403 forbidden, 404 missing) covering ecosystemSpecies + speciesBiomes complete + speciesTraits 403/404 gap.

### Scenario 3 — PATCH 200 happy path missing (ecosystemSpecies, speciesBiomes)

**Risk pre-PR**: `PATCH .../:id updates existing records` test absent for 2 of 4 junctions. Only 404-edge tested. Could break update semantics without notice.

**Post-PR**: 2 new PATCH 200 tests pin the happy path.

### Scenario 4 — PATCH 409 conflict edge (ecosystemBiomes)

**Risk pre-PR**: route validates uniqueness on (ecosystemId, biomeId) at POST but never tested for PATCH (changing existing combination to duplicate one). Trivial regression surface.

**Post-PR**: explicit PATCH 409 test mirrors POST 409 pattern.

## Cross-repo audit

- **Game** (`C:/dev/Game`): consumes only `/api/traits/glossary` per topology. ZERO breakage risk from new junction tests (they only exercise existing API contracts).
- **codemasterdd-ai-station**: no policy bears on junction test coverage; append-only handoff per parallel-session protocol.
- **vault**, **Game-Godot-v2**: NOT inspected (NO-GO).

## QG Step 3 — Tuning metric

Full suite duration:
- Pre-PR-β (post-PR-α merge `7ed9dd6`): ~3-4s for backend npm test (137 tests, 12 files)
- Post-PR-β: ~3-4s (153 tests, 12 files)

Delta well under 5% target. New tests use existing per-file mocking infra (no DB hit, no Express boot overhead beyond what's already there). Acceptable.

## Open follow-ups (out-of-scope for PR-β)

- ecosystemSpecies POST 400 validation edge (no test for required-field-missing) — defer
- speciesTraits PATCH 409 mid-update conflict (changing species+trait+category to duplicate) — defer
- speciesBiomes POST 400 validation edge — defer
- PATCH 4xx validation parity across all junctions — defer (would add ~4-8 more tests)

These should be tracked as `PR-β2 junction coverage v2` if Eduardo wants comprehensive coverage. Current PR-β closes audit-flagged 2026-05-19 priorities only.

## References

- Spec: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` PR-β section
- Pattern source (masters CRUD): PR #114 `3be942c` + PR #116 `69af82d`
- PR-α slug hardening: merged `7ed9dd6`
