# pg_trgm fuzzy search — research + tuning 2026-05-21

Component: `GET /api/search` cross-entity typo-tolerant search (pg_trgm),
Game-Database `server/`. QG Steps 2 + 3 evidence. All numbers below captured
against the local seeded Postgres 16 dev DB on 2026-05-21.

## QG Step 2 — edge cases (covered by tests)

1. **Empty/whitespace q** → `400 VALIDATION_ERROR` (`search.test.js`).
2. **Unknown entity token** → `400` (`searchQuery.test.js` parseEntities + route).
3. **No match** → `200`, empty `results` (high-threshold smoke).
4. **Injection / special chars in q** → `q` is bound via `Prisma.sql ${}`
   (parameterized); table/column identifiers come ONLY from the hardcoded
   allowlist (`Prisma.raw` on constants), never user input.
5. **NULL `commonName` / `descrizione`** → `similarity(NULL, q) = NULL`,
   `GREATEST` ignores NULLs; `%` on NULL is false. No special handling.
6. **Record has no slug** → arm emits `NULL AS slug` (builder unit test).
7. **limit clamp** → `>50` clamped to 50, `<1` to 1; **threshold clamp** [0,1].

## QG Step 3 — tuning + index verification

### Similarity floor (threshold)

Measured trigram similarity on seed data:

| pair | similarity |
|---|---|
| `similarity('Lynx lynx', 'lynks')` | **0.375** |
| `similarity('Falco peregrinus', 'falko')` | 0.15 |

- **Default threshold = 0.3**: includes the `lynks → Lynx lynx` typo (0.375 ≥ 0.3)
  while a looser `falko` (0.15) is excluded — a sensible precision/recall balance
  for latin binomials.
- `threshold=0.9` returns 0 rows for `lynks` (0.375 < 0.9) — verified by smoke.

The floor is applied per-request via `SELECT set_limit(${threshold})` (sets
`pg_trgm.similarity_threshold` on the connection) inside the same transaction as
the search, so `col % q` means `similarity(col, q) >= threshold`.

### GIN trigram index — before/after (EXPLAIN)

The first implementation filtered with `similarity(col, q) >= threshold`. EXPLAIN
showed this **never uses** the GIN trgm index — the planner picked a btree
Index-Only-Scan / seq scan and applied similarity as a row filter. pg_trgm's GIN
index only accelerates the **`%` / `LIKE` / `ILIKE`** operators, not the
`similarity() >=` expression. The query was switched to `col % q`.

After the switch, forcing the planner off seq/btree to expose the candidate plan:

```
SET enable_seqscan=off; enable_indexscan=off; enable_indexonlyscan=off;
EXPLAIN SELECT "scientificName" FROM "Species" WHERE "scientificName" % 'lynks';

 Bitmap Heap Scan on "Species"
   Recheck Cond: ("scientificName" % 'lynks'::text)
   ->  Bitmap Index Scan on "Species_sciName_trgm_idx"
         Index Cond: ("scientificName" % 'lynks'::text)
```

⇒ the `%` filter is served by the GIN trgm index. At the current seed scale
(~8 species) the planner still prefers a btree/seq scan because the table is
tiny; the GIN index is **correct and chosen automatically once the tables grow**
(when seq/btree cost exceeds the bitmap path). This is the intended forward-
looking benefit — the index is no longer dead weight relative to the query form.

## Architecture notes

- 5 entities (Trait/Biome/Ecosystem/Species/Record); junctions excluded (FK/enum
  search, meaningless for fuzzy).
- Heterogeneous primary text column aliased to `label` (`name` / `scientificName`
  / `nome`). Record arm: `slug = NULL`.
- Ranking: `score = GREATEST(similarity(<cols>, q))`, `ORDER BY score DESC`.
- Existing per-route `?q` substring search untouched (additive).
- Governance: RFC #3 (`docs/rfc/2026-05-21-semantic-search.md`) records the
  scope split (fuzzy now / tsvector-semantic deferred), Eduardo-authorized.

## Test inventory

- `server/test/searchQuery.test.js` — pure builder (allowlist, `%`, Record-no-slug, arms). In `run-tests.js`.
- `server/test/search.test.js` — mocked route via `$transaction` stub (shape, 400s, limit clamp). In `run-tests.js`.
- `server/test/search.db.test.js` — real-Postgres smoke (lynks→Lynx lynx, threshold, entities). NOT in `run-tests.js`; runs in the new `search-db` CI job.
