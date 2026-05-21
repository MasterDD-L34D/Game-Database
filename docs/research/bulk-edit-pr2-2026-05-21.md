# Bulk-edit PR2 (single-field edit) — edge-case research 2026-05-21

Component: bulk single-field EDIT on the shared `ListPage` (builds on PR1 #145
selection plumbing). Frontend orchestration, `Promise.allSettled` over the
existing `editConfig.onSubmit`. QG Step 2 evidence.

## Edge cases covered

1. **No bulk-editable field**: when an entity (EcosystemBiome) marks no field
   `bulkEditable`, `bulkEditEnabled` is false and the "Modifica N" button is
   hidden. Graceful per spec — exercised by leaving EcosystemBiome's fields
   unmarked while still passing `enableEdit: true`.
2. **Full-payload merge (no field-wipe)**: each row submits
   `{ ...editConfig.getInitialValues(item), [field]: value }`. Test
   `bulk-edits the chosen field ... with full per-row payload` asserts the
   non-target field (`name`) is preserved while only `category` changes —
   guards the PUT full-replace wipe risk (`traits.js:172`).
3. **Unique-field exclusion**: slug / name / scientificName are never marked
   `bulkEditable`, so the field selector cannot offer them — prevents an N-row
   duplicate-slug 409 cascade.
4. **Partial failure**: warning toast `editPartial {success, failed}` (test
   `reports partial-failure counts when some bulk-edits reject`, 1-ok/1-fail).
   Failed rows reappear after refetch (authoritative state).
5. **Field switch resets value**: `handleBulkEditFieldChange` clears
   `bulkEditValue` when the selected field changes, so a value typed for field A
   cannot leak into field B.
6. **Stale state on navigation**: the criteria-change guard now also closes the
   dialog and clears field/value (`setBulkEditOpen(false)` + reset), so a pending
   edit cannot apply to a refreshed row set (extends PR1 / PR #141 lesson).
7. **Selection needs delete OR edit**: `DataTable selectable` is now
   `bulkEnabled || bulkEditEnabled`, so an edit-only `bulkConfig` (no
   `enableDelete`) still renders row checkboxes. Caught during TDD.

## Per-entity bulk-editable fields

| Entity | Fields |
|---|---|
| Trait | category, dataType, unit |
| Biome | climate |
| Species | kingdom, phylum, className, order, family, genus, status |
| Ecosystem | region, climate |
| SpeciesTrait | category |
| SpeciesBiome | presence |
| EcosystemSpecies | role |
| EcosystemBiome | (none — button hidden) |

Excluded by design: unique fields (slug/name/scientificName), FK ids
(speciesId/traitId/biomeId/ecosystemId), free-text description/notes, per-row
numerics (abundance/proportion).

## Tuning note

Bulk-edit issues N parallel single-PUT/PATCH requests via `Promise.allSettled`,
bounded by page size (<=50). No batching needed at current taxonomy scale.

## Test inventory (Vitest)

- `src/pages/__tests__/ListPageBulk.test.tsx` — now 9 tests (PR1 6 + PR2 3:
  edit-button gating, full-payload apply, partial-failure).
- `src/features/taxonomies/pages/__tests__/TraitListPage.test.tsx` — bulk-edit
  "Modifica N" button smoke.
