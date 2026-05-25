# Phase C-Game: Taxonomy Version Consumer Design

> Status: APPROVED 2026-05-26. Scope: Game repo backend (cross-repo, Eduardo-gated).
> This is a DESIGN/SPEC only. The Game-side patch does NOT land from a Game-Database
> session -- it requires Eduardo's cross-repo sign-off (RFC #1 Section 5, ADR-2026-04-14).

**Goal:** Let a Game build pin a released taxonomy version by setting `EVO_TAXONOMY_VERSION`, so the Game backend fetches that frozen snapshot from Game-Database instead of the live glossary -- closing the versioning loop end to end.

**Architecture:** Game's `catalog.js` already fetches the trait glossary from Game-Database over HTTP when `GAME_DATABASE_ENABLED` is on (ADR-2026-04-14 Alternative B). This change threads a `taxonomyVersion` (from `EVO_TAXONOMY_VERSION`) through `index.js -> app.js -> catalog.js` and appends `?versionId=<tag>` to the glossary fetch. When the env is unset, behavior is byte-identical to today (live glossary). When set, a pinned-fetch failure fails loud (no stale local fallback).

**Tech stack:** Node, Express (Game backend `apps/backend`). Consumes the shipped Phase C-DB endpoint `GET /api/traits/glossary?versionId=<tag>`.

---

## Ground truth (verified in C:/dev/Game)

The real HTTP consumer is `apps/backend/services/catalog.js`, NOT `traitRepository.js`. `traitRepository.js` is a local file store (reads trait JSON from `data/traits/`, has its own `_versions/` snapshotting) and never calls Game-Database. RFC #1 Section 5 names the wrong file -- it is corrected as part of this work (see "RFC correction" below).

Relevant existing code:

- `apps/backend/index.js:29-30` -- reads `GAME_DATABASE_URL` (default `http://localhost:3333`) and `GAME_DATABASE_ENABLED` (default on unless `'false'`), passes a `gameDatabase` options object into `createApp`.
- `apps/backend/app.js:305-315` -- `const gameDatabaseOptions = options.gameDatabase || {}` then `createCatalogService({ httpEnabled, httpBase, httpTimeoutMs, httpTtlMs, httpFetch })`.
- `apps/backend/services/catalog.js`:
  - `HTTP_GLOSSARY_PATH = '/api/traits/glossary'`.
  - `fetchRemoteGlossary(httpBase, fetchFn, timeoutMs)` -- builds `url = ${httpBase}${HTTP_GLOSSARY_PATH}`, fetches, maps via `mapGlossaryFromTraits(docs)`.
  - `createCatalogService(options)` -- reads `httpEnabled`/`httpBase`/`httpTimeoutMs`/`httpTtlMs`/`httpFetch`; `loadGlossarySource()` calls `fetchRemoteGlossary` and on ANY error falls back to the local glossary file (TTL cache 5 min).

## C-DB contract (shipped, for reference)

- `GET /api/traits/glossary` (no `versionId`) -> LIVE glossary from current master rows. Shape `{ traits: [...] }`.
- `GET /api/traits/glossary?versionId=<tag>` -> frozen snapshot of that released/retired version. Same shape (the `glossary.schema.json` contract is `additionalProperties:false`, so the versioned response carries NO extra marker -- the version is implicit in the request).
- Unknown tag -> `404 VERSION_NOT_FOUND`; draft tag -> `400 VERSION_NOT_RELEASED`.

Note: RFC #1 Section 4 says "omitted = latest released" -- that is inaccurate against the shipped C-DB, where omitted = LIVE current data (not a snapshot). Backward-compat still holds because Game already consumes the live glossary today. The RFC line is corrected as part of this work.

## Components (3 files, Game repo)

### `apps/backend/index.js` (modify, ~line 29-30)

Read the pin env alongside the existing Game-Database env, and include it in the `gameDatabase` options:

```js
const taxonomyVersion = process.env.EVO_TAXONOMY_VERSION || '';
// ... in the gameDatabase options object passed to createApp:
gameDatabase: {
  enabled: gameDatabaseEnabled,
  url: gameDatabaseUrl,
  taxonomyVersion, // '' = unpinned (live glossary)
},
```

### `apps/backend/app.js` (modify, line ~308)

Thread the option into `createCatalogService`:

```js
createCatalogService({
  dataRoot,
  httpEnabled: gameDatabaseOptions.enabled === true,
  httpBase: gameDatabaseOptions.url || null,
  httpTimeoutMs: gameDatabaseOptions.timeoutMs,
  httpTtlMs: gameDatabaseOptions.ttlMs,
  httpFetch: gameDatabaseOptions.fetch,
  taxonomyVersion: gameDatabaseOptions.taxonomyVersion || '',
});
```

### `apps/backend/services/catalog.js` (modify)

1. `fetchRemoteGlossary` gains a `versionId` param and appends the query when set:

