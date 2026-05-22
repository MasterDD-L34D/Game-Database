# Dashboard Version-Management UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/taxonomy-versions` dashboard page (list/create-draft/release/retire/delete-draft) plus a version picker on the trait list that shows a released version's frozen snapshot via `?versionId=`.

**Architecture:** A bespoke `features/versions/` slice consumes the existing `/api/taxonomy/versions` lifecycle API. The trait list gains a `VersionPicker` that threads `?versionId=` through the existing `listTraits` fetcher and hides mutation UI when active. The shared API client gains an `X-Roles` header (from `VITE_API_ROLES`, mirroring `X-User`) and error-body parsing so admin mutations and their backend error codes work.

**Tech Stack:** React + Vite, MUI, TanStack Query + Table, react-router, react-hook-form + Zod, react-i18next; Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-22-dashboard-version-management-ui-design.md`

**Branch:** `feat/dashboard-version-ui` (already created).

---

## Conventions (read before starting)

- Work from `apps/dashboard/` for `npm` commands. Run a single test file with `npx vitest run <path>`; the whole suite with `npm test`.
- TS/TSX source stays ASCII (ADR-0021). Italian **locale JSON** files follow the existing convention and MAY contain raw accented characters (e.g. `taxonomy.json` has `Unita`/`e`); do not ASCII-escape them.
- Commit hooks (run from repo root): Conventional Commit `type(scope): description`; text after the prefix starts LOWERCASE; subject `<= 72` chars; description body lines start lowercase; NO `Co-Authored-By`. Required trailers: `Coding-Agent: claude-opus-4.7` and `Trace-Id: <uuid-v7>`. Generate uuid-v7:
  ```bash
  node -e "const b=require('crypto').randomBytes(16);const t=Date.now();b[0]=(t/2**40)&0xff;b[1]=(t/2**32)&0xff;b[2]=(t/2**24)&0xff;b[3]=(t/2**16)&0xff;b[4]=(t/2**8)&0xff;b[5]=t&0xff;b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');console.log(h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20))"
  ```
  Pass multi-line messages via a single-quoted heredoc (`git commit -m "$(cat <<'EOF' ... EOF\n)"`), never `printf`.
- Backend API (already shipped, do not change):
  - `GET /api/taxonomy/versions?includeRetired=` -> `{ versions: [...] }` (not paginated; excludes retired unless `includeRetired=true`).
  - `GET /api/taxonomy/versions/:tag` -> `{ version, counts: { trait, biome, species, ecosystem } }`.
  - `POST /api/taxonomy/versions` `{ tag, description? }` -> 201 `{ version }` (admin; 409 `DRAFT_EXISTS`/`TAG_EXISTS`; 400 `VALIDATION_ERROR`).
  - `POST /api/taxonomy/versions/:tag/release` -> 200 `{ version, counts }` (admin; 409 `INVALID_STATE`).
  - `POST /api/taxonomy/versions/:tag/retire` -> 200 `{ version }` (admin; 409 `INVALID_STATE`).
  - `DELETE /api/taxonomy/versions/:tag` -> 200 `{ success, tag }` (admin; 409 `INVALID_STATE`).
  - `GET /api/traits?versionId=<tag>` -> `{ items, page, pageSize, total, _version }`.

## File Structure

- Modify `apps/dashboard/src/lib/api/index.ts` -- `X-Roles` header + `ApiError` with parsed `status`/`code`.
- Modify `apps/dashboard/src/lib/taxonomy.ts` -- version types + client fns; extend `listTraits` with `versionId`.
- Create `apps/dashboard/src/i18n/locales/it/versions.json`; modify `i18n/index.ts` (register) + `locales/it/navigation.json` (nav key).
- Create `apps/dashboard/src/features/versions/components/VersionStatusChip.tsx`.
- Create `apps/dashboard/src/features/versions/components/VersionTable.tsx`.
- Create `apps/dashboard/src/features/versions/components/CreateVersionDialog.tsx`.
- Create `apps/dashboard/src/features/versions/components/VersionDetailDialog.tsx`.
- Create `apps/dashboard/src/features/versions/pages/TaxonomyVersionPage.tsx`; modify `routes.tsx` + `layout/Sidebar.tsx`.
- Create `apps/dashboard/src/features/taxonomies/components/VersionPicker.tsx`; modify `features/taxonomies/pages/TraitListPage.tsx`.
- Tests under each feature's `__tests__/`.

---

### Task 1: API client -- X-Roles header + error-body parsing

**Files:**
- Modify: `apps/dashboard/src/lib/api/index.ts`
- Create: `apps/dashboard/src/lib/api/__tests__/api.test.ts`
- Modify: `apps/dashboard/.env.local.example`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/lib/api/__tests__/api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJSON, ApiError } from '../index';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

function mockFetchOnce(status: number, body: unknown, ok = status < 400) {
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }) as Response,
  ) as unknown as typeof fetch;
  void ok;
}

describe('api client', () => {
  it('sends X-Roles when VITE_API_ROLES is set', async () => {
    vi.stubEnv('VITE_API_ROLES', 'admin');
    const spy = vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }) as Response);
    globalThis.fetch = spy as unknown as typeof fetch;
    await fetchJSON('/ping');
    const init = spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-Roles']).toBe('admin');
  });

  it('omits X-Roles when VITE_API_ROLES is unset', async () => {
    vi.stubEnv('VITE_API_ROLES', '');
    const spy = vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }) as Response);
    globalThis.fetch = spy as unknown as typeof fetch;
    await fetchJSON('/ping');
    const init = spy.mock.calls[0][1] as RequestInit;
    expect('X-Roles' in (init.headers as Record<string, string>)).toBe(false);
  });

  it('throws ApiError carrying status + code from the error body', async () => {
    mockFetchOnce(409, { code: 'DRAFT_EXISTS', message: 'A draft already exists' });
    await expect(fetchJSON('/x')).rejects.toMatchObject({ status: 409, code: 'DRAFT_EXISTS' });
    await expect(fetchJSON('/x')).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/lib/api/__tests__/api.test.ts`
Expected: FAIL -- `ApiError` is not exported.

- [ ] **Step 3: Implement**

Edit `apps/dashboard/src/lib/api/index.ts`. Replace the file with:

