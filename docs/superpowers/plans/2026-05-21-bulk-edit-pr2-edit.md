# Bulk-edit PR 2 — Bulk-EDIT single-field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bulk single-field EDIT to the shared `ListPage` (built on the PR1 selection plumbing): set one shared field to one value across all selected rows.

**Architecture:** Frontend orchestration, same as PR1. A `bulkConfig.enableEdit` flag plus a per-field `bulkEditable` marker drive a bulk-edit dialog. On apply, each selected row gets a **full** payload `{ ...editConfig.getInitialValues(item), [field]: value }` (PUT is full-replace, so partial would wipe fields) submitted via `Promise.allSettled(editConfig.onSubmit)`, with a partial-failure toast. Unique fields (slug/name) are never marked `bulkEditable`.

**Tech Stack:** React 18, TypeScript, MUI, TanStack Table + Query, react-i18next, Vitest + Testing Library + user-event.

**Spec:** `docs/superpowers/specs/2026-05-21-bulk-edit-entity-tables-design.md` § "PR 2"
**Builds on:** PR1 (#145, merged `58f26e0`) — selection state, toolbar, `resolveRowId`, `selectedItems`, `bulkConfig`, `bulkInProgress`.

---

## File Structure

- **Modify** `apps/dashboard/src/pages/ListPage.tsx` — `bulkEditable` flag on `FormFieldConfig`; `enableEdit` on `BulkConfig`; derive `bulkEditableFields`; "Modifica N" toolbar button (hidden when no bulk-editable field); bulk-edit dialog (field selector + typed value input); `handleBulkEdit` apply handler.
- **Modify** `apps/dashboard/src/i18n/locales/it/common.json` — extend `bulk` block with edit keys.
- **Modify** 7 list pages (mark `bulkEditable` fields; `EcosystemBiomeListPage` gets none → button stays hidden):
  Trait, Biome, Species, Ecosystem, SpeciesTrait, SpeciesBiome, EcosystemSpecies.
- **Modify** `apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx` — bulk-edit tests.
- **Create** `docs/research/bulk-edit-pr2-2026-05-21.md` — edge-case research.

---

## Task 1: i18n bulk-edit keys

**Files:** Modify `apps/dashboard/src/i18n/locales/it/common.json`

- [ ] **Step 1: Extend the `bulk` block**

Add these keys inside the existing `"bulk"` object (after `deleteAllFailed`):

```json
    "editButton": "Modifica {{count}}",
    "editDialogTitle": "Modifica elementi selezionati",
    "editFieldLabel": "Campo da modificare",
    "editValueLabel": "Nuovo valore",
    "editApply": "Applica a {{count}}",
    "editSuccess": "{{count}} elementi aggiornati.",
    "editPartial": "{{success}} aggiornati, {{failed}} falliti.",
    "editAllFailed": "Aggiornamento fallito per tutti i {{count}} elementi."
```

(Add a comma after `deleteAllFailed`'s value.)

- [ ] **Step 2: Verify JSON parses**

Run: `cd apps/dashboard && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/it/common.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/i18n/locales/it/common.json
git commit -m "$(cat <<'EOF'
feat(audit-ui): bulk-edit i18n keys (bulk-edit PR2)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5c0-aa01-7000-8000-gamedb20260521-bulkedit-i18n
EOF
)"
```

---

## Task 2: bulkEditable flag + enableEdit + edit button

Add the type members and render a "Modifica N" button that is hidden when no field is `bulkEditable`.

**Files:** Modify `apps/dashboard/src/pages/ListPage.tsx`; Test `apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `ListPageBulk.test.tsx` inside the `describe`. First add a render helper that enables edit, near the top-level `renderBulk` helper:

```tsx
type EditItem = { id: string; name: string; category: string };

function renderBulkEdit(editFn = vi.fn().mockResolvedValue(undefined)) {
  const items: EditItem[] = [
    { id: '1', name: 'Alpha', category: 'X' },
    { id: '2', name: 'Beta', category: 'Y' },
  ];
  const fetcher = vi
    .fn<(q: string, p?: number, ps?: number) => Promise<{ items: EditItem[]; total: number; page: number; pageSize: number }>>()
    .mockResolvedValue({ items, total: items.length, page: 0, pageSize: 25 });
  renderListPage<EditItem>({
    title: 'Elementi',
    columns: [{ accessorKey: 'name', header: 'Nome', cell: (info) => info.getValue() }],
    fetcher,
    queryKeyBase: ['bulk-edit-items'],
    autoloadOnMount: true,
    editConfig: {
      dialogTitle: 'Modifica',
      fields: [
        { name: 'name', label: 'Nome', required: true },
        { name: 'category', label: 'Categoria', bulkEditable: true },
      ],
      schema: z.object({ name: z.string().min(1), category: z.string() }),
      getInitialValues: (item) => ({ name: item.name, category: item.category }),
      onSubmit: async (item, values) => {
        await editFn(item, values);
      },
      successMessage: 'Aggiornato',
    },
    bulkConfig: { enableEdit: true },
    getItemLabel: (item) => item.name,
  });
  return { editFn, fetcher };
}
```

Add `import { z } from 'zod';` at the top if not already present.

Then the test:

```tsx
  it('shows the bulk-edit button only when a bulkEditable field exists', async () => {
    renderBulkEdit();
    await screen.findByText('Alpha');
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Seleziona tutte le righe' }));
    await screen.findByText('2 selezionati');
    expect(screen.getByRole('button', { name: 'Modifica 2' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/pages/__tests__/ListPageBulk.test.tsx -t "bulk-edit button"`
Expected: FAIL — no "Modifica 2" button (and `bulkEditable`/`enableEdit` not typed).

- [ ] **Step 3: Add type members**

In `ListPage.tsx`:

(a) Add `bulkEditable` to `FormFieldConfig` (after `showIf?`):

```ts
  bulkEditable?: boolean;
```

(b) Add `enableEdit` + `editDialogTitle` to `BulkConfig`:

```ts
type BulkConfig = {
  enableDelete?: boolean;
  deleteDialogTitle?: string;
  enableEdit?: boolean;
  editDialogTitle?: string;
};
```

- [ ] **Step 4: Derive bulk-editable fields + render the button**

In `ListPage.tsx`, after the `selectedCount` / `clearSelection` lines, add:

```ts
  const bulkEditFields = useMemo(
    () => (editConfig?.fields ?? []).filter((f) => f.bulkEditable),
    [editConfig?.fields],
  );
  const bulkEditEnabled = Boolean(bulkConfig?.enableEdit && editConfig && bulkEditFields.length > 0);
```

In the toolbar (the `bulkEnabled && selectedCount > 0` Stack), add after the delete button:

```tsx
          {bulkEditEnabled && (
            <Button
              size="small"
              color="primary"
              variant="contained"
              onClick={() => setBulkEditOpen(true)}
              disabled={bulkInProgress}
            >
              {t('common:bulk.editButton', { count: selectedCount })}
            </Button>
          )}
```

Add the dialog open state next to `bulkDeleteOpen`:

```ts
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
```

> Note: the toolbar render condition is currently `bulkEnabled && selectedCount > 0` where `bulkEnabled = Boolean(bulkConfig?.enableDelete)`. Change it to also show when edit is enabled:
> replace `{bulkEnabled && selectedCount > 0 && (` with
> `{(bulkEnabled || bulkEditEnabled) && selectedCount > 0 && (`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/pages/__tests__/ListPageBulk.test.tsx -t "bulk-edit button"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/pages/ListPage.tsx apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx
git commit -m "$(cat <<'EOF'
feat(audit-ui): bulk-edit field flag + toolbar button (bulk-edit PR2)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5c1-aa01-7000-8000-gamedb20260521-bulkedit-button
EOF
)"
```

---

## Task 3: Bulk-edit dialog + apply (happy path)

Dialog with a field selector and a typed value input; apply builds a full per-row payload and submits via `Promise.allSettled`.

**Files:** Modify `apps/dashboard/src/pages/ListPage.tsx`; Test `apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx`

- [ ] **Step 1: Write the failing test**

Append:

```tsx
  it('bulk-edits the chosen field across selected rows with full per-row payload', async () => {
    const editFn = vi.fn().mockResolvedValue(undefined);
    renderBulkEdit(editFn);
    await screen.findByText('Alpha');
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Seleziona tutte le righe' }));
    await screen.findByText('2 selezionati');
    await user.click(screen.getByRole('button', { name: 'Modifica 2' }));

    const dialog = await screen.findByRole('dialog');
    // Pick the field
    await user.click(within(dialog).getByLabelText('Campo da modificare'));
    await user.click(await screen.findByRole('option', { name: 'Categoria' }));
    // Enter the value
    await user.type(within(dialog).getByLabelText('Nuovo valore'), 'Z');
    await user.click(within(dialog).getByRole('button', { name: 'Applica a 2' }));

    await waitFor(() => expect(editFn).toHaveBeenCalledTimes(2));
    // Full per-row payload: name preserved, category overridden (no field-wipe)
    expect(editFn).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1' }),
      { name: 'Alpha', category: 'Z' },
    );
    expect(editFn).toHaveBeenCalledWith(
      expect.objectContaining({ id: '2' }),
      { name: 'Beta', category: 'Z' },
    );
    await screen.findByText('2 elementi aggiornati.');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/pages/__tests__/ListPageBulk.test.tsx -t "bulk-edits the chosen"`
Expected: FAIL — dialog not rendered.

- [ ] **Step 3: Add edit state + handler**

In `ListPage.tsx`, add state next to `bulkEditOpen`:

```ts
  const [bulkEditFieldName, setBulkEditFieldName] = useState('');
  const [bulkEditValue, setBulkEditValue] = useState('');
```

Add the handler after `handleBulkDelete`:

```ts
  const handleBulkEdit = useCallback(async () => {
    if (!editConfig || !bulkEditFieldName || selectedItems.length === 0) return;
    setBulkInProgress(true);
    try {
      const targets = selectedItems;
      const results = await Promise.allSettled(
        targets.map((it) =>
          editConfig.onSubmit(it, {
            ...editConfig.getInitialValues(it),
            [bulkEditFieldName]: bulkEditValue,
          } as TValues),
        ),
      );
      const success = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - success;
      if (failed === 0) {
        enqueueSnackbar(t('common:bulk.editSuccess', { count: success }), { variant: 'success' });
      } else if (success === 0) {
        enqueueSnackbar(t('common:bulk.editAllFailed', { count: failed }), { variant: 'error' });
      } else {
        enqueueSnackbar(t('common:bulk.editPartial', { success, failed }), { variant: 'warning' });
      }
      setBulkEditOpen(false);
      setBulkEditFieldName('');
      setBulkEditValue('');
      setRowSelection({});
      await refreshList();
    } finally {
      setBulkInProgress(false);
    }
  }, [editConfig, bulkEditFieldName, bulkEditValue, selectedItems, enqueueSnackbar, t, refreshList]);
```

Reset the value when the field changes (so a stale value from a prior field doesn't leak):

```ts
  const handleBulkEditFieldChange = useCallback((name: string) => {
    setBulkEditFieldName(name);
    setBulkEditValue('');
  }, []);
```

- [ ] **Step 4: Add the dialog**

In `ListPage.tsx`, after the bulk-delete dialog (before the closing `</Paper>`), add:

```tsx
      {bulkEditEnabled && editConfig && (
        <Dialog
          open={bulkEditOpen}
          onClose={() => !bulkInProgress && setBulkEditOpen(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>{bulkConfig?.editDialogTitle ?? t('common:bulk.editDialogTitle')}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                select
                label={t('common:bulk.editFieldLabel')}
                value={bulkEditFieldName}
                onChange={(e) => handleBulkEditFieldChange(e.target.value)}
              >
                {bulkEditFields.map((f) => (
                  <MenuItem key={f.name} value={f.name}>
                    {f.label}
                  </MenuItem>
                ))}
              </TextField>
              {bulkEditFieldName && (() => {
                const field = bulkEditFields.find((f) => f.name === bulkEditFieldName);
                const isSelect = field?.type === 'select';
                return (
                  <TextField
                    label={t('common:bulk.editValueLabel')}
                    value={bulkEditValue}
                    onChange={(e) => setBulkEditValue(e.target.value)}
                    select={isSelect}
                    type={field?.type === 'number' ? 'number' : undefined}
                    fullWidth
                  >
                    {isSelect &&
                      field?.options?.map((o) => (
                        <MenuItem key={o.value} value={o.value}>
                          {o.label}
                        </MenuItem>
                      ))}
                  </TextField>
                );
              })()}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBulkEditOpen(false)} disabled={bulkInProgress}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleBulkEdit}
              disabled={bulkInProgress || !bulkEditFieldName}
            >
              {t('common:bulk.editApply', { count: selectedCount })}
            </Button>
          </DialogActions>
        </Dialog>
      )}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/pages/__tests__/ListPageBulk.test.tsx -t "bulk-edits the chosen"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/pages/ListPage.tsx apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx
git commit -m "$(cat <<'EOF'
feat(audit-ui): bulk-edit dialog + full-payload apply (bulk-edit PR2)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5c2-aa01-7000-8000-gamedb20260521-bulkedit-dialog
EOF
)"
```

---

## Task 4: Partial-failure + stale-selection clears edit state

**Files:** Test `apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx`; Modify `apps/dashboard/src/pages/ListPage.tsx`

- [ ] **Step 1: Write the partial-failure test**

Append:

```tsx
  it('reports partial-failure counts when some bulk-edits reject', async () => {
    const editFn = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'));
    renderBulkEdit(editFn);
    await screen.findByText('Alpha');
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Seleziona tutte le righe' }));
    await screen.findByText('2 selezionati');
    await user.click(screen.getByRole('button', { name: 'Modifica 2' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('Campo da modificare'));
    await user.click(await screen.findByRole('option', { name: 'Categoria' }));
    await user.type(within(dialog).getByLabelText('Nuovo valore'), 'Z');
    await user.click(within(dialog).getByRole('button', { name: 'Applica a 2' }));

    await waitFor(() => expect(editFn).toHaveBeenCalledTimes(2));
    await screen.findByText('1 aggiornati, 1 falliti.');
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/pages/__tests__/ListPageBulk.test.tsx -t "partial-failure counts when some bulk-edits"`
Expected: PASS (handler from Task 3 already implements the tally).

- [ ] **Step 3: Clear edit dialog state on criteria change**

The PR1 stale-selection guard already resets `rowSelection` on `criteria` change. Extend it so a stale field/value/open-dialog does not survive a navigation. Replace the existing guard effect:

```ts
  useEffect(() => {
    setRowSelection({});
    setBulkEditOpen(false);
    setBulkEditFieldName('');
    setBulkEditValue('');
  }, [criteria.query, criteria.page, criteria.pageSize, criteria.sort]);
```

- [ ] **Step 4: Run the full bulk suite**

Run: `cd apps/dashboard && npx vitest run src/pages/__tests__/ListPageBulk.test.tsx`
Expected: all green (PR1 + new PR2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/ListPage.tsx apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx
git commit -m "$(cat <<'EOF'
feat(audit-ui): bulk-edit partial-failure + stale-state clear (bulk-edit PR2)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5c3-aa01-7000-8000-gamedb20260521-bulkedit-partial
EOF
)"
```

---

## Task 5: Mark bulkEditable fields on 7 pages

Add `bulkEditable: true` to the chosen fields and `enableEdit: true` to each `bulkConfig`. `EcosystemBiomeListPage` gets `enableEdit: true` but NO `bulkEditable` field (button stays hidden — exercises graceful-hide).

**Files (modify each `formFields` entry + `bulkConfig`):**

| File | Mark `bulkEditable: true` on |
|---|---|
| `TraitListPage.tsx` | `category`, `dataType`, `unit` |
| `BiomeListPage.tsx` | `climate` |
| `SpeciesListPage.tsx` | `kingdom`, `phylum`, `className`, `order`, `family`, `genus`, `status` |
| `EcosystemListPage.tsx` | `region`, `climate` |
| `SpeciesTraitListPage.tsx` | `category` |
| `SpeciesBiomeListPage.tsx` | `presence` |
| `EcosystemSpeciesListPage.tsx` | `role` |
| `EcosystemBiomeListPage.tsx` | (none) |

- [ ] **Step 1: Write the smoke test on TraitListPage**

Append to `apps/dashboard/src/features/taxonomies/pages/__tests__/TraitListPage.test.tsx` (reuse this file's existing `renderPage()` + `taxonomyMocks`):

```tsx
  it('exposes bulk-edit (Modifica button after select-all)', async () => {
    const { user } = renderPage();
    await waitFor(() => expect(taxonomyMocks.listTraits).toHaveBeenCalledTimes(1));
    await screen.findByText('Lunghezza corpo');
    await user.click(screen.getByRole('checkbox', { name: 'Seleziona tutte le righe' }));
    expect(await screen.findByRole('button', { name: /Modifica \d+/ })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/features/taxonomies/pages/__tests__/TraitListPage.test.tsx -t "bulk-edit"`
Expected: FAIL — no "Modifica N" button (no `enableEdit`/`bulkEditable` yet).

- [ ] **Step 3: Edit each page**

For each page: add `enableEdit: true` to its `bulkConfig` (so `bulkConfig={{ enableDelete: true, enableEdit: true }}`), and add `bulkEditable: true` to the listed `formFields` entries.

Example for `TraitListPage.tsx` formFields:

```tsx
      { name: 'category', label: t('traits.form.category'), bulkEditable: true },
      { name: 'dataType', label: t('traits.form.dataType'), required: true, type: 'select', options: dataTypeOptions, bulkEditable: true },
      { name: 'unit', label: t('traits.form.unit'), bulkEditable: true },
```

And:

```tsx
      bulkConfig={{ enableDelete: true, enableEdit: true }}
```

Repeat per the table above. For `EcosystemBiomeListPage.tsx`, set `bulkConfig={{ enableDelete: true, enableEdit: true }}` but mark NO field `bulkEditable`.

- [ ] **Step 4: Run the smoke test + full suite**

Run: `cd apps/dashboard && npx vitest run src/features/taxonomies/pages/__tests__/TraitListPage.test.tsx -t "bulk-edit"`
Expected: PASS.

Run: `cd apps/dashboard && npx vitest run src/`
Expected: pre-existing `src/lib/records.test.ts` failures only (4, environmental — confirmed on base `main`); all bulk + page tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/features/taxonomies/pages/
git commit -m "$(cat <<'EOF'
feat(audit-ui): enable bulk-edit fields on entity tables (bulk-edit PR2)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5c4-aa01-7000-8000-gamedb20260521-bulkedit-optin
EOF
)"
```

---

## Task 6: Research doc + PR

**Files:** Create `docs/research/bulk-edit-pr2-2026-05-21.md`

- [ ] **Step 1: Write the research doc**

```markdown
# Bulk-edit PR2 (single-field edit) — edge-case research 2026-05-21

## Edge cases covered
1. **No bulk-editable field**: when an entity (EcosystemBiome) marks no field
   `bulkEditable`, the "Modifica N" button is hidden (`bulkEditEnabled` false).
   Graceful per spec.
2. **Full-payload merge (no field-wipe)**: each row submits
   `{ ...getInitialValues(item), [field]: value }`. Test asserts the non-target
   field (`name`) is preserved while only `category` changes — guards against the
   PUT full-replace wipe risk (`traits.js:172`).
3. **Unique-field exclusion**: slug/name/scientificName are never marked
   `bulkEditable`, so the field selector cannot offer them — prevents an N-row
   duplicate-slug 409 cascade.
4. **Partial failure**: warning toast `editPartial {success, failed}`; failed rows
   reappear after refetch (authoritative state).
5. **Field switch resets value**: changing the selected field clears the value so
   a value typed for field A cannot be applied to field B.
6. **Stale state on navigation**: the criteria-change guard now also closes the
   dialog and clears field/value, so a pending edit cannot apply to a refreshed
   row set (extends the PR1 stale-selection lesson, PR #141 / PR #145).

## Tuning note
Bulk-edit issues N parallel single-PUT requests via `Promise.allSettled`, bounded
by page size (<=50). No batching needed at current taxonomy scale.
```

- [ ] **Step 2: Commit**

```bash
git add docs/research/bulk-edit-pr2-2026-05-21.md
git commit -m "$(cat <<'EOF'
docs(research): bulk-edit PR2 edge-case research (Fase 2)

Coding-Agent: claude-opus-4.7
Trace-Id: 0192d5c5-aa01-7000-8000-gamedb20260521-bulkedit-research
EOF
)"
```

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin claude/bulk-edit-pr2-edit-2026-05-21
gh pr create --title "feat(audit-ui): bulk-edit single-field on entity tables (Fase 2 bulk-edit PR2)" --body "..."
```

- [ ] **Step 4: MANDATORY pre-merge review protocol**

`gh api repos/MasterDD-L34D/Game-Database/pulls/<N>/comments` — triage P1/P2 before merge.

---

## Self-Review

**Spec coverage:** bulk-EDIT single-field (Tasks 2-5), full-payload merge no-wipe (Task 3 + test), unique-field exclusion (config — Task 5 table excludes slug/name), partial-failure (Task 4), graceful hide when no bulk-editable field (Task 5 EcosystemBiome). Covered.

**Placeholder scan:** PR body in Task 6 Step 3 is `"..."` — fill at execution with summary mirroring PR1. Otherwise no placeholders.

**Type consistency:** `bulkEditable` (FormFieldConfig), `enableEdit`/`editDialogTitle` (BulkConfig), `bulkEditFields`/`bulkEditEnabled`, `bulkEditOpen`/`bulkEditFieldName`/`bulkEditValue`, `handleBulkEdit`/`handleBulkEditFieldChange` consistent across Tasks 2-4. i18n `common:bulk.edit*` defined in Task 1, used in Tasks 2-3.
