# Schema Versioning Phase C (C-DB) -- Versioned Read Filter Design

> Status: APPROVED 2026-05-22. Scope: Game-Database read-path only.
> Series: RFC #1 schema-versioning (Phase A #154, B1 #158, B2 #160 shipped).

**Goal:** Let API consumers request a released taxonomy version's frozen
snapshot via `?versionId=<tag>` on the two trait read endpoints, without
touching the live read path.

**Architecture:** A new pure-function module `server/utils/versionRead.js`
resolves a release tag to its version row and maps a `TraitVersion` snapshot
row back into the master trait shape (reusing `versionSnapshot.FIELD_MAP`).
The two trait GET handlers branch at the top: when `?versionId=` is present
they serve from the snapshot table; otherwise the existing live path runs
unchanged.

**Tech stack:** Express, Prisma, PostgreSQL. node:test (DB suite in the
`search-db` CI job, real Postgres).

---

## Scope

In scope (C-DB only):

- `GET /api/traits?versionId=<tag>` -- paginated versioned list.
- `GET /api/traits/glossary?versionId=<tag>` -- versioned glossary.

Out of scope (deliberate, YAGNI):

- Biome / Species / Ecosystem versioned reads -- no consumer yet.
- C-Game env consumer wiring -- cross-repo, Eduardo-gated, separate RFC.
- Any schema change or migration -- read-only over existing snapshot tables.

## Components

### `server/utils/versionRead.js` (new)

Pure, no side effects, no audit. Two exports.

`resolveReleasedVersion(tag)`:

- `taxonomyVersion.findUnique({ where: { tag } })`.
- not found -> throw `AppError(404, 'VERSION_NOT_FOUND', ...)`.
- `status === 'draft'` -> throw `AppError(400, 'VERSION_NOT_RELEASED', ...)`.
- `status` released or retired -> return the version row.
- Rationale: a retired version's snapshot stays readable (historical view);
  only an unreleased draft is rejected because its snapshot is not populated
  until release.

`traitVersionToTrait(row)`:

- Build a trait-shaped object: `id = row.traitId` (the stable master id, NOT
  the snapshot row id), then copy each field in
  `FIELD_MAP.trait.fields` from `row`.
- Drop snapshot-only columns (`versionId`, `capturedAt`, snapshot `id`).
- Reuses the single frozen-field source so list mapping cannot drift from the
  snapshot writer.

### `server/routes/traits.js` (modify 2 handlers)

`GET /` (list), at the top of the handler:

```js
const versionId = (req.query.versionId || '').trim();
if (versionId) {
  const version = await resolveReleasedVersion(versionId);
  const { page, pageSize } = assertPagination(req.query);
  const q = (req.query.q || '').trim();
  const where = {
    versionId: version.id,
    ...(q ? { OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
    ] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.traitVersion.count({ where }),
    prisma.traitVersion.findMany({ where, skip: page * pageSize, take: pageSize, orderBy: { name: 'asc' } }),
  ]);
  return res.json({ items: rows.map(traitVersionToTrait), page, pageSize, total, _version: version.tag });
}
// ...existing live path unchanged below
```

`GET /glossary`, at the top of the handler:

```js
const versionId = (req.query.versionId || '').trim();
if (versionId) {
  const version = await resolveReleasedVersion(versionId);
  const rows = await prisma.traitVersion.findMany({
    where: { versionId: version.id },
    select: { slug: true, name: true, description: true },
    orderBy: { name: 'asc' },
  });
  const traits = rows.map((t) => ({
    _id: t.slug,
    labels: { it: t.name, en: t.name },
    descriptions: { it: t.description || null, en: t.description || null },
  }));
  return res.json({ traits });
}
// ...existing live path unchanged below
```

## Data flow

1. Consumer sends `?versionId=v1.0.0`.
2. Handler resolves tag -> version row (404 / 400 / row).
3. Snapshot query filtered by `version.id`, ordered name asc, optional `q`.
4. Rows mapped to the response shape and returned.

The live path (no `versionId`) is byte-for-byte unchanged: zero regression
surface.

## Contract decisions (locked)

| Case | Decision | Reason |
|---|---|---|
| Versioned glossary shape | identical `{ traits: [...] }`, no version marker | `glossary.schema.json` sets `additionalProperties: false` on both root and item -> any marker is a contract violation. Version is implicit in the request. |
| List `_version` | top-level sibling `{ items, page, pageSize, total, _version }` | the list endpoint is not contract-bound; top-level keeps `items` clean. |
| Versioned item `id` | master `traitId` | consumers reference the stable master id, not the ephemeral snapshot row id. |
| Unknown tag | `404 VERSION_NOT_FOUND` | |
| Draft tag | `400 VERSION_NOT_RELEASED` | snapshot not yet populated |
| Retired tag | `200`, serves snapshot | historical data stays readable |
| `q` on versioned list | name/slug `contains` insensitive | parity with live `buildWhere`, minus `liveFilter` |
| `versionId` empty / whitespace | falls through to live path | treated as absent |
| Frozen snapshot | ignores master `deletedAt` | snapshot is frozen at release time; a later soft-delete of the live master does not alter history |

## Error handling

All errors flow through the existing `AppError` + `handleError(res, error)`
path already used in `traits.js`. No new error infrastructure. The two new
error codes (`VERSION_NOT_FOUND`, `VERSION_NOT_RELEASED`) are thrown from
`resolveReleasedVersion` and serialized by `handleError`.

## Testing

New DB suite `server/test/traitVersionRead.db.test.js` (real Postgres, runs in
the `search-db` CI job, naming `*.db.test.js`):

1. List `?versionId=v1.0.0` -> items mapped, `_version` present and equal to
   the tag, each `id` equals the master `traitId`.
2. Glossary `?versionId=v1.0.0` -> shape validates against
   `glossary.schema.json`; row count equals the snapshot count for the tag.
3. Unknown tag -> `404 VERSION_NOT_FOUND`.
4. Draft tag -> `400 VERSION_NOT_RELEASED`.
5. `q` filter on versioned list -> returns the correct subset.
6. No `versionId` -> live path response unchanged (regression guard).
7. Soft-delete a live master, then versioned list still includes it (frozen
   snapshot ignores `deletedAt`).

`server` mocked suite (`npm test`, `checks` job) stays green: the live path is
untouched, so existing trait tests need no change. The versioned branch is
exercised only by the DB suite (needs real snapshot rows).

## Non-goals recap

No schema change. No migration. No new dependency. No biome/species/ecosystem
versioned read. No write-path change. Admin/auth unchanged (GET stays open).