```ts

import { NetworkError } from './errors';

const BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const USER = import.meta.env.VITE_API_USER as string | undefined;

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function authHeaders() {
  const roles = import.meta.env.VITE_API_ROLES as string | undefined;
  return {
    ...(USER ? { 'X-User': USER } : {}),
    ...(roles ? { 'X-Roles': roles } : {}),
  } as Record<string, string>;
}

async function toApiError(res: Response): Promise<ApiError> {
  let code: string | undefined;
  let message = `HTTP ${res.status}`;
  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body = (await res.json()) as { code?: string; message?: string };
      if (body && typeof body === 'object') {
        if (body.code) code = body.code;
        if (body.message) message = body.message;
      }
    }
  } catch {
    // non-JSON or empty body -> keep the generic message
  }
  return new ApiError(res.status, message, code);
}

async function executeFetch(path: string, init?: RequestInit) {
  try {
    return await fetch(`${BASE}${path}`, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new NetworkError('Unable to reach the API server.', { cause: error });
    }
    throw error;
  }
}

export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await executeFetch(path, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

export async function postJSON<TReq, TRes = unknown>(path: string, body: TReq, init?: RequestInit): Promise<TRes> {
  const method = init?.method ?? 'POST';
  const res = await executeFetch(path, {
    ...init,
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toApiError(res);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? await res.json() : (undefined as unknown as TRes);
}

export async function deleteJSON(path: string, init?: RequestInit): Promise<void> {
  const res = await executeFetch(path, {
    ...init,
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
  });
  if (!res.ok) throw await toApiError(res);
}

function normalizeBasePath(basePath: string) {
  if (!basePath) return '';
  const trimmed = basePath.replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function normalizeSuffix(path: string) {
  if (!path) return '';
  return path.startsWith('/') ? path : `/${path}`;
}

export function createJSONClient(basePath = '') {
  const normalizedBase = normalizeBasePath(basePath);
  return async function jsonClient<T>(path = '', init?: RequestInit): Promise<T> {
    const suffix = normalizeSuffix(path);
    const finalPath = `${normalizedBase}${suffix}` || normalizedBase || suffix;
    return fetchJSON<T>(finalPath || '/', init);
  };
}
```

Note: `authHeaders` reads `VITE_API_ROLES` at call time (not module top) so `vi.stubEnv` in tests takes effect. `USER` stays module-level to preserve existing behavior.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/lib/api/__tests__/api.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Document the env**

Add to `apps/dashboard/.env.local.example` (append a line):

```
VITE_API_ROLES=admin
```

- [ ] **Step 6: Verify ASCII (TS only) + commit**

```bash
cd apps/dashboard && perl -ne 'exit 1 if /[^\x00-\x7F]/' src/lib/api/index.ts src/lib/api/__tests__/api.test.ts && echo OK
cd ../.. && git add apps/dashboard/src/lib/api/index.ts apps/dashboard/src/lib/api/__tests__/api.test.ts apps/dashboard/.env.local.example
TRACE=$(node -e "const b=require('crypto').randomBytes(16);const t=Date.now();b[0]=(t/2**40)&0xff;b[1]=(t/2**32)&0xff;b[2]=(t/2**24)&0xff;b[3]=(t/2**16)&0xff;b[4]=(t/2**8)&0xff;b[5]=t&0xff;b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');console.log(h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20))")
git commit -m "$(cat <<EOF
feat(dashboard): api client X-Roles header + error-body parsing

authHeaders sends X-Roles from VITE_API_ROLES (mirrors X-User); non-ok
responses now throw ApiError carrying status + backend code so admin
mutations and code-specific messages work.

Coding-Agent: claude-opus-4.7
Trace-Id: $TRACE
EOF
)"
```

---

### Task 2: taxonomy.ts -- version client fns + listTraits versionId

**Files:**
- Modify: `apps/dashboard/src/lib/taxonomy.ts`

- [ ] **Step 1: Add version types + client functions**

In `apps/dashboard/src/lib/taxonomy.ts`, after the `Ecosystem` type block (before the `listTraits` line), add:

```ts
export type VersionStatus = 'draft' | 'released' | 'retired';

export type TaxonomyVersion = {
  id: string;
  tag: string;
  status: VersionStatus;
  description?: string | null;
  releasedAt?: string | null;
  releasedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VersionCounts = { trait: number; biome: number; species: number; ecosystem: number };
```

- [ ] **Step 2: Change the `listTraits` line to thread `versionId`**

Replace this exact line:

```ts
export const listTraits = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Trait>>(`/traits?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
```

with:

```ts
export const listTraits = (q = '', page = 0, pageSize = 25, _sort = '', versionId = '') =>
  fetchJSON<Paged<Trait> & { _version?: string }>(
    `/traits?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}` +
      (versionId ? `&versionId=${encodeURIComponent(versionId)}` : ''),
  );
```

(`_sort` is accepted to match the `ListPage` fetcher signature `(q, page, pageSize, sort)`; the trait list is name-ordered server-side, so it is intentionally unused.)

- [ ] **Step 3: Add the version client functions**

At the end of `apps/dashboard/src/lib/taxonomy.ts`, append:

```ts
export const listTaxonomyVersions = (includeRetired = false) =>
  fetchJSON<{ versions: TaxonomyVersion[] }>(`/taxonomy/versions?includeRetired=${includeRetired ? 'true' : 'false'}`);

export const getTaxonomyVersion = (tag: string) =>
  fetchJSON<{ version: TaxonomyVersion; counts: VersionCounts }>(`/taxonomy/versions/${encodeURIComponent(tag)}`);

export const createTaxonomyVersion = (body: { tag: string; description?: string }) =>
  postJSON<{ tag: string; description?: string }, { version: TaxonomyVersion }>('/taxonomy/versions', body);

export const releaseTaxonomyVersion = (tag: string) =>
  postJSON<Record<string, never>, { version: TaxonomyVersion; counts: VersionCounts }>(
    `/taxonomy/versions/${encodeURIComponent(tag)}/release`,
    {},
  );

export const retireTaxonomyVersion = (tag: string) =>
  postJSON<Record<string, never>, { version: TaxonomyVersion }>(
    `/taxonomy/versions/${encodeURIComponent(tag)}/retire`,
    {},
  );

export const deleteTaxonomyVersion = (tag: string) => deleteJSON(`/taxonomy/versions/${encodeURIComponent(tag)}`);
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: no errors. (If `listAllTraits` calls `listTraits(q, page, localPageSize)` it still typechecks -- the new params are optional.)

- [ ] **Step 5: Verify ASCII + commit**

```bash
cd apps/dashboard && perl -ne 'exit 1 if /[^\x00-\x7F]/' src/lib/taxonomy.ts && echo OK
cd ../.. && git add apps/dashboard/src/lib/taxonomy.ts
TRACE=$(node -e "const b=require('crypto').randomBytes(16);const t=Date.now();b[0]=(t/2**40)&0xff;b[1]=(t/2**32)&0xff;b[2]=(t/2**24)&0xff;b[3]=(t/2**16)&0xff;b[4]=(t/2**8)&0xff;b[5]=t&0xff;b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');console.log(h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20))")
git commit -m "$(cat <<EOF
feat(dashboard): taxonomy version client fns + listTraits versionId

add list/get/create/release/retire/delete version wrappers + version
types; extend listTraits with an optional versionId query param.

Coding-Agent: claude-opus-4.7
Trace-Id: $TRACE
EOF
)"
```

---

### Task 3: i18n versions namespace + nav entry

**Files:**
- Create: `apps/dashboard/src/i18n/locales/it/versions.json`
- Modify: `apps/dashboard/src/i18n/index.ts`
- Modify: `apps/dashboard/src/i18n/locales/it/navigation.json`

- [ ] **Step 1: Create the locale file**

Create `apps/dashboard/src/i18n/locales/it/versions.json` (raw accents OK):

