# Research — Audit history read endpoint

**Date**: 2026-05-20
**Component**: `server/routes/audit.js`, `server/middleware/permissions.js` (extension), `server/prisma/migrations/20260520120000_audit_composite_index/migration.sql`, schema composite index
**Author**: parallel-#2 session (Ryzen)
**Spec reference**: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` PR-δ + Q2 resolved

## Goal

Document design decisions for the new `GET /api/audit` endpoint (read-only audit log), the RBAC default-open contract, the composite index migration rationale, and 3+ edge case scenarios.

## Endpoint contract

```
GET /api/audit?entity=X&entityId=Y&action=CREATE|UPDATE|DELETE&user=string&page=N&pageSize=M
```

Response shape (paginated, mirrors existing `/api/traits` etc.):

```json
{
  "items": [{ "id": "...", "entity": "...", "entityId": "...", "action": "...", "user": "...", "payload": {}, "createdAt": "..." }],
  "page": 0,
  "pageSize": 25,
  "total": 137
}
```

Sort default: `createdAt DESC` (newest first). Pagination: `page` 0-based, `pageSize` 1–100 (mirrors `assertPagination`).

## Design decisions

### 1. RBAC default-open via `AUDIT_READ_ROLES` (Q2 resolved)

Per spec Q2 autoresearch: unset env → open (no role check), mirrors all 10 existing GET routes. Setting `AUDIT_READ_ROLES=audit:read,admin` flips to gated mode.

**Read at request time, not module load**: `currentAuditReadRoles()` reads `process.env.AUDIT_READ_ROLES` on every request. Test-friendly (test can flip env mid-suite without re-instantiating the app).

**No payload sensitivity issue**: AuditLog.payload contains taxonomy data (publicly canonical from sibling Game repo). No PII, no secrets. LAN/prod hardening inherited from `basicAuth` middleware when `APP_AUTH_USER` set.

### 2. Composite index `(entity, entityId, createdAt DESC)`

The primary query pattern is `WHERE entity=$1 AND entityId=$2 ORDER BY createdAt DESC LIMIT N`. Existing indexes:
- `AuditLog_entity_entityId_idx` (composite) — used for filter
- `AuditLog_createdAt_idx` (single column) — used for global chrono scan

Pre-PR-δ EXPLAIN ANALYZE on local DB (182 AuditLog rows):

```
Limit  (cost=8.17..8.18 rows=1)
 -> Sort (Sort Key: "createdAt" DESC)
   -> Index Scan using "AuditLog_entity_entityId_idx"
      Index Cond: (entity = 'Trait' AND entityId = 'trait-1')
Execution Time: 0.839 ms
```

Postgres picks the entity+entityId index, then sorts the filtered rows. For low-cardinality (few audit rows per entity) this is sub-millisecond. For high-cardinality (entities with thousands of audit rows), the in-memory sort becomes expensive.

**Post-PR-δ composite index** `(entity, entityId, createdAt DESC)` allows Index Scan to deliver pre-sorted output → no sort step. Planner cost drops to constant per row for top-N retrieval. Future-proofs as AuditLog grows.

Existing indexes preserved (additive migration, no DROP).

### 3. Action filter normalized uppercase

`?action=update` → normalized to `UPDATE` (matches Prisma enum). Lowercase user input common in URL query strings. Validation: must be one of `CREATE|UPDATE|DELETE` (enum AuditAction).

### 4. No DELETE/POST/PATCH endpoints in this PR

PR-δ ships **read-only** audit endpoint. Future `POST /api/audit/:logId/revert` (Fase 2) will be a separate mutation gated by `requireTaxonomyWrite`, explicitly documented in spec line 198.

## Edge case scenarios investigated

### Scenario 1 — Empty payload + missing user field

`AuditLog.user` is nullable (some legacy entries pre-X-User-header). `AuditLog.payload` is nullable Json. Endpoint passes both through unchanged. Test verifies entries with `user: null` returned as JSON null.

### Scenario 2 — Default sort newest first

The composite index pre-sorts by createdAt DESC. The route specifies `orderBy: { createdAt: 'desc' }` explicitly so behavior is consistent across migration apply states (also works pre-migration via Postgres in-memory sort).

Test: seed 3 entries with explicit createdAt, verify response items[0] has the latest timestamp.

### Scenario 3 — Pagination at boundaries

- `page=0&pageSize=4` with 10 entries → items.length=4, total=10
- `page=2&pageSize=2` with 6 entries → returns oldest pair (3rd page from newest)
- `pageSize=999` → 400 VALIDATION_ERROR (capped at 100 by assertPagination)

### Scenario 4 — RBAC dynamic switch

Mid-test the env flips between unset (open) and `AUDIT_READ_ROLES=audit:read,admin` (gated). The middleware reads env at request time, so flip is observed without restarting the app.

Tests verify all 3 states:
- env unset → 200 regardless of X-Roles
- env set + caller lacks role → 403 FORBIDDEN
- env set + caller has role → 200

## Cross-repo audit

- **Game** (`C:/dev/Game`): zero consumer of `/api/audit` planned. Game runtime consumes only `/api/traits/glossary`.
- **codemasterdd-ai-station**: no ADR mandates audit endpoint design; ground-truth principle (anti-pattern #8) favors audit visibility.
- **vault**, **Game-Godot-v2**: NOT inspected (NO-GO).

ZERO breaking change. New endpoint is additive.

## Quality gates (CLAUDE.md Release Standard)

- **Step 1 Smoke**: 12/12 audit tests verde; full suite 153 → 165 (+12).
- **Step 2 Research**: this document, 4 scenarios.
- **Step 3 Tuning**: EXPLAIN ANALYZE pre-PR baseline captured (0.839ms on 182 rows). Composite index addition documented; benefit measurable post-`prisma migrate deploy`.

## Open follow-ups (out-of-scope for PR-δ)

1. `POST /api/audit/:logId/revert` mutation endpoint (Fase 2, undo feature for dashboard)
2. WebSocket subscription for live audit tail (Fase 2 dashboard "History" panel)
3. Drop `AuditLog_entity_entityId_idx` if benchmark shows composite obviates it (defer until > 100k rows benchmark available)
4. Range filter `?since=<ISO>&until=<ISO>` on createdAt (commonly requested for audit reports)
5. CSV export `?format=csv` (parity with records.js export pattern)

## References

- Spec: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` PR-δ + Q2
- Permissions middleware: `server/middleware/permissions.js` (extended)
- Route: `server/routes/audit.js` (new)
- Migration: `server/prisma/migrations/20260520120000_audit_composite_index/migration.sql`
- AuditLog schema: `docs/schema-reference.md#auditlog` (auto-gen)
- Existing GET pattern reference: `server/routes/dashboard.js`, `server/routes/records.js`