```js
async function fetchRemoteGlossary(httpBase, fetchFn, timeoutMs, versionId = '') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : '';
    const url = `${httpBase.replace(/\/$/, '')}${HTTP_GLOSSARY_PATH}${query}`;
    const response = await fetchFn(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response || !response.ok) {
      const status = response ? response.status : 'no-response';
      throw new Error(`game-database glossary HTTP ${status}`);
    }
    const payload = await response.json();
    const docs = Array.isArray(payload?.traits) ? payload.traits
      : Array.isArray(payload?.docs) ? payload.docs
      : Array.isArray(payload) ? payload : [];
    return mapGlossaryFromTraits(docs);
  } finally {
    clearTimeout(timer);
  }
}
```

2. `createCatalogService` reads `const taxonomyVersion = options.taxonomyVersion || '';` and `loadGlossarySource()` threads it + applies the fail-loud rule:

```js
async function loadGlossarySource() {
  if (httpEnabled && httpBase && httpFetch) {
    try {
      const remote = await fetchRemoteGlossary(httpBase, httpFetch, httpTimeoutMs, taxonomyVersion);
      return { glossary: remote, source: taxonomyVersion ? 'http-pinned' : 'http' };
    } catch (error) {
      if (taxonomyVersion) {
        // Pinned build: do NOT fall back to the local file. Serving stale local
        // data under a version pin hides a misconfiguration. Fail loud. The
        // error message carries the HTTP status so 4xx (bad/unreleased pin) is
        // distinguishable from 5xx/timeout (Game-Database down).
        throw new Error(
          `[catalog] pinned taxonomy ${taxonomyVersion} failed (${error.message}); refusing stale local fallback`,
        );
      }
      console.warn('[catalog] game-database glossary HTTP fetch failed, falling back to local file:', error.message);
      const localGlossary = await readJsonFile(traitGlossaryPath, { traits: {} });
      return { glossary: localGlossary, source: 'local-fallback' };
    }
  }
  const localGlossary = await readJsonFile(traitGlossaryPath, { traits: {} });
  return { glossary: localGlossary, source: 'local' };
}
```

(The exact local-glossary read line should match the existing implementation; the change is the `taxonomyVersion` argument, the `http-pinned` source label, and the fail-loud branch.)

## Data flow

1. `EVO_TAXONOMY_VERSION` unset -> `fetchRemoteGlossary(..., '')` -> `/api/traits/glossary` (live) -> on error, local fallback (unchanged). `source` = `http` or `local-fallback` or `local`.
2. `EVO_TAXONOMY_VERSION=v1.2.0` -> `/api/traits/glossary?versionId=v1.2.0` (frozen snapshot) -> TTL cache 5 min (snapshot is immutable, so caching is safe). `source` = `http-pinned`.
3. Pinned + HTTP failure (4xx bad pin, or 5xx/timeout DB down) -> throw, NO local fallback. The build/request surfaces the error.

## Error handling

- Pinned failures fail loud (no local fallback); the thrown message includes the upstream HTTP status so the operator can tell a bad/unreleased pin (`HTTP 404`/`HTTP 400`) from a Game-Database outage (`HTTP 5xx`/`no-response`).
- Unpinned failures keep today's behavior: warn + local fallback.
- No client-side semver validation -- C-DB already returns 404 for an unknown tag; duplicating `SEMVER_RE` cross-repo would drift.

## Testing (Game repo)

Mirror the existing `tests/api/catalogHttpClient.test.js` pattern (inject a fake `httpFetch`):

1. Unpinned (`taxonomyVersion: ''`) -> fetched URL is exactly `${base}/api/traits/glossary` (no `versionId`); on a thrown fetch, falls back to local (regression guard).
2. Pinned (`taxonomyVersion: 'v1.0.0'`) -> fetched URL includes `?versionId=v1.0.0`.
3. Pinned + fake fetch resolving `{ ok:false, status:404 }` -> `loadTraitGlossary()` rejects; the error message contains `404`; the local file is NOT read.
4. Pinned + fake fetch resolving `{ ok:false, status:503 }` -> rejects; message contains `503`; no local fallback.
5. Pinned + success -> glossary mapped via `mapGlossaryFromTraits`; `source === 'http-pinned'`.
6. `game-database-flag-default.test.js` stays green (default-on, unpinned path unchanged).

## Scope / non-goals

- Glossary only -- the sole HTTP fetch in `catalog.js`. Biome pools and everything else stay local. Matches C-DB's trait-only `?versionId=`.
- No new dependency, no Game-Database change (the `?versionId=` endpoint already shipped in PR #163).
- No semver client guard (YAGNI; C-DB 404 suffices).
- No version-selection UI on the Game side -- pinning is a build-time env var.

## RFC correction (Game-Database, this commit)

`docs/rfc/2026-05-21-schema-versioning.md`:
- Section 5: replace `apps/backend/services/traitRepository.js` with `apps/backend/services/catalog.js` (the real HTTP consumer) and note the env threads `index.js -> app.js -> catalog.js`; add the fail-loud-on-pin decision.
- Section 4: correct "omitted = latest released" to "omitted = live current glossary" (matches shipped C-DB).

## Cross-repo gating

The Game-side patch is RFC-gated (RFC #1 Section 5, ADR-2026-04-14): a coordinator session reviews and Eduardo signs off before it lands in the Game repo. This spec + the RFC correction live in Game-Database; the implementation plan is parked until Eduardo authorizes the cross-repo touch.
