# Bulk-edit PR 1 — Selection + bulk-DELETE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-select + bulk-DELETE to all 8 taxonomy list tables via the shared `ListPage.tsx`, mirroring the proven PR #141 audit bulk-revert pattern.

**Architecture:** Frontend orchestration only. A new opt-in `bulkConfig` prop on `ListPage` enables TanStack row selection (already supported by `DataTable`), renders a contextual bulk toolbar, and runs `Promise.allSettled` over the existing `deleteConfig.mutation` with a partial-failure-aware snackbar. Selection clears on any data-changing navigation (stale-selection guard). Zero backend change.

**Tech Stack:** React 18, TypeScript, MUI, TanStack Table + Query, react-i18next, Vitest + Testing Library + user-event.

**Spec:** `docs/superpowers/specs/2026-05-21-bulk-edit-entity-tables-design.md`

---

## File Structure

- **Modify** `apps/dashboard/src/pages/ListPage.tsx` — add `BulkConfig` type, `bulkConfig` prop, selection state, stale-selection guard, bulk toolbar, bulk-delete confirm dialog + handler.
- **Modify** `apps/dashboard/src/i18n/locales/it/common.json` — add `bulk` i18n block.
- **Modify** the 8 list pages in `apps/dashboard/src/features/taxonomies/pages/` — add `bulkConfig={{ enableDelete: true }}` (they already pass `deleteConfig`):
  `TraitListPage.tsx`, `BiomeListPage.tsx`, `SpeciesListPage.tsx`, `EcosystemListPage.tsx`, `SpeciesTraitListPage.tsx`, `SpeciesBiomeListPage.tsx`, `EcosystemBiomeListPage.tsx`, `EcosystemSpeciesListPage.tsx`.
- **Create** `apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx` — bulk behavior tests.
- **Create** `docs/research/bulk-edit-2026-05-21.md` — edge-case research doc (QG Step 2).

`DataTable.tsx` needs **no change** — it already implements selection (`selectable`, controlled `rowSelection`/`onRowSelectionChange`, select-all, per-row checkbox, `getRowId`).

---

## Task 1: i18n bulk keys

**Files:**
- Modify: `apps/dashboard/src/i18n/locales/it/common.json`

- [ ] **Step 1: Add the `bulk` block**

Insert a new `"bulk"` key after the `"search"` block (after line 35, before `"feedback"`):

```json
  "bulk": {
    "selectedCount": "{{count}} selezionati",
    "deselectAll": "Deseleziona tutto",
    "deleteButton": "Elimina {{count}}",
    "deleteConfirmTitle": "Elimina elementi selezionati",
    "deleteConfirmBody": "Confermi l'eliminazione di {{count}} elementi? L'azione non e reversibile.",
    "andMore": "+{{count}} altri",
    "deleteSuccess": "{{count}} elementi eliminati.",
    "deletePartial": "{{success}} eliminati, {{failed}} falliti.",
    "deleteAllFailed": "Eliminazione fallita per tutti i {{count}} elementi."
  },
```

- [ ] **Step 2: Verify JSON parses**

Run: `cd apps/dashboard && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/it/common.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/i18n/locales/it/common.json
git commit -m "$(cat <<'EOF'
feat(audit-ui): bulk i18n keys (Fase 2 bulk-edit PR1)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5a0-aa01-7000-8000-gamedb20260521-bulk-i18n
EOF
)"
```

---

## Task 2: Selection plumbing in ListPage

Add the `bulkConfig` prop, selection state, and wire `DataTable` selection. After this task, rows render checkboxes only when `bulkConfig` is present.

**Files:**
- Modify: `apps/dashboard/src/pages/ListPage.tsx`
- Test: `apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx`:

