# Game-Database — Bulk-edit entity tables (Fase 2 #2)

**Date**: 2026-05-21
**Author**: parallel-#2 session (Ryzen, Claude opus-4.7)
**Status**: COMPLETE (2026-05-21) — PR1 selection+bulk-DELETE `58f26e0` (#145), PR2 bulk-EDIT single-field `7f43343` (#146), PR3 multi-field `b78845a` (#148). Full epic merged. 4 Codex P2 caught+fixed pre-merge across the chain.
**Scope**: Game-Database dashboard only (`apps/dashboard/`). Zero backend change, zero cross-repo touch.
**Spec reference**: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` § Fase 2 deliverable 2 "Bulk edit"

## Problem statement

The dashboard supports CRUD on taxonomy entities one row at a time. A designer
correcting 30 trait categories, or removing a batch of mis-imported species,
must repeat the single-row edit/delete dialog 30 times. Fase 2 deliverable 2
calls for multi-select + batch operations.

Last session deferred this as "ListPage non espone bulk API — refactor troppo
grosso". Ground-truth on 2026-05-21 revised that assessment:

- The shared `DataTable` component **already** implements the full TanStack
  Table row-selection model: `selectable` prop, controlled `rowSelection` /
  `onRowSelectionChange`, header select-all checkbox with indeterminate state,
  per-row checkbox, and `getRowId`. ListPage simply passes `selectable={false}`.
- **All 8 list pages** (4 masters: Trait/Biome/Species/Ecosystem + 4 junctions:
  SpeciesTrait/SpeciesBiome/EcosystemBiome/EcosystemSpecies) render the same
  shared `apps/dashboard/src/pages/ListPage.tsx`. Enabling bulk in ListPage
  covers all 8 via config — no per-page rewrite.

So this is an opt-in capability addition to one shared component, not a refactor.

## Goals

- Multi-select rows on every entity list table (masters + junctions).
- Bulk-DELETE selected rows.
- Bulk-EDIT: set one shared field to one value across all selected rows.
- Partial-failure aware: report `{success, failed}` counts; failed rows survive.
- Reuse existing single-item endpoints — no new backend surface.

## Non-goals

- New backend batch endpoints (`bulk-delete`, `bulk-update`). Rejected: would be
  all-or-nothing `$transaction` (fights partial-failure requirement) and bypass
  per-row AuditLog. Frontend orchestration over single endpoints reuses already
  audited + RBAC-gated paths.
- True optimistic cache mutation. With partial-failure semantics, await-then-
  refetch is the correct source-of-truth and is simpler. See "Optimistic UI".
- Bulk-edit of unique-constrained fields (slug, name). PUT validates slug
  uniqueness — setting N rows to the same slug/name would 409-cascade. Excluded
  by config.
- Cross-page selection persistence. Selection is cleared on any data-changing
  navigation (see "Stale-selection guard").
- Multi-field-in-one-pass bulk-edit. v1 sets one field per dialog submit;
  multi-field is PR 3 polish, deferrable.

## Architecture decision

**Frontend orchestration, mirroring the proven PR #141 audit bulk-revert pattern.**

PR #141 (`AuditHistoryPanel`) established the canonical in-repo bulk pattern:
`selectedIds: Set<string>` state, select-all over visible rows with
indeterminate, `Promise.allSettled(ids.map(fn))`, count fulfilled/rejected →
partial-success toast, confirm dialog, and a Codex-reviewed stale-selection
intersect guard. This epic mirrors that pattern, lifted into `ListPage` and
driven by TanStack Table's native `RowSelectionState`.

Backend stays untouched: each bulk action loops the existing single-item
mutation (`deleteConfig.mutation` / `editConfig.onSubmit`) that every list page
already configures. Each single call logs to AuditLog and respects
`requireTaxonomyWrite` RBAC, so bulk inherits both for free.

### Why PUT full-replace matters

`server/routes/traits.js:172` (and sibling routes) implement PUT as
**full-replace**: `validateTraitPayload(req.body)` validates the whole payload,
and absent optional fields (`description`/`category`/`unit`) default to `null`.
A partial PUT body would therefore wipe unspecified fields.

Consequence for bulk-edit: each row's payload must be the **full** entity value
with only the chosen field overridden:

```
payload = { ...editConfig.getInitialValues(item), [field]: newValue }
```

`ListPage` already holds `editConfig.getInitialValues(item)`, so the merge is a
one-liner per row. This is the single most important correctness constraint in
the design.

## Component design

### DataTable (no change)

Already selection-capable. ListPage will flip `selectable` on and pass
controlled `rowSelection` + `getRowId` (rows keyed by `item.id`).

### ListPage — new opt-in `bulkConfig`

```ts
type BulkConfig<TItem, TValues> = {
  // Enables selection + toolbar. Bulk-delete reuses existing deleteConfig.mutation.
  enableDelete?: boolean;
  // Bulk-edit reuses editConfig.onSubmit; fields are the editConfig.fields
  // marked bulkEditable. If no field is bulkEditable, the Edit button hides.
  enableEdit?: boolean;
  // Optional copy overrides; sensible i18n defaults otherwise.
  deleteConfirmTitle?: string;
  editDialogTitle?: string;
};
```

`FormFieldConfig` gains one optional flag:

```ts
type FormFieldConfig<TValues> = {
  // ...existing
  bulkEditable?: boolean; // safe to set the same value across many rows
};
```

When `bulkConfig` is present:

1. `DataTable selectable={true}`, controlled `rowSelection` state + `getRowId`.
2. A **bulk toolbar** renders above/within the table header area only when
   `selectedCount >= 1`: shows `selectedCount`, a "Deseleziona tutto" button,
   and (per `bulkConfig`) "Elimina N" / "Modifica N" buttons.
3. Selection state lives in ListPage (`RowSelectionState` from TanStack),
   derived `selectedItems = items.filter(i => rowSelection[i.id])`.

### Bulk-DELETE flow

1. "Elimina N" → confirm dialog: count + up to ~5 sample `getItemLabel` values
   + "+N altri" overflow.
2. Confirm → `Promise.allSettled(selectedItems.map(it => deleteConfig.mutation(it)))`.
3. Tally `fulfilled` / `rejected`.
4. Toast: all-success → `{count}`; partial → `{success, failed}` (warning
   variant); all-fail → error variant.
5. Clear selection, `refreshList()` (invalidate query → refetch). Failed rows
   reappear; succeeded rows are gone.

### Bulk-EDIT flow

1. "Modifica N" → dialog with:
   - a **field selector** listing only `editConfig.fields` where
     `bulkEditable === true`;
   - a **value input** rendered per the selected field's `type`
     (text/number/select), reusing the existing field renderer.
2. Submit → per row build full payload
   `{ ...editConfig.getInitialValues(item), [field]: value }`, then
   `Promise.allSettled(selectedItems.map(it => editConfig.onSubmit(it, payload(it))))`.
3. Same partial-failure tally + toast + clear + refresh as delete.
4. Empty bulk-editable set → "Modifica N" button hidden (junctions/entities
   with no shareable field).

### Stale-selection guard (Codex #141 lesson)

Selection MUST clear on any state change that re-renders a different row set:
query change, page change, pageSize change, sort change. Mirrors the PR #141
Codex P2 fix (`stale-selection-leak`): a selection referencing rows no longer
visible must not silently apply to a refreshed page. Implementation: a
`useEffect` keyed on `criteria` (query/page/pageSize/sort) that resets
`rowSelection` to `{}`.

### Optimistic UI — recommendation (approved 2026-05-21)

True optimistic cache mutation is **out of scope**. With partial-failure, the
post-operation refetch is the authoritative state: succeeded rows vanish, failed
rows remain. "Rollback" is therefore implicit in the refetch, not a manual
cache revert. This matches the proven #141 await-then-refetch pattern and avoids
the complexity of reconciling a half-applied optimistic batch.

## PR decomposition

Repo convention is small incremental PRs (#115–#144). Three PRs:

### PR 1 — Selection plumbing + bulk-DELETE (all 8 tables) — MERGED `58f26e0` (#145)

- `bulkConfig` prop on ListPage; `selectable`/`rowSelection`/`getRowId` wired.
- Bulk toolbar (count + deselect + delete) shown when `selectedCount >= 1`.
- Bulk-delete confirm dialog + `Promise.allSettled` over `deleteConfig.mutation`
  + partial-success toast + clear + refresh.
- Stale-selection guard `useEffect`.
- Opt-in on the 8 list pages (config only — they already pass `deleteConfig`).
- i18n keys (`common:bulk.*`).
- Tests (see below).

### PR 2 — Bulk-EDIT single-field (all 8 tables) — MERGED `7f43343` (#146)

- `bulkEditable` flag on `FormFieldConfig`; mark safe fields in each entity's
  `editConfig`. Final set: Trait category/unit (dataType excluded per Codex P2 —
  needs `allowedValues` coupling); Biome climate; Species kingdom/phylum/class/
  order/family/genus/status; Ecosystem region/climate; SpeciesTrait category;
  SpeciesBiome presence; EcosystemSpecies role; EcosystemBiome none (button hidden).
- Apply gated on non-empty value for required fields (Codex P2).
- Bulk-edit dialog (field selector + typed value input) reusing the field
  renderer.
- Per-row full-payload merge + `Promise.allSettled` over `editConfig.onSubmit`.
- Same partial-failure tally/toast/refresh.
- Tests.

### PR 3 — Multi-field bulk-edit — MERGED `b78845a` (#148)

- Multi-field-in-one-pass bulk-edit: `bulkEdits` array, per-row field+value with
  Aggiungi/Rimuovi, merge all pairs into per-row override. Single default row keeps
  PR2 behavior. Add-row capped on total rows (Codex P2). Used fields disabled in
  other rows; required-empty gating per row.

## Testing & quality gates (CLAUDE.md Release Standard)

### Smoke (Vitest, `apps/dashboard`)

- Selection: toggle one row, select-all (indeterminate), deselect-all.
- Toolbar visibility: hidden at 0 selected, shown at ≥1, count accurate.
- Bulk-delete: happy path (all succeed), partial-failure (mock 1 reject →
  `{success, failed}` toast + failed row survives refetch), all-fail.
- Bulk-edit: per-row payload merge preserves non-target fields (assert no
  field-wipe — the core PUT-full-replace risk), partial-failure, validation.
- Stale-selection: selection clears on query/page/sort change.

### Research (`docs/research/bulk-edit-<YYYY-MM-DD>.md`)

≥3 edge cases documented: empty selection guard, all-fail batch, mixed
success/fail, cross-page selection (cleared), unique-field exclusion rationale.

### Tuning

N-row bulk latency before/after; selection-clear correctness delta; document in
PR commit body.

## Risk + mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Bulk-edit partial PUT wipes fields | High | Full-payload merge `{...getInitialValues, [field]:v}`; explicit no-wipe test |
| Unique field bulk-set → 409 cascade | Med | `bulkEditable` excludes slug/name by config; field selector only lists safe fields |
| Stale selection applies to wrong rows | Med | Selection-clear `useEffect` on criteria change (mirrors #141 Codex P2) |
| Partial-failure leaves inconsistent UI | Low | Await-then-refetch = authoritative state; failed rows reappear |
| N parallel requests overwhelm API | Low | Taxonomy datasets small (≤53-species seed); allSettled bounded by page size (≤50). Revisit if datasets grow |
| Junction delete/edit shape differs from masters | Low | All 8 share ListPage + configs already proven by PR-β junction coverage; tests per shape |

## Acceptance criteria

### PR 1
- [ ] `bulkConfig` prop + selection wired in ListPage
- [ ] Bulk toolbar conditional on selection count
- [ ] Bulk-delete confirm + `Promise.allSettled` + partial toast + refresh
- [ ] Stale-selection guard
- [ ] 8 list pages opt in
- [ ] Vitest green; full dashboard suite green
- [ ] Research doc + PR Test Plan

### PR 2
- [ ] `bulkEditable` flag + per-entity field marking
- [ ] Bulk-edit dialog + per-row full-payload merge (no-wipe test)
- [ ] Partial toast + refresh
- [ ] Vitest green; full suite green

## References

- Roadmap spec: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` § Fase 2
- Canonical bulk pattern: PR #141 (`AuditHistoryPanel` bulk revert), Codex P2 stale-selection fix
- Shared list component: `apps/dashboard/src/pages/ListPage.tsx`
- Selection model: `apps/dashboard/src/components/data-table/DataTable.tsx`
- PUT full-replace evidence: `server/routes/traits.js:158-188`
- Junction coverage precedent: PR-β #120 (`c47c13c`)

## Commit policy (ADR-0011)

- Trailers `Coding-Agent: claude-opus-4.7` + `Trace-Id: <uuidv7>` mandatory.
- NO `Co-Authored-By` GitHub trailer (forbidden).
- Squash merge + `(#N)` suffix per repo convention.
- Pre-merge code review protocol (CLAUDE.md): inspect `/pulls/N/comments`,
  triage P1/P2 before merge.
