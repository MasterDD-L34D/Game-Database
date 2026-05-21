# Bulk-edit PR 3 — Multi-field bulk-edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Let bulk-edit set multiple fields in one apply pass (e.g. Species kingdom+phylum+class together), extending the PR2 single-field dialog.

**Architecture:** Replace the scalar `bulkEditFieldName`/`bulkEditValue` state with an array `bulkEdits: Array<{ field: string; value: string }>`. The dialog renders one field-selector + value-input row per entry, with "Aggiungi campo" / remove controls. Apply merges all chosen pairs into per-row overrides `{ ...getInitialValues(item), ...overrides }`. A single default row preserves PR2 single-field behavior (existing tests stay green).

**Tech Stack:** React 18, TS, MUI, TanStack, react-i18next, Vitest.
**Spec:** `docs/superpowers/specs/2026-05-21-bulk-edit-entity-tables-design.md` § "PR 3"
**Builds on:** PR2 (#146, `7f43343`).

---

## File Structure

- Modify `apps/dashboard/src/pages/ListPage.tsx` — state→array, derive, handler, dialog rows + add/remove.
- Modify `apps/dashboard/src/i18n/locales/it/common.json` — `bulk.editAddField` / `bulk.editRemoveField`.
- Modify `apps/dashboard/src/pages/__tests__/ListPageBulk.test.tsx` — multi-field test.
- Create `docs/research/bulk-edit-pr3-2026-05-21.md`.

---

## Task 1: i18n keys

- [ ] **Step 1:** add inside `bulk` block (after `editAllFailed`):

```json
    "editAddField": "Aggiungi campo",
    "editRemoveField": "Rimuovi campo"
```

(add comma after `editAllFailed` value).

- [ ] **Step 2:** `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/it/common.json','utf8'));console.log('OK')"` → OK
- [ ] **Step 3:** commit `feat(audit-ui): multi-field bulk-edit i18n (bulk-edit PR3)` with trailers.

---

## Task 2: Refactor to array state + multi-row dialog

- [ ] **Step 1: Write the failing multi-field test** in `ListPageBulk.test.tsx` (uses existing `renderBulkEdit` which has 2 bulkEditable... it only has `category`. Add a second bulkEditable field to `renderBulkEdit` config: add `{ name: 'unit', label: 'Unita', bulkEditable: true }` to its fields + `unit` to getInitialValues `({ name, category, unit: '' })` + schema `unit: z.string().optional()` + EditItem type gains `unit?: string`). Then:

```tsx
  it('bulk-edits multiple fields in one pass', async () => {
    const editFn = vi.fn().mockResolvedValue(undefined);
    renderBulkEdit(editFn);
    await screen.findByText('Alpha');
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Seleziona tutte le righe' }));
    await screen.findByText('2 selezionati');
    await user.click(screen.getByRole('button', { name: 'Modifica 2' }));
    const dialog = await screen.findByRole('dialog');

    // Row 1: category = Z
    const fieldSelects = within(dialog).getAllByLabelText('Campo da modificare');
    await user.click(fieldSelects[0]);
    await user.click(await screen.findByRole('option', { name: 'Categoria' }));
    const valueInputs = within(dialog).getAllByLabelText('Nuovo valore');
    await user.type(valueInputs[0], 'Z');

    // Add a second field row: unit = kg
    await user.click(within(dialog).getByRole('button', { name: 'Aggiungi campo' }));
    const fieldSelects2 = within(dialog).getAllByLabelText('Campo da modificare');
    await user.click(fieldSelects2[1]);
    await user.click(await screen.findByRole('option', { name: 'Unita' }));
    const valueInputs2 = within(dialog).getAllByLabelText('Nuovo valore');
    await user.type(valueInputs2[1], 'kg');

    await user.click(within(dialog).getByRole('button', { name: 'Applica a 2' }));
    await waitFor(() => expect(editFn).toHaveBeenCalledTimes(2));
    expect(editFn).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1' }),
      { name: 'Alpha', category: 'Z', unit: 'kg' },
    );
  });
```

- [ ] **Step 2:** run → FAIL (no "Aggiungi campo").

- [ ] **Step 3: Replace state** (lines ~211-212):

```ts
  const [bulkEdits, setBulkEdits] = useState<{ field: string; value: string }[]>([{ field: '', value: '' }]);
```

Remove `bulkEditFieldName` / `bulkEditValue` state.

- [ ] **Step 4: Replace derive** (the `bulkEditSelectedField` / `bulkEditApplyDisabled` / `handleBulkEditFieldChange` block ~391-400):

```ts
  const bulkEditValidEdits = useMemo(
    () => bulkEdits.filter((e) => e.field),
    [bulkEdits],
  );
  const bulkEditApplyDisabled =
    bulkInProgress ||
    bulkEditValidEdits.length === 0 ||
    bulkEditValidEdits.some((e) => {
      const f = bulkEditFields.find((x) => x.name === e.field);
      return Boolean(f?.required) && !e.value;
    });
  const setBulkEditRowField = useCallback((index: number, name: string) => {
    setBulkEdits((prev) => prev.map((e, i) => (i === index ? { field: name, value: '' } : e)));
  }, []);
  const setBulkEditRowValue = useCallback((index: number, value: string) => {
    setBulkEdits((prev) => prev.map((e, i) => (i === index ? { ...e, value } : e)));
  }, []);
  const addBulkEditRow = useCallback(() => {
    setBulkEdits((prev) => [...prev, { field: '', value: '' }]);
  }, []);
  const removeBulkEditRow = useCallback((index: number) => {
    setBulkEdits((prev) => (prev.length <= 1 ? [{ field: '', value: '' }] : prev.filter((_, i) => i !== index)));
  }, []);
  const resetBulkEdits = useCallback(() => setBulkEdits([{ field: '', value: '' }]), []);
```

- [ ] **Step 5: Replace handler** (`handleBulkEdit` ~478-508):

```ts
  const handleBulkEdit = useCallback(async () => {
    if (!editConfig || bulkEditValidEdits.length === 0 || selectedItems.length === 0) return;
    const overrides = Object.fromEntries(bulkEditValidEdits.map((e) => [e.field, e.value]));
    setBulkInProgress(true);
    try {
      const results = await Promise.allSettled(
        selectedItems.map((it) =>
          editConfig.onSubmit(it, { ...editConfig.getInitialValues(it), ...overrides } as TValues),
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
      resetBulkEdits();
      setRowSelection({});
      await refreshList();
    } finally {
      setBulkInProgress(false);
    }
  }, [editConfig, bulkEditValidEdits, selectedItems, enqueueSnackbar, t, refreshList, resetBulkEdits]);
```

- [ ] **Step 6: Update stale-guard** (the criteria-change effect that resets edit state): replace the `setBulkEditFieldName('')` / `setBulkEditValue('')` lines with `setBulkEdits([{ field: '', value: '' }]);`.

- [ ] **Step 7: Replace the dialog body** (the `<Stack>` inside bulk-edit `<DialogContent>` ~841-875) with per-row rendering:

```tsx
            <Stack spacing={2} sx={{ mt: 1 }}>
              {bulkEdits.map((edit, index) => {
                const field = bulkEditFields.find((f) => f.name === edit.field);
                const isSelect = field?.type === 'select';
                const usedByOthers = bulkEdits.filter((_, i) => i !== index).map((e) => e.field);
                return (
                  <Stack key={index} direction="row" spacing={1} alignItems="flex-start">
                    <TextField
                      select
                      label={t('common:bulk.editFieldLabel')}
                      value={edit.field}
                      onChange={(e) => setBulkEditRowField(index, e.target.value)}
                      sx={{ flex: 1 }}
                    >
                      {bulkEditFields.map((f) => (
                        <MenuItem key={f.name} value={f.name} disabled={usedByOthers.includes(f.name)}>
                          {f.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    {edit.field && (
                      <TextField
                        label={t('common:bulk.editValueLabel')}
                        value={edit.value}
                        onChange={(e) => setBulkEditRowValue(index, e.target.value)}
                        select={isSelect}
                        type={field?.type === 'number' ? 'number' : undefined}
                        sx={{ flex: 1 }}
                      >
                        {isSelect &&
                          field?.options?.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                              {o.label}
                            </MenuItem>
                          ))}
                      </TextField>
                    )}
                    {bulkEdits.length > 1 && (
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() => removeBulkEditRow(index)}
                        aria-label={t('common:bulk.editRemoveField')}
                      >
                        X
                      </Button>
                    )}
                  </Stack>
                );
              })}
              {bulkEditValidEdits.length < bulkEditFields.length && (
                <Button size="small" onClick={addBulkEditRow} sx={{ alignSelf: 'flex-start' }}>
                  {t('common:bulk.editAddField')}
                </Button>
              )}
            </Stack>
```

Also update the cancel button + onClose to call `resetBulkEdits()` alongside `setBulkEditOpen(false)` for a clean reopen (optional but tidy): change `onClick={() => setBulkEditOpen(false)}` to `onClick={() => { setBulkEditOpen(false); resetBulkEdits(); }}`.

- [ ] **Step 8:** run `npx vitest run src/pages/__tests__/ListPageBulk.test.tsx` → all green (PR2 single-field tests + new multi-field).

- [ ] **Step 9: commit** `feat(audit-ui): multi-field bulk-edit (bulk-edit PR3)` with trailers.

---

## Task 3: Research doc + PR

- [ ] **Step 1:** create `docs/research/bulk-edit-pr3-2026-05-21.md` (multi-field edge cases: dedup via Object.fromEntries, used-field disable, required-empty gating per row, single-row backward-compat, remove-last-row resets to one empty).
- [ ] **Step 2:** commit.
- [ ] **Step 3:** push + `gh pr create`.
- [ ] **Step 4:** MANDATORY `gh api .../pulls/<N>/comments` triage P1/P2 before merge.

---

## Self-Review
- Spec: PR3 multi-field-in-one-pass — Task 2. Covered.
- Backward-compat: single default row → PR2 tests unchanged.
- Types: `bulkEdits`/`bulkEditValidEdits`/`setBulkEditRowField`/`setBulkEditRowValue`/`addBulkEditRow`/`removeBulkEditRow`/`resetBulkEdits` consistent.
- i18n `editAddField`/`editRemoveField` defined Task 1, used Task 2.