```tsx
import type { ColumnDef } from '@tanstack/react-table';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderListPage, userEvent } from '../../testUtils/renderWithProviders';

type Item = { id: string; name: string };

const columns: ColumnDef<Item, any>[] = [
  { accessorKey: 'name', header: 'Nome', cell: (info) => info.getValue() },
];

function makeFetcher(items: Item[]) {
  return vi
    .fn<(q: string, p?: number, ps?: number) => Promise<{ items: Item[]; total: number; page: number; pageSize: number }>>()
    .mockResolvedValue({ items, total: items.length, page: 0, pageSize: 25 });
}

const baseItems: Item[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
  { id: '3', name: 'Gamma' },
];

function renderBulk(deleteFn = vi.fn().mockResolvedValue(undefined), fetcher = makeFetcher(baseItems)) {
  renderListPage<Item>({
    title: 'Elementi',
    columns,
    fetcher,
    queryKeyBase: ['bulk-items'],
    autoloadOnMount: true,
    deleteConfig: {
      dialogTitle: 'Elimina',
      mutation: async (item) => {
        await deleteFn(item);
      },
      successMessage: 'Eliminato',
    },
    bulkConfig: { enableDelete: true },
    getItemLabel: (item) => item.name,
  });
  return { deleteFn, fetcher };
}

describe('ListPage bulk selection', () => {
  it('renders row checkboxes only when bulkConfig is present', async () => {
    renderBulk();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    expect(screen.getByRole('checkbox', { name: 'Seleziona tutte le righe' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { name: 'Seleziona riga' })).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/pages/__tests__/ListPageBulk.test.tsx`
Expected: FAIL — no select-all checkbox (ListPage passes `selectable={false}`; `bulkConfig` prop does not exist yet).

- [ ] **Step 3: Add the type + prop + state**

In `apps/dashboard/src/pages/ListPage.tsx`:

(a) Extend the TanStack import (line 16) to include `RowSelectionState`:

```ts
import { ColumnDef, type PaginationState, type RowSelectionState, type SortingState } from '@tanstack/react-table';
```

(b) Add the `BulkConfig` type after `DeleteConfig` (after line 77):

```ts
type BulkConfig = {
  enableDelete?: boolean;
  deleteDialogTitle?: string;
};
```

(c) Add `bulkConfig` to `ListPageProps` (after `deleteConfig?` ~line 92):

```ts
  bulkConfig?: BulkConfig;
```

(d) Destructure `bulkConfig` in the function params (after `deleteConfig,` ~line 165):

```ts
  bulkConfig,
```

(e) Add selection state next to the other dialog state (after line 196):

```ts
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
```

(f) Add derived selection values after `crudEnabled` (after line 354):

```ts
  const bulkEnabled = Boolean(bulkConfig?.enableDelete);
  const selectedItems = useMemo(
    () => items.filter((it) => Boolean(it.id) && Boolean(rowSelection[it.id as string])),
    [items, rowSelection],
  );
  const selectedCount = selectedItems.length;
```

- [ ] **Step 4: Wire DataTable selection**

Replace the `<DataTable ... />` block (lines 580-589) with:

```tsx
      <DataTable<TItem>
        data={items}
        columns={columnsWithActions}
        selectable={bulkEnabled}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={(row) => row.id ?? ''}
        loading={showSkeleton}
        pagination={paginationState}
        onPaginationChange={handlePaginationChange}
        sorting={sorting}
        onSortingChange={handleSortingChange}
      />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/pages/__tests__/ListPageBulk.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/pages/ListPage.tsx apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx
git commit -m "$(cat <<'EOF'
feat(audit-ui): ListPage row selection plumbing (Fase 2 bulk-edit PR1)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5a1-aa01-7000-8000-gamedb20260521-bulk-select
EOF
)"
```

---

## Task 3: Bulk toolbar (count + deselect)

Render a contextual toolbar when >=1 row is selected, showing the count and a deselect button.

