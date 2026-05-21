# Bulk-edit PR3 (multi-field) — edge-case research 2026-05-21

Component: multi-field bulk-edit on the shared `ListPage` (extends PR2 #146
single-field). Set N fields in one apply pass. QG Step 2 evidence.

## Edge cases covered

1. **Backward-compat (single row)**: state initialises to one empty
   `{ field: '', value: '' }` row, so the PR2 single-field flow (select field,
   type value, apply) is unchanged. All PR2 tests stay green (11/11 total).
2. **Multiple fields one pass**: `overrides = Object.fromEntries(validEdits)`
   merged into `{ ...getInitialValues(item), ...overrides }`. Test
   `bulk-edits multiple fields in one pass` asserts category + unit applied
   together with name preserved (no field-wipe).
3. **Duplicate-field prevention**: a field already chosen in another row is
   disabled in every other row's selector (`usedByOthers`). `Object.fromEntries`
   also dedupes defensively (last wins).
4. **Required-empty gating (per row)**: apply is disabled if any valid edit row
   targets a `required` field with an empty value (`bulkEditApplyDisabled`).
   Carried over from PR2, now evaluated across all rows.
5. **Add-field cap**: the "Aggiungi campo" button hides once
   `validEdits.length === bulkEditFields.length` (no more fields to add).
6. **Remove last row**: `removeBulkEditRow` never empties the array — removing
   the only row resets to a single empty row (dialog never renders zero rows).
7. **Stale + reopen reset**: criteria change (query/page/sort) and cancel both
   reset `bulkEdits` to one empty row, so a reopened dialog starts clean and a
   pending multi-edit cannot apply to a refreshed row set.

## Tuning note

Multi-field still issues N parallel single-PUT/PATCH per selected row (one request
per row carries all overrides) via `Promise.allSettled`. No extra requests vs
single-field — the override object just has more keys. Bounded by page size (<=50).

## Test inventory (Vitest)

- `src/pages/__tests__/ListPageBulk.test.tsx` — 11 tests (PR1 6 + PR2 4 +
  PR3 1 multi-field). `renderBulkEdit` helper now exposes 2 bulk-editable fields
  (category, unit) to exercise multi-row.
