-- Add composite index for audit history read pattern
-- (WHERE entity = $1 AND entityId = $2 ORDER BY createdAt DESC).
-- Per PR-δ (2026-05-20) audit endpoint optimization.
-- The existing AuditLog_entity_entityId_idx + AuditLog_createdAt_idx
-- continue to serve other access patterns; this composite is additive.

CREATE INDEX "AuditLog_entity_entityId_createdAt_desc_idx"
  ON "AuditLog" ("entity", "entityId", "createdAt" DESC);
