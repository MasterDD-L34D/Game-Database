-- PR-α2 follow-up (roadmap Q1 / RFC #1 Q6): enforce slug max-length at the DB
-- level, matching app-level normalizeSlug() max-80. Defense-in-depth for
-- direct-DB writes / imports that bypass the route layer; VarChar(80) is the
-- Postgres index sweet-spot for slug. Existing slugs are <=38 chars, so the
-- Text -> VarChar(80) cast is lossless.
ALTER TABLE "Trait"     ALTER COLUMN "slug" SET DATA TYPE VARCHAR(80);
ALTER TABLE "Biome"     ALTER COLUMN "slug" SET DATA TYPE VARCHAR(80);
ALTER TABLE "Species"   ALTER COLUMN "slug" SET DATA TYPE VARCHAR(80);
ALTER TABLE "Ecosystem" ALTER COLUMN "slug" SET DATA TYPE VARCHAR(80);