```json
{
  "versions": {
    "title": "Versioni tassonomia",
    "includeRetired": "Mostra ritirate",
    "columns": {
      "tag": "Tag",
      "status": "Stato",
      "releasedAt": "Rilasciata il",
      "description": "Descrizione",
      "actions": "Azioni"
    },
    "status": {
      "draft": "Bozza",
      "released": "Rilasciata",
      "retired": "Ritirata"
    },
    "actions": {
      "create": "Nuova versione",
      "release": "Rilascia",
      "retire": "Ritira",
      "delete": "Elimina",
      "details": "Dettagli"
    },
    "create": {
      "title": "Nuova versione",
      "tag": "Tag (semver, es. v1.2.0)",
      "description": "Descrizione",
      "submit": "Crea bozza",
      "invalidTag": "Il tag deve essere semver-like (es. v1.2.0)"
    },
    "detail": {
      "title": "Dettagli versione",
      "releasedBy": "Rilasciata da",
      "counts": "Conteggi snapshot",
      "trait": "Tratti",
      "biome": "Biomi",
      "species": "Specie",
      "ecosystem": "Ecosistemi"
    },
    "confirm": {
      "releaseTitle": "Rilasciare la versione?",
      "releaseBody": "Rilasciare {{tag}} congela uno snapshot immutabile dei master correnti. L'operazione non e reversibile.",
      "retireTitle": "Ritirare la versione?",
      "retireBody": "Ritirare {{tag}}. Lo snapshot resta leggibile ma la versione esce dalla lista predefinita.",
      "deleteTitle": "Eliminare la bozza?",
      "deleteBody": "Eliminare la bozza {{tag}}. Solo le bozze possono essere eliminate.",
      "confirm": "Conferma",
      "cancel": "Annulla"
    },
    "feedback": {
      "created": "Bozza creata",
      "released": "Versione rilasciata",
      "retired": "Versione ritirata",
      "deleted": "Bozza eliminata"
    },
    "errors": {
      "DRAFT_EXISTS": "Esiste gia una bozza: rilasciala o eliminala prima",
      "TAG_EXISTS": "Esiste gia una versione con questo tag",
      "INVALID_STATE": "Operazione non valida per lo stato attuale della versione",
      "VALIDATION_ERROR": "Dati non validi",
      "FORBIDDEN": "Permessi insufficienti: imposta VITE_API_ROLES=admin",
      "generic": "Operazione non riuscita"
    },
    "picker": {
      "label": "Versione",
      "live": "Live (corrente)",
      "readOnlyBanner": "Stai visualizzando lo snapshot {{tag}} -- sola lettura"
    },
    "empty": "Nessuna versione presente"
  }
}
```

- [ ] **Step 2: Register the namespace**

In `apps/dashboard/src/i18n/index.ts`:

(a) add the import after the `audit` import (line 14):
```ts
import versions from './locales/it/versions.json';
```
(b) add `versions,` to the `resources.it` object (after `audit,`):
```ts
    audit,
    versions,
```
(c) add `'versions'` to the `ns` array:
```ts
  ns: ['common', 'navigation', 'dashboard', 'list', 'filters', 'table', 'records', 'export', 'taxonomy', 'audit', 'versions'],
```

- [ ] **Step 3: Add the nav label key**

In `apps/dashboard/src/i18n/locales/it/navigation.json`, add a `"taxonomyVersions"` key alongside the existing taxonomy nav keys (e.g. near `"traits"`). Read the file first to match its structure; add:
```json
"taxonomyVersions": "Versioni"
```
(at the same nesting level as `"traits"`, `"biomes"`, etc.)

- [ ] **Step 4: Add the sidebar nav entry**

In `apps/dashboard/src/layout/Sidebar.tsx`:
(a) add an icon import after the existing icon imports (line 13):
```ts
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
```
(b) add an item to the `sections.taxonomy` group's `items` array (after the `ecosystems` entry):
```ts
      { to: '/taxonomy-versions', key: 'taxonomyVersions', icon: HistoryRoundedIcon },
```

- [ ] **Step 5: Typecheck + commit**

Run: `cd apps/dashboard && npx tsc --noEmit` (expected: no errors).

```bash
cd /c/dev/Game-Database && git add apps/dashboard/src/i18n/locales/it/versions.json apps/dashboard/src/i18n/index.ts apps/dashboard/src/i18n/locales/it/navigation.json apps/dashboard/src/layout/Sidebar.tsx
TRACE=$(node -e "const b=require('crypto').randomBytes(16);const t=Date.now();b[0]=(t/2**40)&0xff;b[1]=(t/2**32)&0xff;b[2]=(t/2**24)&0xff;b[3]=(t/2**16)&0xff;b[4]=(t/2**8)&0xff;b[5]=t&0xff;b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');console.log(h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20))")
git commit -m "$(cat <<EOF
feat(dashboard): versions i18n namespace + sidebar nav entry

add versions.json locale + register namespace; add taxonomyVersions nav
label and a sidebar entry to /taxonomy-versions.

Coding-Agent: claude-opus-4.7
Trace-Id: $TRACE
EOF
)"
```

---

### Task 4: VersionStatusChip + VersionTable

**Files:**
- Create: `apps/dashboard/src/features/versions/components/VersionStatusChip.tsx`
- Create: `apps/dashboard/src/features/versions/components/VersionTable.tsx`
- Create: `apps/dashboard/src/features/versions/components/__tests__/VersionTable.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/features/versions/components/__tests__/VersionTable.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../testUtils/renderWithProviders';
import VersionTable from '../VersionTable';
import type { TaxonomyVersion } from '../../../../lib/taxonomy';

const draft: TaxonomyVersion = { id: '1', tag: 'v2.0.0', status: 'draft', description: null, releasedAt: null, releasedBy: null, createdAt: '', updatedAt: '' };
const released: TaxonomyVersion = { id: '2', tag: 'v1.0.0', status: 'released', description: 'base', releasedAt: '2026-01-01T00:00:00.000Z', releasedBy: 'admin', createdAt: '', updatedAt: '' };
const retired: TaxonomyVersion = { id: '3', tag: 'v0.9.0', status: 'retired', description: null, releasedAt: '2025-12-01T00:00:00.000Z', releasedBy: 'admin', createdAt: '', updatedAt: '' };

function setup(versions: TaxonomyVersion[]) {
  const handlers = { onRelease: vi.fn(), onRetire: vi.fn(), onDelete: vi.fn(), onDetails: vi.fn() };
  renderWithProviders(<VersionTable versions={versions} busy={false} {...handlers} />);
  return handlers;
}

describe('VersionTable', () => {
  it('shows Release + Delete for a draft and fires the handlers', async () => {
    const user = userEvent.setup();
    const h = setup([draft]);
    await user.click(screen.getByRole('button', { name: /rilascia/i }));
    expect(h.onRelease).toHaveBeenCalledWith(draft);
    await user.click(screen.getByRole('button', { name: /elimina/i }));
    expect(h.onDelete).toHaveBeenCalledWith(draft);
    expect(screen.queryByRole('button', { name: /ritira/i })).toBeNull();
  });

  it('shows Retire (not Release/Delete) for a released version', () => {
    setup([released]);
    expect(screen.getByRole('button', { name: /ritira/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /rilascia/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /elimina/i })).toBeNull();
  });

  it('shows only Details for a retired version', () => {
    const h = setup([retired]);
    expect(screen.queryByRole('button', { name: /ritira/i })).toBeNull();
    expect(screen.getByRole('button', { name: /dettagli/i })).toBeTruthy();
    void h;
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/features/versions/components/__tests__/VersionTable.test.tsx`
Expected: FAIL -- module `../VersionTable` not found.

