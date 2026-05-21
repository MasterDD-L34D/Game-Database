-- CreateEnum
CREATE TYPE "TaxonomyVersionStatus" AS ENUM ('draft', 'released', 'retired');

-- NOTE: Prisma diff also emitted DROP INDEX statements for the 11 pg_trgm GIN
-- indexes created in migration 20260521130000_pg_trgm_search. Those indexes are
-- intentionally not modeled in schema.prisma and must NOT be dropped (they back
-- the /api/search fuzzy feature, PR #151). The DROP INDEX lines were removed
-- here so this migration only ADDS the versioning tables (RFC #1 Phase A).

-- CreateTable
CREATE TABLE "TaxonomyVersion" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "status" "TaxonomyVersionStatus" NOT NULL DEFAULT 'draft',
    "description" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releasedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxonomyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraitVersion" (
    "id" TEXT NOT NULL,
    "traitId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "unit" TEXT,
    "dataType" "TraitDataType" NOT NULL,
    "allowedValues" JSONB,
    "rangeMin" DOUBLE PRECISION,
    "rangeMax" DOUBLE PRECISION,
    "tier" TEXT,
    "familyType" TEXT,
    "energyMaintenance" TEXT,
    "slotProfile" JSONB,
    "usageTags" JSONB,
    "synergies" JSONB,
    "conflicts" JSONB,
    "environmentalRequirements" JSONB,
    "inducedMutation" TEXT,
    "functionalUse" TEXT,
    "selectiveDrive" TEXT,
    "weakness" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraitVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiomeVersion" (
    "id" TEXT NOT NULL,
    "biomeId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "climate" TEXT,
    "parentId" TEXT,
    "summary" TEXT,
    "climateTags" JSONB,
    "hazard" JSONB,
    "ecology" JSONB,
    "roleTemplates" JSONB,
    "sizeMin" INTEGER,
    "sizeMax" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiomeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeciesVersion" (
    "id" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "scientificName" TEXT NOT NULL,
    "commonName" TEXT,
    "kingdom" TEXT,
    "phylum" TEXT,
    "class" TEXT,
    "order" TEXT,
    "family" TEXT,
    "genus" TEXT,
    "epithet" TEXT,
    "status" TEXT,
    "description" TEXT,
    "displayName" TEXT,
    "trophicRole" TEXT,
    "functionalTags" JSONB,
    "flags" JSONB,
    "balance" JSONB,
    "playableUnit" BOOLEAN,
    "morphotype" TEXT,
    "vcCoefficients" JSONB,
    "spawnRules" JSONB,
    "environmentAffinity" JSONB,
    "jobsBias" JSONB,
    "telemetry" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeciesVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcosystemVersion" (
    "id" TEXT NOT NULL,
    "ecosystemId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "region" TEXT,
    "climate" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcosystemVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyVersion_tag_key" ON "TaxonomyVersion"("tag");

-- CreateIndex
CREATE INDEX "TaxonomyVersion_status_releasedAt_idx" ON "TaxonomyVersion"("status", "releasedAt");

-- CreateIndex
CREATE INDEX "TraitVersion_versionId_idx" ON "TraitVersion"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "TraitVersion_traitId_versionId_key" ON "TraitVersion"("traitId", "versionId");

-- CreateIndex
CREATE INDEX "BiomeVersion_versionId_idx" ON "BiomeVersion"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "BiomeVersion_biomeId_versionId_key" ON "BiomeVersion"("biomeId", "versionId");

-- CreateIndex
CREATE INDEX "SpeciesVersion_versionId_idx" ON "SpeciesVersion"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesVersion_speciesId_versionId_key" ON "SpeciesVersion"("speciesId", "versionId");

-- CreateIndex
CREATE INDEX "EcosystemVersion_versionId_idx" ON "EcosystemVersion"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "EcosystemVersion_ecosystemId_versionId_key" ON "EcosystemVersion"("ecosystemId", "versionId");

-- AddForeignKey
ALTER TABLE "TraitVersion" ADD CONSTRAINT "TraitVersion_traitId_fkey" FOREIGN KEY ("traitId") REFERENCES "Trait"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraitVersion" ADD CONSTRAINT "TraitVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TaxonomyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiomeVersion" ADD CONSTRAINT "BiomeVersion_biomeId_fkey" FOREIGN KEY ("biomeId") REFERENCES "Biome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiomeVersion" ADD CONSTRAINT "BiomeVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TaxonomyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesVersion" ADD CONSTRAINT "SpeciesVersion_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesVersion" ADD CONSTRAINT "SpeciesVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TaxonomyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcosystemVersion" ADD CONSTRAINT "EcosystemVersion_ecosystemId_fkey" FOREIGN KEY ("ecosystemId") REFERENCES "Ecosystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcosystemVersion" ADD CONSTRAINT "EcosystemVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TaxonomyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RFC #1 Q2: single mutable draft enforced via partial unique index
-- (Prisma cannot express partial unique indexes in schema).
CREATE UNIQUE INDEX "TaxonomyVersion_single_draft_idx"
  ON "TaxonomyVersion" ((1))
  WHERE "status" = 'draft'::"TaxonomyVersionStatus";

-- RFC #1 Q1: baseline released version.
INSERT INTO "TaxonomyVersion" ("id", "tag", "status", "description", "releasedAt", "createdAt", "updatedAt")
VALUES (
  'taxver_v1_0_0_baseline',
  'v1.0.0',
  'released'::"TaxonomyVersionStatus",
  'Baseline pre-versioning snapshot',
  now(), now(), now()
);
