-- pg_trgm fuzzy search support (Fase 2 #3). Hand-written; Prisma does not
-- manage GIN gin_trgm_ops indexes but will not drop them.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Trait_name_trgm_idx"          ON "Trait"     USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Trait_slug_trgm_idx"          ON "Trait"     USING gin ("slug" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Biome_name_trgm_idx"          ON "Biome"     USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Biome_slug_trgm_idx"          ON "Biome"     USING gin ("slug" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Ecosystem_name_trgm_idx"      ON "Ecosystem" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Ecosystem_slug_trgm_idx"      ON "Ecosystem" USING gin ("slug" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Species_sciName_trgm_idx"     ON "Species"   USING gin ("scientificName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Species_commonName_trgm_idx"  ON "Species"   USING gin ("commonName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Species_slug_trgm_idx"        ON "Species"   USING gin ("slug" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Record_nome_trgm_idx"         ON "Record"    USING gin ("nome" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Record_descrizione_trgm_idx"  ON "Record"    USING gin ("descrizione" gin_trgm_ops);