- [ ] **Step 3: Implement the chip**

Create `apps/dashboard/src/features/versions/components/VersionStatusChip.tsx`:

```tsx
import { Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { VersionStatus } from '../../../lib/taxonomy';

const COLOR: Record<VersionStatus, 'default' | 'success' | 'warning'> = {
  draft: 'warning',
  released: 'success',
  retired: 'default',
};

export default function VersionStatusChip({ status }: { status: VersionStatus }) {
  const { t } = useTranslation('versions');
  return <Chip size="small" color={COLOR[status]} label={t(`versions.status.${status}`)} />;
}
```

- [ ] **Step 4: Implement the table**

Create `apps/dashboard/src/features/versions/components/VersionTable.tsx`:

```tsx
import { Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { TaxonomyVersion } from '../../../lib/taxonomy';
import VersionStatusChip from './VersionStatusChip';

type Props = {
  versions: TaxonomyVersion[];
  busy: boolean;
  onRelease: (v: TaxonomyVersion) => void;
  onRetire: (v: TaxonomyVersion) => void;
  onDelete: (v: TaxonomyVersion) => void;
  onDetails: (v: TaxonomyVersion) => void;
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
}

export default function VersionTable({ versions, busy, onRelease, onRetire, onDelete, onDetails }: Props) {
  const { t } = useTranslation('versions');
  if (versions.length === 0) {
    return <Typography color="text.secondary">{t('versions.empty')}</Typography>;
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('versions.columns.tag')}</TableCell>
          <TableCell>{t('versions.columns.status')}</TableCell>
          <TableCell>{t('versions.columns.releasedAt')}</TableCell>
          <TableCell>{t('versions.columns.description')}</TableCell>
          <TableCell align="right">{t('versions.columns.actions')}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {versions.map((v) => (
          <TableRow key={v.id}>
            <TableCell>{v.tag}</TableCell>
            <TableCell><VersionStatusChip status={v.status} /></TableCell>
            <TableCell>{formatDate(v.releasedAt)}</TableCell>
            <TableCell>{v.description ?? ''}</TableCell>
            <TableCell align="right">
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                {v.status === 'draft' && (
                  <Button size="small" variant="contained" disabled={busy} onClick={() => onRelease(v)}>
                    {t('versions.actions.release')}
                  </Button>
                )}
                {v.status === 'released' && (
                  <Button size="small" variant="outlined" disabled={busy} onClick={() => onRetire(v)}>
                    {t('versions.actions.retire')}
                  </Button>
                )}
                <Button size="small" variant="text" disabled={busy} onClick={() => onDetails(v)}>
                  {t('versions.actions.details')}
                </Button>
                {v.status === 'draft' && (
                  <Button size="small" color="error" variant="text" disabled={busy} onClick={() => onDelete(v)}>
                    {t('versions.actions.delete')}
                  </Button>
                )}
              </Stack>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/features/versions/components/__tests__/VersionTable.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Verify ASCII + commit**

```bash
cd apps/dashboard && perl -ne 'exit 1 if /[^\x00-\x7F]/' src/features/versions/components/VersionStatusChip.tsx src/features/versions/components/VersionTable.tsx src/features/versions/components/__tests__/VersionTable.test.tsx && echo OK
cd ../.. && git add apps/dashboard/src/features/versions/components/VersionStatusChip.tsx apps/dashboard/src/features/versions/components/VersionTable.tsx apps/dashboard/src/features/versions/components/__tests__/VersionTable.test.tsx
TRACE=$(node -e "const b=require('crypto').randomBytes(16);const t=Date.now();b[0]=(t/2**40)&0xff;b[1]=(t/2**32)&0xff;b[2]=(t/2**24)&0xff;b[3]=(t/2**16)&0xff;b[4]=(t/2**8)&0xff;b[5]=t&0xff;b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');console.log(h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20))")
git commit -m "$(cat <<EOF
feat(dashboard): version status chip + lifecycle table

bespoke table with status-conditional row actions (release on draft,
retire on released, delete on draft, details always).

Coding-Agent: claude-opus-4.7
Trace-Id: $TRACE
EOF
)"
```

---

### Task 5: CreateVersionDialog

**Files:**
- Create: `apps/dashboard/src/features/versions/components/CreateVersionDialog.tsx`
- Create: `apps/dashboard/src/features/versions/components/__tests__/CreateVersionDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/features/versions/components/__tests__/CreateVersionDialog.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../testUtils/renderWithProviders';
import CreateVersionDialog from '../CreateVersionDialog';