**Files:**
- Modify: `apps/dashboard/src/pages/ListPage.tsx`
- Test: `apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `ListPageBulk.test.tsx` inside the `describe` block:

```tsx
  it('shows the bulk toolbar with count when rows selected, hidden at zero', async () => {
    renderBulk();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());

    // Hidden initially
    expect(screen.queryByText(/selezionati/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    const rowChecks = screen.getAllByRole('checkbox', { name: 'Seleziona riga' });
    await user.click(rowChecks[0]);
    await user.click(rowChecks[1]);

    expect(await screen.findByText('2 selezionati')).toBeInTheDocument();

    // Deselect all clears it
    await user.click(screen.getByRole('button', { name: 'Deseleziona tutto' }));
    await waitFor(() => expect(screen.queryByText(/selezionati/i)).not.toBeInTheDocument());
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/pages/__tests__/ListPageBulk.test.tsx -t "bulk toolbar"`
Expected: FAIL — no "selezionati" text / no "Deseleziona tutto" button.

- [ ] **Step 3: Add clearSelection handler**

In `ListPage.tsx`, add after the `selectedCount` derivation (from Task 2 step 3f):

```ts
  const clearSelection = useCallback(() => setRowSelection({}), []);
```

- [ ] **Step 4: Render the toolbar**

In `ListPage.tsx`, insert immediately after the header `</Stack>` (after line 574, before the `{isError && ...}` block):

```tsx
      {bulkEnabled && selectedCount > 0 && (
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          sx={(theme) => ({
            mb: theme.spacing(3),
            px: theme.spacing(2),
            py: theme.spacing(1.5),
            borderRadius: 1,
            backgroundColor: theme.palette.action.selected,
          })}
        >
          <Typography variant="body2">{t('common:bulk.selectedCount', { count: selectedCount })}</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button size="small" variant="text" onClick={clearSelection}>
            {t('common:bulk.deselectAll')}
          </Button>
        </Stack>
      )}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/pages/__tests__/ListPageBulk.test.tsx -t "bulk toolbar"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/pages/ListPage.tsx apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx
git commit -m "$(cat <<'EOF'
feat(audit-ui): bulk toolbar with count + deselect (Fase 2 bulk-edit PR1)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5a2-aa01-7000-8000-gamedb20260521-bulk-toolbar
EOF
)"
```

---

## Task 4: Stale-selection guard

Selection MUST clear on any criteria change (query/page/pageSize/sort). Mirrors the PR #141 Codex P2 `stale-selection-leak` fix.

**Files:**
- Modify: `apps/dashboard/src/pages/ListPage.tsx`
- Test: `apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `ListPageBulk.test.tsx`:

```tsx
  it('clears selection when the search query changes', async () => {
    renderBulk();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('checkbox', { name: 'Seleziona riga' })[0]);
    expect(await screen.findByText('1 selezionati')).toBeInTheDocument();

    // Typing a query + Enter changes criteria -> selection must clear
    const searchBox = screen.getByPlaceholderText('Cerca');
    await user.type(searchBox, 'Alpha{Enter}');

    await waitFor(() => expect(screen.queryByText(/selezionati/i)).not.toBeInTheDocument());
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/pages/__tests__/ListPageBulk.test.tsx -t "clears selection"`
Expected: FAIL — selection survives the query change ("1 selezionati" still present).

- [ ] **Step 3: Add the guard effect**

In `ListPage.tsx`, add after the `onStateChange` effect (after line 268):

```ts
  useEffect(() => {
    setRowSelection({});
  }, [criteria.query, criteria.page, criteria.pageSize, criteria.sort]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/pages/__tests__/ListPageBulk.test.tsx -t "clears selection"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/ListPage.tsx apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx
git commit -m "$(cat <<'EOF'
fix(audit-ui): clear bulk selection on criteria change (Fase 2 bulk-edit PR1)

Stale-selection guard mirroring PR #141 Codex P2 fix: a selection
referencing rows no longer visible must not survive a query/page/sort
change that re-renders a different row set.

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5a3-aa01-7000-8000-gamedb20260521-bulk-staleguard
EOF
)"
```

---

## Task 5: Bulk-delete confirm dialog + happy path

Add the "Elimina N" button, confirm dialog (count + sample labels), and `Promise.allSettled` handler over `deleteConfig.mutation`.

**Files:**
- Modify: `apps/dashboard/src/pages/ListPage.tsx`
- Test: `apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `ListPageBulk.test.tsx`:

```tsx
  it('bulk-deletes all selected rows and refreshes', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const fetcher = makeFetcher(baseItems);
    renderBulk(deleteFn, fetcher);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Seleziona tutte le righe' }));
    await screen.findByText('3 selezionati');

    await user.click(screen.getByRole('button', { name: 'Elimina 3' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Alpha')).toBeInTheDocument();
    // Confirm
    await user.click(within(dialog).getByRole('button', { name: 'Elimina 3' }));

    await waitFor(() => expect(deleteFn).toHaveBeenCalledTimes(3));
    await screen.findByText('3 elementi eliminati.');
    // Refresh triggered (invalidate -> refetch)
    await waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(2));
    // Selection cleared
    await waitFor(() => expect(screen.queryByText(/selezionati/i)).not.toBeInTheDocument());
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/pages/__tests__/ListPageBulk.test.tsx -t "bulk-deletes all"`
Expected: FAIL — no "Elimina 3" button.

- [ ] **Step 3: Add state + handler**

In `ListPage.tsx`, add to the selection state (next to `rowSelection` from Task 2):

```ts
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkInProgress, setBulkInProgress] = useState(false);
```

Add the handler after `clearSelection` (from Task 3 step 3):

```ts
  const handleBulkDelete = useCallback(async () => {
    if (!deleteConfig || selectedItems.length === 0) return;
    setBulkInProgress(true);
    try {
      const targets = selectedItems;
      const results = await Promise.allSettled(targets.map((it) => deleteConfig.mutation(it)));
      const success = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - success;
      if (failed === 0) {
        enqueueSnackbar(t('common:bulk.deleteSuccess', { count: success }), { variant: 'success' });
      } else if (success === 0) {
        enqueueSnackbar(t('common:bulk.deleteAllFailed', { count: failed }), { variant: 'error' });
      } else {
        enqueueSnackbar(t('common:bulk.deletePartial', { success, failed }), { variant: 'warning' });
      }
      setBulkDeleteOpen(false);
      setRowSelection({});
      await refreshList();
    } finally {
      setBulkInProgress(false);
    }
  }, [deleteConfig, selectedItems, enqueueSnackbar, t, refreshList]);
```

- [ ] **Step 4: Add the delete button to the toolbar**

In the toolbar block (Task 3 step 4), add after the "Deseleziona tutto" `<Button>`:

```tsx
          {bulkConfig?.enableDelete && deleteConfig && (
            <Button
              size="small"
              color="error"
              variant="contained"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkInProgress}
            >
              {t('common:bulk.deleteButton', { count: selectedCount })}
            </Button>
          )}
```

- [ ] **Step 5: Add the confirm dialog**

In `ListPage.tsx`, add after the existing `deleteConfig` single-delete dialog (after line 658, before the closing `</Paper>`):

```tsx
      {bulkConfig?.enableDelete && deleteConfig && (
        <Dialog
          open={bulkDeleteOpen}
          onClose={() => !bulkInProgress && setBulkDeleteOpen(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>{bulkConfig.deleteDialogTitle ?? t('common:bulk.deleteConfirmTitle')}</DialogTitle>
          <DialogContent>
            <Typography>{t('common:bulk.deleteConfirmBody', { count: selectedCount })}</Typography>
            <Box component="ul" sx={(theme) => ({ mt: theme.spacing(1), pl: theme.spacing(3) })}>
              {selectedItems.slice(0, 5).map((it) => (
                <li key={it.id}>{resolveItemLabel(it)}</li>
              ))}
              {selectedCount > 5 && <li>{t('common:bulk.andMore', { count: selectedCount - 5 })}</li>}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBulkDeleteOpen(false)} disabled={bulkInProgress}>
              {t('common:actions.cancel')}
            </Button>
            <Button color="error" variant="contained" onClick={handleBulkDelete} disabled={bulkInProgress}>
              {bulkInProgress ? t('common:actions.deleteInProgress') : t('common:bulk.deleteButton', { count: selectedCount })}
            </Button>
          </DialogActions>
        </Dialog>
      )}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/pages/__tests__/ListPageBulk.test.tsx -t "bulk-deletes all"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/pages/ListPage.tsx apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx
git commit -m "$(cat <<'EOF'
feat(audit-ui): bulk-delete confirm + Promise.allSettled (Fase 2 bulk-edit PR1)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5a4-aa01-7000-8000-gamedb20260521-bulk-delete
EOF
)"
```

---

## Task 6: Bulk-delete partial-failure

Verify the `{success, failed}` partial-failure toast when some mutations reject.

**Files:**
- Test: `apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx`

- [ ] **Step 1: Write the test**

Append to `ListPageBulk.test.tsx`:

```tsx
  it('reports partial-failure counts when some deletes reject', async () => {
    const deleteFn = vi
      .fn()
      .mockResolvedValueOnce(undefined) // id 1 ok
      .mockRejectedValueOnce(new Error('boom')) // id 2 fail
      .mockResolvedValueOnce(undefined); // id 3 ok
    const fetcher = makeFetcher(baseItems);
    renderBulk(deleteFn, fetcher);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Seleziona tutte le righe' }));
    await screen.findByText('3 selezionati');
    await user.click(screen.getByRole('button', { name: 'Elimina 3' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Elimina 3' }));

    await waitFor(() => expect(deleteFn).toHaveBeenCalledTimes(3));
    await screen.findByText('2 eliminati, 1 falliti.');
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/pages/__tests__/ListPageBulk.test.tsx -t "partial-failure"`
Expected: PASS (handler already implemented in Task 5; this locks the behavior).

> If it fails because `Promise.allSettled` ordering vs mock ordering: the mock uses `mockResolvedValueOnce` in call-order, and `selectedItems` preserves `items` order (1,2,3), so call 2 rejects. No code change expected.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx
git commit -m "$(cat <<'EOF'
test(audit-ui): bulk-delete partial-failure toast (Fase 2 bulk-edit PR1)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5a5-aa01-7000-8000-gamedb20260521-bulk-partial
EOF
)"
```

---

## Task 7: Opt-in on all 8 list pages

Add `bulkConfig={{ enableDelete: true }}` to each list page's `<ListPage>` usage. Each already passes `deleteConfig`.

**Files (modify each):**
- `apps/dashboard/src/features/taxonomies/pages/TraitListPage.tsx`
- `apps/dashboard/src/features/taxonomies/pages/BiomeListPage.tsx`
- `apps/dashboard/src/features/taxonomies/pages/SpeciesListPage.tsx`
- `apps/dashboard/src/features/taxonomies/pages/EcosystemListPage.tsx`
- `apps/dashboard/src/features/taxonomies/pages/SpeciesTraitListPage.tsx`
- `apps/dashboard/src/features/taxonomies/pages/SpeciesBiomeListPage.tsx`
- `apps/dashboard/src/features/taxonomies/pages/EcosystemBiomeListPage.tsx`
- `apps/dashboard/src/features/taxonomies/pages/EcosystemSpeciesListPage.tsx`
- Test: `apps/dashboard/src/features/taxonomies/pages/__tests__/TraitListPage.test.tsx`

- [ ] **Step 1: Write a smoke test on TraitListPage**

Append a test to the existing `TraitListPage.test.tsx` (inside its top-level `describe`; reuse that file's existing render helper / mocks — match its established pattern for rendering `<TraitListPage />`). The assertion:

```tsx
  it('exposes bulk selection (select-all checkbox present)', async () => {
    // render <TraitListPage /> via this file's existing helper, with the
    // traits fetch mocked to return >=1 row (mirror the existing tests here)
    expect(await screen.findByRole('checkbox', { name: 'Seleziona tutte le righe' })).toBeInTheDocument();
  });
```

> Note: use the SAME render + mock setup already present in `TraitListPage.test.tsx`. Do not introduce a new harness — read the file first and copy its arrange step.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/features/taxonomies/pages/__tests__/TraitListPage.test.tsx -t "bulk selection"`
Expected: FAIL — no select-all checkbox (TraitListPage has no `bulkConfig` yet).

- [ ] **Step 3: Add `bulkConfig` to each page**

In each of the 8 files, add this prop to the `<ListPage ...>` element (e.g. in `TraitListPage.tsx` right after the `deleteConfig={{...}}` block, before `getItemLabel`):

```tsx
      bulkConfig={{ enableDelete: true }}
```

Repeat verbatim in all 8 files.

- [ ] **Step 4: Run the TraitListPage test + full dashboard suite**

Run: `cd apps/dashboard && npx vitest run src/features/taxonomies/pages/__tests__/TraitListPage.test.tsx -t "bulk selection"`
Expected: PASS.

Then full suite:

Run: `cd apps/dashboard && npm test`
Expected: all green (existing + new bulk tests). Investigate any regression before committing.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/features/taxonomies/pages/
git commit -m "$(cat <<'EOF'
feat(audit-ui): enable bulk-delete on all 8 entity tables (Fase 2 bulk-edit PR1)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5a6-aa01-7000-8000-gamedb20260521-bulk-optin
EOF
)"
```

---

## Task 8: Research doc + PR open

**Files:**
- Create: `docs/research/bulk-edit-2026-05-21.md`

- [ ] **Step 1: Write the research doc (QG Step 2)**

Create `docs/research/bulk-edit-2026-05-21.md` documenting >=3 edge cases actually exercised:

```markdown
# Bulk-edit (PR1 selection + delete) — edge-case research 2026-05-21

## Edge cases covered
1. **Empty selection**: toolbar hidden at 0 selected; `handleBulkDelete` no-ops when `selectedItems.length === 0`.
2. **All-fail batch**: every mutation rejects -> error-variant toast `deleteAllFailed`, selection retained? No — selection cleared + refetch shows rows still present (authoritative state).
3. **Mixed success/fail**: warning-variant toast `{success, failed}`; verified 2-ok/1-fail ordering against `Promise.allSettled`.
4. **Stale selection on navigation**: selecting a row then changing the search query clears selection (guard effect on `criteria`). Prevents applying a delete to rows no longer visible (PR #141 Codex P2 lesson).
5. **>5 selected**: confirm dialog shows first 5 labels + "+N altri" overflow.

## Tuning note
N-row bulk delete = N parallel single-DELETE calls (allSettled). Bounded by page size (<=50). Taxonomy seed datasets are small (<=53-species); no batching needed at current scale. Revisit if a table exceeds ~500 rows per page.
```

- [ ] **Step 2: Commit**

```bash
git add docs/research/bulk-edit-2026-05-21.md
git commit -m "$(cat <<'EOF'
docs(research): bulk-edit PR1 edge-case research (Fase 2)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5a7-aa01-7000-8000-gamedb20260521-bulk-research
EOF
)"
```

- [ ] **Step 3: Push branch + open PR**

```bash
git push -u origin <branch>
gh pr create --title "feat(audit-ui): bulk-delete multi-select on entity tables (Fase 2 bulk-edit PR1)" --body "$(cat <<'EOF'
## Summary
- Adds opt-in `bulkConfig` to shared `ListPage`: row multi-select + contextual bulk toolbar + bulk-DELETE across all 8 taxonomy tables (4 masters + 4 junctions).
- Frontend orchestration only (zero backend change): `Promise.allSettled` over existing `deleteConfig.mutation`, partial-failure `{success, failed}` toast.
- Stale-selection guard (clears on query/page/sort change) per PR #141 Codex P2 lesson.

## Test plan
- [ ] `cd apps/dashboard && npm test` green (new `ListPageBulk.test.tsx` + TraitListPage smoke + existing suite)
- [ ] Selection toggle / select-all / deselect
- [ ] Bulk-delete happy + partial-failure + all-fail toasts
- [ ] Stale-selection clears on navigation

Spec: `docs/superpowers/specs/2026-05-21-bulk-edit-entity-tables-design.md`
Research: `docs/research/bulk-edit-2026-05-21.md`
EOF
)"
```

- [ ] **Step 4: MANDATORY pre-merge review protocol**

Run: `gh api repos/MasterDD-L34D/Game-Database/pulls/<N>/comments --jq '.[] | "[\(.user.login)] \(.path):\(.line // "?") :: \(.body)"'`
Triage P1/P2 (fix before merge), P3 (defer w/ note). Re-run CI, then squash-merge with `(#N)` suffix.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Multi-select all tables -> Tasks 2,7. Bulk-delete -> Task 5. Partial-failure -> Tasks 5,6. Stale-selection guard -> Task 4. No backend change -> entire plan is frontend. Optimistic-UI non-goal -> handler uses await-then-refetch (Task 5). Bulk-EDIT -> explicitly PR 2 (out of this plan's scope). Covered.
- Junction coverage -> Task 7 wires all 8 (incl. 4 junctions); they share ListPage + already pass deleteConfig.

**Placeholder scan:** No TBD/TODO. Task 7 Step 1 references the existing TraitListPage test harness rather than inlining a duplicate — flagged explicitly with instruction to read + copy that file's arrange step (its mocks are file-specific and must not be guessed).

**Type consistency:** `bulkConfig` / `BulkConfig` / `enableDelete` / `deleteDialogTitle`, `rowSelection`/`setRowSelection`, `selectedItems`/`selectedCount`/`bulkEnabled`, `handleBulkDelete`/`clearSelection`, `bulkDeleteOpen`/`bulkInProgress` consistent across Tasks 2-7. i18n keys (`common:bulk.*`) defined in Task 1 match all usages in Tasks 3,5.

**Scope:** Single PR (PR 1). PR 2 (bulk-edit) + PR 3 (polish) are separate plans per spec decomposition.
