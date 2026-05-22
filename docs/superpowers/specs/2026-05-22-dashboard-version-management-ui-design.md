# Dashboard Version-Management UI Design

> Status: APPROVED 2026-05-22. Scope: Game-Database React dashboard (`apps/dashboard`).
> Consumes the Phase B1 lifecycle API (`/api/taxonomy/versions`) and the Phase C-DB
> versioned reads (`GET /api/traits?versionId=`).

**Goal:** Give curators a dashboard surface to manage the taxonomy version lifecycle (list / create draft / release / retire / delete draft) and to view a released version's frozen trait snapshot via a version picker on the trait list.

**Architecture:** A new bespoke `features/versions/` slice (page + table + dialogs) consumes the existing lifecycle API; a `VersionPicker` added to the trait list threads `?versionId=` through the existing trait query to show snapshots read-only. The shared API client gains an `X-Roles` header (from `VITE_API_ROLES`, mirroring the existing `X-User` from `VITE_API_USER`) plus error-body parsing so admin-only mutations and their backend error codes surface correctly.

**Tech stack:** React + Vite, MUI, TanStack Query + Table, react-router, react-hook-form + Zod, react-i18next. Tests: Vitest + Testing Library.

---

## Scope

In scope:

- New page `/taxonomy-versions`: list all versions; create draft; release; retire; delete draft; view per-version snapshot counts in a detail dialog.
- `X-Roles` support in the API client so admin-only version mutations authenticate.
- Error-body parsing in the API client so backend `code`/`message` reach the UI.
- Version picker on the trait list: select a released/retired tag -> trait list re-fetches the frozen snapshot read-only.

Out of scope (deliberate, YAGNI):

- Biome/Species/Ecosystem snapshot viewers (backend C-DB ships trait-only; mirror that).
- Version diff/compare UI.
- Editing snapshot rows (snapshots are immutable by design).
- Any backend change. The lifecycle API (`requireAdmin`) and the `?versionId=` read path already exist and are unchanged.

## Backend contract (existing, for reference)

- `GET /api/taxonomy/versions?includeRetired=true|false` -> `{ versions: [ { id, tag, status, description, releasedAt, releasedBy, createdAt, updatedAt } ] }`. NOT paginated; sorted `releasedAt` desc nulls first. Excludes `retired` unless `includeRetired=true`. Open (no role).
- `GET /api/taxonomy/versions/:tag` -> `{ version, counts: { trait, biome, species, ecosystem } }`. Open. 404 `NOT_FOUND` unknown tag.
- `POST /api/taxonomy/versions` body `{ tag, description? }` -> 201 `{ version }`. **admin**. 409 `DRAFT_EXISTS` / `TAG_EXISTS`, 400 `VALIDATION_ERROR` (tag not semver-like `^v\d+\.\d+\.\d+(-...)?$`).
- `POST /api/taxonomy/versions/:tag/release` -> 200 `{ version, counts }`. **admin**. 404; 409 `INVALID_STATE` (only a draft can be released).
- `POST /api/taxonomy/versions/:tag/retire` -> 200 `{ version }`. **admin**. 404; 409 `INVALID_STATE` (only a released version can be retired).
- `DELETE /api/taxonomy/versions/:tag` -> 200 `{ success, tag }`. **admin**. 404; 409 `INVALID_STATE` (only a draft can be deleted).
- `GET /api/traits?versionId=<tag>` -> `{ items, page, pageSize, total, _version }` (versioned snapshot). 404 `VERSION_NOT_FOUND`, 400 `VERSION_NOT_RELEASED`.

Status enum: `draft` -> `released` -> `retired`. At most one `draft` at a time (DB partial unique index -> `DRAFT_EXISTS`).

## Components

### `src/lib/api/index.ts` (modify)

1. `authHeaders()` adds `X-Roles` from `import.meta.env.VITE_API_ROLES` when set (mirrors the existing `X-User` from `VITE_API_USER`). When unset, no header is added -> existing behavior unchanged.
2. On a non-OK response, `fetchJSON` / `postJSON` / `deleteJSON` attempt to parse the JSON error body and throw an Error carrying `status`, `code`, and `message` (when present), instead of the bare `HTTP <status>`. Backward-compatible: still an Error; callers that ignore the extra fields are unaffected. A small shared helper builds the error from a Response.

### `src/lib/taxonomy.ts` (modify)

Add version client functions (each returns the parsed JSON shape above):

- `listTaxonomyVersions(includeRetired = false)` -> `GET /taxonomy/versions?includeRetired=`.
- `getTaxonomyVersion(tag)` -> `GET /taxonomy/versions/:tag`.
- `createTaxonomyVersion({ tag, description })` -> `POST /taxonomy/versions`.
- `releaseTaxonomyVersion(tag)` -> `POST /taxonomy/versions/:tag/release`.
- `retireTaxonomyVersion(tag)` -> `POST /taxonomy/versions/:tag/retire`.
- `deleteTaxonomyVersion(tag)` -> `DELETE /taxonomy/versions/:tag`.

Extend `listTraits(q, page, pageSize, sort, versionId = '')` to append `&versionId=` when non-empty (and only then). When `versionId` is set, the returned shape includes `_version`; the existing live shape is unchanged when it is empty.

### `src/features/versions/pages/TaxonomyVersionPage.tsx` (new)

- `useQuery(['taxonomy-versions', { includeRetired }], () => listTaxonomyVersions(includeRetired))`.
- An `includeRetired` toggle (MUI Switch/Checkbox) in the toolbar.
- A "New version" button opening `CreateVersionDialog`.
- Renders `VersionTable`.
- Owns the mutations via `useMutation`; each `onSuccess` invalidates `['taxonomy-versions']` and shows a success snackbar; each `onError` shows the backend `code`-mapped message.
- A details action opens `VersionDetailDialog` (fetches `getTaxonomyVersion(tag)` -> shows counts).