describe('CreateVersionDialog', () => {
  it('rejects a non-semver tag and does not submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {});
    renderWithProviders(<CreateVersionDialog open onClose={() => {}} onSubmit={onSubmit} submitting={false} />);
    await user.type(screen.getByLabelText(/tag/i), 'not-semver');
    await user.click(screen.getByRole('button', { name: /crea bozza/i }));
    expect(await screen.findByText(/semver/i)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits tag + description for a valid semver tag', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {});
    renderWithProviders(<CreateVersionDialog open onClose={() => {}} onSubmit={onSubmit} submitting={false} />);
    await user.type(screen.getByLabelText(/tag/i), 'v1.2.0');
    await user.type(screen.getByLabelText(/descrizione/i), 'note');
    await user.click(screen.getByRole('button', { name: /crea bozza/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ tag: 'v1.2.0', description: 'note' }));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/features/versions/components/__tests__/CreateVersionDialog.test.tsx`
Expected: FAIL -- module not found.

- [ ] **Step 3: Implement**

Create `apps/dashboard/src/features/versions/components/CreateVersionDialog.tsx`:

```tsx
import { useEffect } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

const SEMVER_RE = /^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

type FormValues = { tag: string; description: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: { tag: string; description?: string }) => Promise<void>;
  submitting: boolean;
};

export default function CreateVersionDialog({ open, onClose, onSubmit, submitting }: Props) {
  const { t } = useTranslation('versions');
  const { control, handleSubmit, reset, formState } = useForm<FormValues>({ defaultValues: { tag: '', description: '' } });

  useEffect(() => {
    if (open) reset({ tag: '', description: '' });
  }, [open, reset]);

  const submit = handleSubmit(async (values) => {
    const description = values.description.trim();
    await onSubmit({ tag: values.tag.trim(), ...(description ? { description } : {}) });
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('versions.create.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Controller
            name="tag"
            control={control}
            rules={{ validate: (v) => SEMVER_RE.test(v.trim()) || t('versions.create.invalidTag') }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label={t('versions.create.tag')}
                fullWidth
                autoFocus
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message}
                disabled={submitting}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField {...field} label={t('versions.create.description')} fullWidth multiline minRows={2} disabled={submitting} />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>{t('versions.confirm.cancel')}</Button>
        <Button variant="contained" onClick={submit} disabled={submitting || formState.isSubmitting}>
          {t('versions.create.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/features/versions/components/__tests__/CreateVersionDialog.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify ASCII + commit**

```bash
cd apps/dashboard && perl -ne 'exit 1 if /[^\x00-\x7F]/' src/features/versions/components/CreateVersionDialog.tsx src/features/versions/components/__tests__/CreateVersionDialog.test.tsx && echo OK
cd ../.. && git add apps/dashboard/src/features/versions/components/CreateVersionDialog.tsx apps/dashboard/src/features/versions/components/__tests__/CreateVersionDialog.test.tsx
TRACE=$(node -e "const b=require('crypto').randomBytes(16);const t=Date.now();b[0]=(t/2**40)&0xff;b[1]=(t/2**32)&0xff;b[2]=(t/2**24)&0xff;b[3]=(t/2**16)&0xff;b[4]=(t/2**8)&0xff;b[5]=t&0xff;b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');console.log(h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20))")
git commit -m "$(cat <<EOF
feat(dashboard): create-version dialog with semver validation

react-hook-form dialog; client semver check mirrors backend SEMVER_RE;
emits { tag, description? }.

Coding-Agent: claude-opus-4.7
Trace-Id: $TRACE
EOF
)"
```

---

### Task 6: VersionDetailDialog

**Files:**
- Create: `apps/dashboard/src/features/versions/components/VersionDetailDialog.tsx`
- Create: `apps/dashboard/src/features/versions/components/__tests__/VersionDetailDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/features/versions/components/__tests__/VersionDetailDialog.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../testUtils/renderWithProviders';
import VersionDetailDialog from '../VersionDetailDialog';

const getTaxonomyVersion = vi.hoisted(() => vi.fn());
vi.mock('../../../../lib/taxonomy', () => ({ getTaxonomyVersion }));

describe('VersionDetailDialog', () => {
  it('fetches the version and renders the counts', async () => {
    getTaxonomyVersion.mockResolvedValue({
      version: { id: '2', tag: 'v1.0.0', status: 'released', description: 'base', releasedAt: '2026-01-01T00:00:00.000Z', releasedBy: 'admin', createdAt: '', updatedAt: '' },
      counts: { trait: 392, biome: 10, species: 50, ecosystem: 5 },
    });
    renderWithProviders(<VersionDetailDialog open tag="v1.0.0" onClose={() => {}} />);
    expect(await screen.findByText('392')).toBeTruthy();
    expect(getTaxonomyVersion).toHaveBeenCalledWith('v1.0.0');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/features/versions/components/__tests__/VersionDetailDialog.test.tsx`
Expected: FAIL -- module not found.

- [ ] **Step 3: Implement**

Create `apps/dashboard/src/features/versions/components/VersionDetailDialog.tsx`:

```tsx
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTaxonomyVersion } from '../../../lib/taxonomy';

type Props = { open: boolean; tag: string | null; onClose: () => void };

export default function VersionDetailDialog({ open, tag, onClose }: Props) {
  const { t } = useTranslation('versions');
  const { data } = useQuery({
    queryKey: ['taxonomy-version', tag],
    queryFn: () => getTaxonomyVersion(tag as string),
    enabled: open && Boolean(tag),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('versions.detail.title')}</DialogTitle>
      <DialogContent>
        {data && (
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography><strong>{t('versions.columns.tag')}:</strong> {data.version.tag}</Typography>
            <Typography><strong>{t('versions.columns.status')}:</strong> {t(`versions.status.${data.version.status}`)}</Typography>
            <Typography><strong>{t('versions.detail.releasedBy')}:</strong> {data.version.releasedBy ?? '-'}</Typography>
            <Typography><strong>{t('versions.columns.description')}:</strong> {data.version.description ?? ''}</Typography>
            <Typography variant="subtitle2" sx={{ mt: 1 }}>{t('versions.detail.counts')}</Typography>
            <Typography>{t('versions.detail.trait')}: {data.counts.trait}</Typography>
            <Typography>{t('versions.detail.biome')}: {data.counts.biome}</Typography>
            <Typography>{t('versions.detail.species')}: {data.counts.species}</Typography>
            <Typography>{t('versions.detail.ecosystem')}: {data.counts.ecosystem}</Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('versions.confirm.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/features/versions/components/__tests__/VersionDetailDialog.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Verify ASCII + commit**

```bash
cd apps/dashboard && perl -ne 'exit 1 if /[^\x00-\x7F]/' src/features/versions/components/VersionDetailDialog.tsx src/features/versions/components/__tests__/VersionDetailDialog.test.tsx && echo OK
cd ../.. && git add apps/dashboard/src/features/versions/components/VersionDetailDialog.tsx apps/dashboard/src/features/versions/components/__tests__/VersionDetailDialog.test.tsx
TRACE=$(node -e "const b=require('crypto').randomBytes(16);const t=Date.now();b[0]=(t/2**40)&0xff;b[1]=(t/2**32)&0xff;b[2]=(t/2**24)&0xff;b[3]=(t/2**16)&0xff;b[4]=(t/2**8)&0xff;b[5]=t&0xff;b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');console.log(h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20))")
git commit -m "$(cat <<EOF
feat(dashboard): version detail dialog with snapshot counts

read-only dialog fetching GET /taxonomy/versions/:tag for per-entity
snapshot counts.

Coding-Agent: claude-opus-4.7
Trace-Id: $TRACE
EOF
)"
```

---

### Task 7: TaxonomyVersionPage + route

**Files:**
- Create: `apps/dashboard/src/features/versions/pages/TaxonomyVersionPage.tsx`
- Create: `apps/dashboard/src/features/versions/pages/__tests__/TaxonomyVersionPage.test.tsx`
- Modify: `apps/dashboard/src/routes.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/features/versions/pages/__tests__/TaxonomyVersionPage.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../testUtils/renderWithProviders';
import TaxonomyVersionPage from '../TaxonomyVersionPage';

const mocks = vi.hoisted(() => ({
  listTaxonomyVersions: vi.fn(),
  createTaxonomyVersion: vi.fn(),
  releaseTaxonomyVersion: vi.fn(),
  retireTaxonomyVersion: vi.fn(),
  deleteTaxonomyVersion: vi.fn(),
  getTaxonomyVersion: vi.fn(),
}));
vi.mock('../../../../lib/taxonomy', () => mocks);

const draft = { id: '1', tag: 'v2.0.0', status: 'draft', description: null, releasedAt: null, releasedBy: null, createdAt: '', updatedAt: '' };

describe('TaxonomyVersionPage', () => {
  it('lists versions and creates a draft', async () => {
    const user = userEvent.setup();
    mocks.listTaxonomyVersions.mockResolvedValue({ versions: [] });
    mocks.createTaxonomyVersion.mockResolvedValue({ version: draft });
    renderWithProviders(<TaxonomyVersionPage />);
    await user.click(await screen.findByRole('button', { name: /nuova versione/i }));
    await user.type(screen.getByLabelText(/tag/i), 'v2.0.0');
    await user.click(screen.getByRole('button', { name: /crea bozza/i }));
    await waitFor(() => expect(mocks.createTaxonomyVersion).toHaveBeenCalledWith({ tag: 'v2.0.0' }));
  });

  it('releases a draft through the confirm dialog', async () => {
    const user = userEvent.setup();
    mocks.listTaxonomyVersions.mockResolvedValue({ versions: [draft] });
    mocks.releaseTaxonomyVersion.mockResolvedValue({ version: { ...draft, status: 'released' }, counts: { trait: 0, biome: 0, species: 0, ecosystem: 0 } });
    renderWithProviders(<TaxonomyVersionPage />);
    await user.click(await screen.findByRole('button', { name: /rilascia/i }));
    // confirm dialog
    await user.click(await screen.findByRole('button', { name: /^conferma$/i }));
    await waitFor(() => expect(mocks.releaseTaxonomyVersion).toHaveBeenCalledWith('v2.0.0'));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/features/versions/pages/__tests__/TaxonomyVersionPage.test.tsx`
Expected: FAIL -- module not found.

- [ ] **Step 3: Implement the page**

Create `apps/dashboard/src/features/versions/pages/TaxonomyVersionPage.tsx`:

```tsx
import { useCallback, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Paper, Stack, Switch, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../lib/api';
import {
  createTaxonomyVersion, deleteTaxonomyVersion, listTaxonomyVersions,
  releaseTaxonomyVersion, retireTaxonomyVersion, type TaxonomyVersion,
} from '../../../lib/taxonomy';
import { useSnackbar } from '../../../components/SnackbarProvider';
import VersionTable from '../components/VersionTable';
import CreateVersionDialog from '../components/CreateVersionDialog';
import VersionDetailDialog from '../components/VersionDetailDialog';

type Confirm = { kind: 'release' | 'retire' | 'delete'; version: TaxonomyVersion } | null;

export default function TaxonomyVersionPage() {
  const { t } = useTranslation('versions');
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [includeRetired, setIncludeRetired] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTag, setDetailTag] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const { data } = useQuery({
    queryKey: ['taxonomy-versions', { includeRetired }],
    queryFn: () => listTaxonomyVersions(includeRetired),
  });

  const errorMessage = useCallback(
    (err: unknown) => {
      const code = err instanceof ApiError ? err.code : undefined;
      const key = code ? `versions.errors.${code}` : 'versions.errors.generic';
      const msg = t(key);
      return msg === key ? t('versions.errors.generic') : msg;
    },
    [t],
  );

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['taxonomy-versions'], exact: false }),
    [queryClient],
  );

  const createMut = useMutation({
    mutationFn: (body: { tag: string; description?: string }) => createTaxonomyVersion(body),
    onSuccess: async () => { setCreateOpen(false); enqueueSnackbar(t('versions.feedback.created'), { variant: 'success' }); await invalidate(); },
    onError: (err) => enqueueSnackbar(errorMessage(err), { variant: 'error' }),
  });

  const releaseMut = useMutation({
    mutationFn: (tag: string) => releaseTaxonomyVersion(tag),
    onSuccess: async () => { setConfirm(null); enqueueSnackbar(t('versions.feedback.released'), { variant: 'success' }); await invalidate(); },
    onError: (err) => enqueueSnackbar(errorMessage(err), { variant: 'error' }),
  });

  const retireMut = useMutation({
    mutationFn: (tag: string) => retireTaxonomyVersion(tag),
    onSuccess: async () => { setConfirm(null); enqueueSnackbar(t('versions.feedback.retired'), { variant: 'success' }); await invalidate(); },
    onError: (err) => enqueueSnackbar(errorMessage(err), { variant: 'error' }),
  });

  const deleteMut = useMutation({
    mutationFn: (tag: string) => deleteTaxonomyVersion(tag),
    onSuccess: async () => { setConfirm(null); enqueueSnackbar(t('versions.feedback.deleted'), { variant: 'success' }); await invalidate(); },
    onError: (err) => enqueueSnackbar(errorMessage(err), { variant: 'error' }),
  });

  const busy = createMut.isPending || releaseMut.isPending || retireMut.isPending || deleteMut.isPending;

  const onConfirm = useCallback(() => {
    if (!confirm) return;
    if (confirm.kind === 'release') releaseMut.mutate(confirm.version.tag);
    else if (confirm.kind === 'retire') retireMut.mutate(confirm.version.tag);
    else deleteMut.mutate(confirm.version.tag);
  }, [confirm, releaseMut, retireMut, deleteMut]);

  const confirmText = confirm
    ? { title: t(`versions.confirm.${confirm.kind}Title`), body: t(`versions.confirm.${confirm.kind}Body`, { tag: confirm.version.tag }) }
    : { title: '', body: '' };

  return (
    <Paper sx={(theme) => ({ padding: theme.layout.cardPadding, boxShadow: theme.customShadows.card })}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} sx={(theme) => ({ mb: theme.spacing(4) })}>
        <Typography variant="h6">{t('versions.title')}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <FormControlLabel
          control={<Switch checked={includeRetired} onChange={(e) => setIncludeRetired(e.target.checked)} />}
          label={t('versions.includeRetired')}
        />
        <Button variant="contained" onClick={() => setCreateOpen(true)} disabled={busy}>
          {t('versions.actions.create')}
        </Button>
      </Stack>

      <VersionTable
        versions={data?.versions ?? []}
        busy={busy}
        onRelease={(v) => setConfirm({ kind: 'release', version: v })}
        onRetire={(v) => setConfirm({ kind: 'retire', version: v })}
        onDelete={(v) => setConfirm({ kind: 'delete', version: v })}
        onDetails={(v) => setDetailTag(v.tag)}
      />

      <CreateVersionDialog open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={async (body) => { await createMut.mutateAsync(body); }} submitting={createMut.isPending} />
      <VersionDetailDialog open={Boolean(detailTag)} tag={detailTag} onClose={() => setDetailTag(null)} />

      <Dialog open={Boolean(confirm)} onClose={() => !busy && setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle>{confirmText.title}</DialogTitle>
        <DialogContent><Typography>{confirmText.body}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} disabled={busy}>{t('versions.confirm.cancel')}</Button>
          <Button variant="contained" color={confirm?.kind === 'delete' ? 'error' : 'primary'} onClick={onConfirm} disabled={busy}>
            {t('versions.confirm.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
```

- [ ] **Step 4: Register the route**

In `apps/dashboard/src/routes.tsx`:
(a) import after the other taxonomy page imports (after line 20):
```tsx
import TaxonomyVersionPage from './features/versions/pages/TaxonomyVersionPage';
```
(b) add a child route after the `ecosystems/:ecosystemId` route:
```tsx
    { path: 'taxonomy-versions', element: <TaxonomyVersionPage /> },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/features/versions/pages/__tests__/TaxonomyVersionPage.test.tsx`
Expected: PASS (2 tests). The create test asserts `createTaxonomyVersion` called with `{ tag: 'v2.0.0' }` (no description -> omitted).

- [ ] **Step 6: Verify ASCII + commit**

```bash
cd apps/dashboard && perl -ne 'exit 1 if /[^\x00-\x7F]/' src/features/versions/pages/TaxonomyVersionPage.tsx src/features/versions/pages/__tests__/TaxonomyVersionPage.test.tsx src/routes.tsx && echo OK
cd ../.. && git add apps/dashboard/src/features/versions/pages/TaxonomyVersionPage.tsx apps/dashboard/src/features/versions/pages/__tests__/TaxonomyVersionPage.test.tsx apps/dashboard/src/routes.tsx
TRACE=$(node -e "const b=require('crypto').randomBytes(16);const t=Date.now();b[0]=(t/2**40)&0xff;b[1]=(t/2**32)&0xff;b[2]=(t/2**24)&0xff;b[3]=(t/2**16)&0xff;b[4]=(t/2**8)&0xff;b[5]=t&0xff;b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');console.log(h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20))")
git commit -m "$(cat <<EOF
feat(dashboard): taxonomy version-management page + route

page wires the version table, create/detail dialogs, and release/retire/
delete mutations behind a confirm dialog; maps backend error codes to
localized snackbars. registers /taxonomy-versions.

Coding-Agent: claude-opus-4.7
Trace-Id: $TRACE
EOF
)"
```

---

### Task 8: VersionPicker + trait-list snapshot integration

**Files:**
- Create: `apps/dashboard/src/features/taxonomies/components/VersionPicker.tsx`
- Modify: `apps/dashboard/src/features/taxonomies/pages/TraitListPage.tsx`
- Create: `apps/dashboard/src/features/taxonomies/pages/__tests__/TraitListVersion.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/features/taxonomies/pages/__tests__/TraitListVersion.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, createMemoryRouter } from '../../../../testUtils/renderWithProviders';
import TraitListPage from '../TraitListPage';

const mocks = vi.hoisted(() => ({
  listTraits: vi.fn(),
  createTrait: vi.fn(),
  updateTrait: vi.fn(),
  deleteTrait: vi.fn(),
  listTaxonomyVersions: vi.fn(),
}));
vi.mock('../../../../lib/taxonomy', () => mocks);

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/traits', element: <TraitListPage /> }], { initialEntries: [path] });
  return renderWithProviders(<div />, { router });
}

describe('TraitListPage version picker', () => {
  it('passes versionId to listTraits and hides create when a version is active', async () => {
    mocks.listTaxonomyVersions.mockResolvedValue({ versions: [{ id: '2', tag: 'v1.0.0', status: 'released', description: null, releasedAt: '2026-01-01T00:00:00.000Z', releasedBy: 'a', createdAt: '', updatedAt: '' }] });
    mocks.listTraits.mockResolvedValue({ items: [], page: 0, pageSize: 20, total: 0, _version: 'v1.0.0' });
    renderAt('/traits?versionId=v1.0.0');
    await waitFor(() => expect(mocks.listTraits).toHaveBeenCalledWith('', 0, 20, '', 'v1.0.0'));
    expect(screen.queryByRole('button', { name: /nuovo trait/i })).toBeNull();
    expect(screen.getByText(/sola lettura/i)).toBeTruthy();
  });

  it('keeps the live path (no versionId) and shows create', async () => {
    mocks.listTaxonomyVersions.mockResolvedValue({ versions: [] });
    mocks.listTraits.mockResolvedValue({ items: [], page: 0, pageSize: 20, total: 0 });
    renderAt('/traits');
    await waitFor(() => expect(mocks.listTraits).toHaveBeenCalledWith('', 0, 20, ''));
    expect(screen.getByRole('button', { name: /nuovo trait/i })).toBeTruthy();
  });
});
```

Note: the live call asserts 4 args `('', 0, 20, '')` because `ListPage` calls `fetcher(query, page, pageSize, sort)`; the versioned wrapper appends the 5th.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/features/taxonomies/pages/__tests__/TraitListVersion.test.tsx`
Expected: FAIL -- `VersionPicker` not found / `listTaxonomyVersions` not mocked yet referenced, and the create button still shows.

- [ ] **Step 3: Implement VersionPicker**

Create `apps/dashboard/src/features/taxonomies/components/VersionPicker.tsx`:

```tsx
import { MenuItem, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listTaxonomyVersions } from '../../../lib/taxonomy';

type Props = { value: string; onChange: (tag: string) => void };

export default function VersionPicker({ value, onChange }: Props) {
  const { t } = useTranslation('versions');
  const { data } = useQuery({
    queryKey: ['taxonomy-versions', 'picker'],
    queryFn: () => listTaxonomyVersions(true),
  });
  const options = (data?.versions ?? []).filter((v) => v.status !== 'draft');
  return (
    <TextField
      select
      size="small"
      label={t('versions.picker.label')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ minWidth: 200 }}
    >
      <MenuItem value="">{t('versions.picker.live')}</MenuItem>
      {options.map((v) => (
        <MenuItem key={v.id} value={v.tag}>{v.tag}</MenuItem>
      ))}
    </TextField>
  );
}
```

- [ ] **Step 4: Wire it into TraitListPage**

In `apps/dashboard/src/features/taxonomies/pages/TraitListPage.tsx`:

(a) add imports near the top (after the existing imports):
```tsx
import { Alert, Box } from '@mui/material';
import { useTranslation as useTranslationBase } from 'react-i18next';
import VersionPicker from '../components/VersionPicker';
```
(Reuse the existing `useTranslation('taxonomy')`; add `const { t: tv } = useTranslationBase('versions');` inside the component for the picker/banner strings.)

(b) inside `TraitListPage`, after `const initialSort = ...`, add:
```tsx
  const versionId = searchParams.get('versionId') ?? '';
```

(c) add the `tv` translator inside the component body (after the existing `const { t } = useTranslation('taxonomy');`):
```tsx
  const { t: tv } = useTranslationBase('versions');
```

(d) define a version-aware fetcher and a picker handler (place above the `return`):
```tsx
  const fetchTraits = useCallback(
    (q: string, page = 0, pageSize = DEFAULT_PAGE_SIZE, sort = '') => listTraits(q, page, pageSize, sort, versionId),
    [versionId],
  );

  const handlePickVersion = useCallback(
    (tag: string) => {
      const next = new URLSearchParams(searchParams);
      if (tag) next.set('versionId', tag);
      else next.delete('versionId');
      next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const readOnly = Boolean(versionId);
```

(e) in `handleStateChange`, preserve `versionId` so paging/search does not drop it. Replace the `const nextParams = new URLSearchParams();` line with:
```tsx
      const nextParams = new URLSearchParams();
      if (versionId) nextParams.set('versionId', versionId);
```

(f) change the `fetcher` prop and gate the CRUD configs on `!readOnly`. Replace the `<ListPage ...>` opening + `fetcher` + the three configs as follows -- wrap the existing return in a fragment with the picker + banner, set `fetcher={fetchTraits}`, and pass `createConfig`/`editConfig`/`deleteConfig`/`bulkConfig` only when `!readOnly`:

```tsx
  return (
    <>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <VersionPicker value={versionId} onChange={handlePickVersion} />
        {readOnly && (
          <Alert severity="info" sx={{ flexGrow: 1 }}>
            {tv('versions.picker.readOnlyBanner', { tag: versionId })}
          </Alert>
        )}
      </Stack>
      <ListPage<Trait, TraitFormValues>
        title={t('traits.title')}
        columns={columns}
        fetcher={fetchTraits}
        queryKeyBase={['traits', versionId || 'live']}
        initialQuery={initialQuery}
        initialPage={initialPage}
        initialPageSize={initialPageSize}
        initialSort={initialSort}
        autoloadOnMount
        onStateChange={handleStateChange}
        createConfig={readOnly ? undefined : { /* ...existing createConfig unchanged... */ }}
        editConfig={readOnly ? undefined : { /* ...existing editConfig unchanged... */ }}
        deleteConfig={readOnly ? undefined : { /* ...existing deleteConfig unchanged... */ }}
        bulkConfig={readOnly ? undefined : { enableDelete: true, enableEdit: true }}
        getItemLabel={(item) => item.name ?? item.slug ?? ''}
      />
    </>
  );
```

IMPORTANT: keep the existing `createConfig`/`editConfig`/`deleteConfig` object bodies exactly as they are today -- only wrap each in `readOnly ? undefined : { ...same object... }`. Add `Stack` to the MUI import if not already imported (it is imported via `@mui/material`? -- check; the current file imports only `Link as MuiLink` from `@mui/material`, so add `Stack` there: `import { Link as MuiLink, Stack } from '@mui/material';`, and `Alert, Box` per (a). Consolidate into one import line to avoid duplicates.)

The `queryKeyBase={['traits', versionId || 'live']}` ensures the live and versioned caches do not collide.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/features/taxonomies/pages/__tests__/TraitListVersion.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the existing trait page test (regression)**

Run: `cd apps/dashboard && npx vitest run src/features/taxonomies/pages/__tests__/TraitListPage.test.tsx`
Expected: PASS (unchanged -- the live path still renders create/edit/delete because no `versionId` is set).

- [ ] **Step 7: Verify ASCII + commit**

```bash
cd apps/dashboard && perl -ne 'exit 1 if /[^\x00-\x7F]/' src/features/taxonomies/components/VersionPicker.tsx src/features/taxonomies/pages/TraitListPage.tsx src/features/taxonomies/pages/__tests__/TraitListVersion.test.tsx && echo OK
cd ../.. && git add apps/dashboard/src/features/taxonomies/components/VersionPicker.tsx apps/dashboard/src/features/taxonomies/pages/TraitListPage.tsx apps/dashboard/src/features/taxonomies/pages/__tests__/TraitListVersion.test.tsx
TRACE=$(node -e "const b=require('crypto').randomBytes(16);const t=Date.now();b[0]=(t/2**40)&0xff;b[1]=(t/2**32)&0xff;b[2]=(t/2**24)&0xff;b[3]=(t/2**16)&0xff;b[4]=(t/2**8)&0xff;b[5]=t&0xff;b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');console.log(h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20))")
git commit -m "$(cat <<EOF
feat(dashboard): version picker + read-only snapshot view on traits

picker sets ?versionId=; trait list threads it into listTraits, shows a
read-only banner, and hides create/edit/delete/bulk while a snapshot is
active. separate query cache key for live vs versioned.

Coding-Agent: claude-opus-4.7
Trace-Id: $TRACE
EOF
)"
```

---

### Task 9: Final verification + PR

**Files:** none (verification + PR).

- [ ] **Step 1: Full dashboard suite green**

Run: `cd apps/dashboard && npm test`
Expected: PASS (all suites, including the new version + trait-version tests).

- [ ] **Step 2: Typecheck + lint**

Run: `cd apps/dashboard && npx tsc --noEmit && npm run lint`
Expected: no type errors; lint clean (fix any issues the lint surfaces, re-stage, amend into the relevant task is not allowed -- make a new fixup commit).

- [ ] **Step 3: Manual browser smoke (UI correctness)**

Backend on 3333 + Postgres on 5433 must be up (`docker compose up -d` at repo root; `cd server && npm run dev`). Set `apps/dashboard/.env.local` `VITE_API_ROLES=admin`. Then `cd apps/dashboard && npm run dev` and in a browser:
- Open `/taxonomy-versions`: the seeded `v1.0.0` (released) is listed; toggle "Mostra ritirate".
- Create a draft (e.g. `v1.1.0`): appears as Bozza; Release it (confirm dialog) -> becomes Rilasciata; open Details -> counts shown.
- Open `/traits`, pick `v1.0.0` in the version picker: the read-only banner shows, create/edit/delete disappear, rows reflect the snapshot; switch back to Live.
- If mutations 403: confirm `VITE_API_ROLES=admin` is set and the dev server was restarted.

Document the result (what was exercised, what was observed) in the PR description. If the browser cannot be driven in this environment, say so explicitly in the PR rather than claiming success.

- [ ] **Step 4: Push + open PR**

```bash
git push -u origin feat/dashboard-version-ui
gh pr create --title "feat(dashboard): taxonomy version-management UI + snapshot picker" --body "$(cat <<'BODY'
## Summary
- New `/taxonomy-versions` page: list, create draft, release, retire, delete draft (admin), with snapshot counts in a detail dialog.
- Version picker on the trait list: view a released/retired version's frozen snapshot read-only via `?versionId=`.
- API client gains `X-Roles` (from `VITE_API_ROLES`) + error-body parsing so admin mutations and backend error codes work.

## Test plan
- [ ] `npm test` (dashboard) green incl. new version + trait-version suites
- [ ] `tsc --noEmit` + lint clean
- [ ] manual browser smoke: create/release/retire/delete + picker read-only (results in this PR body)
- [ ] Codex inline review triaged before squash-merge (MANDATORY per CLAUDE.md)

Design: docs/superpowers/specs/2026-05-22-dashboard-version-management-ui-design.md
Plan: docs/superpowers/plans/2026-05-22-dashboard-version-management-ui.md
BODY
)"
```

- [ ] **Step 5: MANDATORY pre-merge -- triage Codex inline review**

Wait for Codex (a few minutes after open), then:
```bash
gh api repos/MasterDD-L34D/Game-Database/pulls/<N>/comments \
  --jq '.[] | "[\(.user.login)] \(.path):\(.line // "?") :: \(.body)"'
```
Triage P1/P2 per `CLAUDE.md` Code review protocol before squash. Merge gated on Eduardo sign-off.

---

## Self-Review

**1. Spec coverage:**
- `X-Roles` + error parsing -> Task 1. Version client fns + `listTraits` versionId -> Task 2. i18n + nav -> Task 3. Status chip + table (status-conditional actions) -> Task 4. Create dialog (semver) -> Task 5. Detail dialog (counts) -> Task 6. Page (mutations + confirm + error mapping) + route -> Task 7. Picker + read-only trait integration -> Task 8. Verification + PR -> Task 9. All spec sections covered.

**2. Placeholder scan:** Task 8 step 4 uses `/* ...existing createConfig unchanged... */` deliberately -- it instructs reuse of the current verbatim config objects rather than repeating ~40 lines; the surrounding text states exactly what to keep. Not a content gap. No other TBD/TODO.

**3. Type consistency:** `TaxonomyVersion`, `VersionCounts`, `VersionStatus` defined in Task 2 and used identically in Tasks 4/6/7/8. `ApiError` (Task 1) consumed in Task 7 error mapping. `listTraits(q,page,pageSize,sort,versionId)` signature (Task 2) matches the `fetchTraits` wrapper + the test assertions (Task 8). `listTaxonomyVersions(includeRetired)` shape `{versions}` consistent across page (Task 7) + picker (Task 8). i18n keys under the `versions` namespace (Task 3) match every `t('versions.*')` call.
