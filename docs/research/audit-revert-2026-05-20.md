# Research — Audit revert endpoint (Fase 2 undo)

**Date**: 2026-05-20
**Component**: `server/routes/audit.js` `POST /:logId/revert` (Fase 2 2/N)
**Author**: parallel-#2 session (Ryzen)
**Spec reference**: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` § Fase 2 "Undo via AuditLog rollback"

## Goal

Document v1 scope decisions for the new revert endpoint, the per-entity payload projection strategy, and the 4+ edge case scenarios.

## Endpoint contract

```
POST /api/audit/:logId/revert
Headers: X-Roles: taxonomy:write
Body: (none)

Response 200: { success: true, id, entity, revertedFrom: <logId> }
Response 400 NOT_REVERTABLE: action not DELETE, entity not master, missing payload.id
Response 403 FORBIDDEN: caller lacks taxonomy:write role
Response 404 NOT_FOUND: log id absent
Response 409 CONFLICT: entity with same id already exists
```

## Scope decisions

### 1. v1 restricted to action='DELETE' (resurrect tombstoned entity)

UPDATE-revert requires reconstructing the **prior** state of the entity, which means replaying audit history up to the entry being reverted. The `payload` for UPDATE log entries only contains `req.body` (the PATCH delta), not the full pre-change snapshot. Implementing UPDATE-revert correctly would need:

- Read all audit entries for the entity from createdAt=0 → target
- Apply CREATE payload → apply each UPDATE payload as deep merge → take state right BEFORE the target UPDATE
- Restore via `prisma[model].update({where: {id}, data: priorState})`

This is non-trivial and surfaces conflict cases (e.g. concurrent edits since the target). Defer to Fase 2 v2.

CREATE-revert is also out of scope: reverting a CREATE = deleting the entity, but the entity may have been referenced by junctions since creation. Cascade impact analysis needed.

DELETE-revert is the most user-asked-for undo case (designer accidentally deletes a Trait/Biome). Payload contains the full entity scalar fields → simple `prisma[model].create({data: projected})`.

### 2. Per-entity field whitelist (REVERTABLE_FIELDS)

Prisma's `.create()` strict-rejects unknown keys. `AuditLog.payload` may contain:
- Nested relation arrays (e.g. `speciesValues` on Trait if Prisma include was used pre-DELETE)
- Computed fields (`_count`, `_relationLoadStrategy`)
- Future schema additions not in the original model

Solution: hard-code a scalar field list per model (`trait`, `biome`, `species`, `ecosystem`, `record`) mirroring `schema.prisma`. The `projectPayloadForRevert(modelKey, payload)` helper projects payload through the whitelist before `create()`.

Trade-off: schema additions require updating both `schema.prisma` AND `REVERTABLE_FIELDS`. Mitigation: PR-γ schema-doc-check workflow doesn't yet flag this drift; could extend in follow-up to lint `REVERTABLE_FIELDS` against `schema.prisma`.

### 3. Master-entity only (5 models)

`REVERTABLE_ENTITY_MODELS` whitelists `Trait`, `Biome`, `Species`, `Ecosystem`, `Record`. Junctions (`SpeciesTrait`, `SpeciesBiome`, `EcosystemBiome`, `EcosystemSpecies`) are NOT tracked by `logAudit` in the current codebase, so revert is conceptually inapplicable — but the explicit whitelist defends against future audit additions.

### 4. ID preservation strategy

`prisma[model].create({data: {...projected}})` with explicit `id` field. Preserves cuid → relations that referenced the deleted entity (FK NULL'd or removed by cascade) are NOT automatically reattached. v1 limitation: caller must manually re-link junctions after revert.

Future: revert could optionally restore junction relationships from the same audit window (look for DELETE audit entries for junctions referencing this entity in the same minute). Defer to follow-up.

### 5. New audit entry for the revert itself

Per spec note: every revert logs a new `CREATE` audit entry with `payload._revertedFrom: <originalLogId>` for traceability. Future revert-of-revert would surface as nested `_revertedFrom` chain.

## Edge case scenarios investigated

### Scenario 1 — Happy path (DELETE → revert resurrects)

Designer deletes Trait `foo`. Log `audit-X` records `entity=Trait, entityId=trait-1, action=DELETE, payload={id, slug, name, dataType, description, ...}`. Designer realizes mistake → `POST /api/audit/audit-X/revert`. Endpoint:

1. Find log ✓
2. Action=DELETE ✓
3. Entity=Trait → model=trait ✓
4. Project payload through trait whitelist ✓
5. Check `prisma.trait.findUnique(id)` returns null (no conflict) ✓
6. `prisma.trait.create(data)` → trait resurrected with same id ✓
7. Log new CREATE entry with `_revertedFrom: audit-X` ✓

Response 200 + `{success, id, entity, revertedFrom}`.

### Scenario 2 — Already-restored entity (409 CONFLICT)

Designer reverts log `audit-X` once → trait resurrected. Designer (or different user) clicks revert AGAIN → entity exists → 409 CONFLICT. Prevents duplicate-create errors at Prisma layer and surfaces a clear user-facing message.

### Scenario 3 — Non-revertable action (UPDATE / CREATE)

Designer clicks revert on an UPDATE entry → 400 NOT_REVERTABLE with explicit `Only DELETE actions can be reverted in v1` message. CREATE same. Surfaces v1 limitation clearly without falling through to a Prisma error.

### Scenario 4 — Junction/non-master entity (defensive 400)

If a junction were somehow logged (currently they aren't), revert would attempt to use a non-existent model accessor. Defensive whitelist check returns 400 NOT_REVERTABLE before reaching Prisma.

### Scenario 5 — Payload missing id (defensive 400)

Some pre-PR-α audit entries may have had partial payloads (no id field due to historical logger bug). Without `id` we can't determine the resurrection target. Return 400 NOT_REVERTABLE instead of throwing at Prisma.

## QG (CLAUDE.md Release Standard)

- **Step 1 Smoke**: 24/24 audit.test.js verde (was 16; +8 new revert tests). Full server suite unchanged otherwise.
- **Step 2 Research**: this document, 5 scenarios + scope decisions
- **Step 3 Tuning**: revert is single-query workflow (findUnique audit → findUnique target → create target → create new audit). ~3 ms per call on local seed. No new index needed.

## Cross-repo impact

ZERO. New endpoint additive. Sibling Game has no revert consumer. No schema mutation. Audit composite index (PR-δ) sufficient for the lookup.

## Open follow-ups (out-of-scope for this PR)

1. **UPDATE-revert v2**: prior-state replay via audit chain (high-value next iteration)
2. **CREATE-revert v2**: with cascade impact analysis on junctions
3. **Junction relationship restore**: opportunistic re-link of junctions deleted in the same audit window
4. **Dashboard UI**: `Revert` button on AuditHistoryPanel for DELETE entries (Fase 2 follow-up PR — server-side first, UI later)
5. **REVERTABLE_FIELDS drift lint**: extend schema-doc-check to flag if a new scalar field is added to `schema.prisma` without updating the whitelist

## References

- Spec: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` § Fase 2 (audit revert)
- PR-δ audit endpoint: `91d5007` (foundation)
- PR #127 audit UI: `f986922` (will consume revert button later)
- Schema reference: `docs/schema-reference.md` (REVERTABLE_FIELDS source of truth alignment)