### `src/features/versions/components/VersionTable.tsx` (new)

- MUI Table (the version list is small + non-paginated; the generic `DataTable`/`ListPage` assume paginated CRUD and a uniform edit dialog, which does not fit status-conditional actions -- a bespoke table is the right boundary).
- Columns: tag, status (colored MUI `Chip`: draft=default, released=success, retired=disabled/grey), `releasedAt` (formatted, em-dash/`-` when null), description, actions.
- Per-row actions gated by status:
  - `draft`: Release, Delete, Details.
  - `released`: Retire, Details.
  - `retired`: Details only.
- Each mutating action triggers a confirm dialog before firing (release is irreversible: it freezes an immutable snapshot).

### `src/features/versions/components/CreateVersionDialog.tsx` (new)

- react-hook-form + Zod: `tag` required, must match `^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$` (mirror backend `SEMVER_RE`) with a localized error; `description` optional.
- Submits `createTaxonomyVersion`; closes on success; surfaces `DRAFT_EXISTS`/`TAG_EXISTS` as field/snackbar errors.

### `src/features/versions/components/VersionDetailDialog.tsx` (new)

- On open, `useQuery(['taxonomy-version', tag], () => getTaxonomyVersion(tag))`.
- Read-only: shows tag, status, releasedAt, releasedBy, description, and counts (`trait`/`biome`/`species`/`ecosystem`).

### `src/features/taxonomies/components/VersionPicker.tsx` (new)

- MUI `Select` listing released + retired tags (drafts excluded -- no snapshot to read). Built from `listTaxonomyVersions(true)` filtered to `status !== 'draft'`.
- A "Live" option (empty value) returns to the live view.
- On change, `setSearchParams` to set/clear `versionId` in the URL.

### `src/features/taxonomies/pages/TraitListPage.tsx` (modify)

- Read `versionId` from `searchParams`.
- Pass `versionId` into the `listTraits` fetcher (thread through the existing `ListPage` `fetcher` prop).
- Render `VersionPicker` in the toolbar.
- When `versionId` is set: show a read-only banner (e.g. "Viewing snapshot <tag> -- read-only") and hide create/edit/delete/bulk actions (a snapshot cannot be mutated).

### Routing + nav + i18n

- `src/routes.tsx`: add `{ path: 'taxonomy-versions', element: <TaxonomyVersionPage /> }`.
- `src/layout/Sidebar.tsx`: add a nav entry `{ to: '/taxonomy-versions', key: 'taxonomyVersions', icon: <a Heroicon consistent with the existing nav entries, e.g. TagIcon> }`.
- `src/i18n/locales/it/versions.json` (new namespace): title, columns, statuses, actions, dialog labels, confirm prompts, feedback/error messages. Register the namespace in `src/i18n/index.ts`. Italian locale JSON follows the existing convention (raw accented characters, as in `taxonomy.json`); TS/TSX source stays ASCII per ADR-0021.

## Data flow

1. Version page loads -> `listTaxonomyVersions(includeRetired)` -> table.
2. Create/release/retire/delete -> mutation -> backend (`X-Roles: <VITE_API_ROLES>` carries admin) -> on success invalidate `['taxonomy-versions']` + snackbar.
3. Details action -> `getTaxonomyVersion(tag)` -> counts in dialog.
4. Trait list snapshot: `VersionPicker` sets `?versionId=tag` -> `TraitListPage` reads it -> `listTraits(..., versionId)` -> `GET /api/traits?versionId=` -> table shows mapped snapshot rows + read-only banner; mutation actions hidden.

## Error handling

- The API client's parsed error exposes `status`, `code`, `message`. The version page maps codes to localized snackbar text: `DRAFT_EXISTS`, `TAG_EXISTS`, `INVALID_STATE`, `VALIDATION_ERROR`, `VERSION_NOT_FOUND`, `VERSION_NOT_RELEASED`, and `FORBIDDEN` -> a hint to set `VITE_API_ROLES=admin`. Unknown codes fall back to a generic message.
- Client-side semver validation blocks an invalid `tag` before the request.
- Confirm dialogs guard release/retire/delete.
- Picker: selecting a tag whose snapshot 404/400s (should not happen for released/retired) surfaces the mapped error and reverts to Live.

## Testing

Vitest component tests mirroring `src/features/taxonomies/pages/__tests__/TraitListPage.test.tsx` (mock the version API fns, render with providers, assert on calls + DOM):

- Version page: list renders rows with status chips; "New version" -> dialog -> submit calls `createTaxonomyVersion({ tag, description })`; invalid semver tag blocks submit with a validation message.
- Status-conditional actions: a `draft` row shows Release+Delete; a `released` row shows Retire (not Release/Delete); a `retired` row shows Details only.
- Release/retire/delete each go through a confirm dialog and call the matching client fn; success invalidates + snackbars; a 409 `INVALID_STATE` error shows the mapped message.
- Details dialog: opening calls `getTaxonomyVersion` and renders counts.
- `VersionPicker`: selecting a tag sets `versionId` in the URL and triggers a versioned `listTraits` call; selecting "Live" clears it.
- Trait list read-only mode: with `versionId` set, create/edit/delete actions are not rendered and the banner shows.
- API client: `authHeaders` includes `X-Roles` when `VITE_API_ROLES` is set and omits it when unset; a non-OK response throws an Error carrying the parsed `code`.

## Non-goals recap

No backend change. Trait-only snapshot viewer. Counts in the detail dialog, not per row (avoids an N+1 of `GET /:tag` across the list). No diff/compare. Bespoke version table rather than forcing the generic paginated `ListPage`.
