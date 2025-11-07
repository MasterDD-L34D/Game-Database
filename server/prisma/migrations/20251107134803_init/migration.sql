-- CreateEnum
CREATE TYPE "RecordStato" AS ENUM ('Attivo', 'Bozza', 'Archiviato');

-- CreateEnum
CREATE TYPE "Stile" AS ENUM ('Monolinea', 'Tratteggiato', 'Puntinato', 'Brush', 'Calligrafico', 'Geometrico', 'Organico', 'DoppioTratto', 'Ombreggiato', 'Tecnico', 'Neon', 'Sfumato', 'Angolare', 'Spezzato', 'Contour', 'Ink');

-- CreateEnum
CREATE TYPE "Pattern" AS ENUM ('Pieno', 'Tratteggio', 'Puntinato', 'Gradiente', 'Hachure', 'Contorno', 'Spezzato', 'Inchiostro');

-- CreateEnum
CREATE TYPE "Peso" AS ENUM ('Sottile', 'Medio', 'Spesso', 'Variabile');

-- CreateEnum
CREATE TYPE "Curvatura" AS ENUM ('Lineare', 'Curvo', 'Organico', 'Angolare');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "TraitDataType" AS ENUM ('BOOLEAN', 'NUMERIC', 'CATEGORICAL', 'TEXT');

-- CreateEnum
CREATE TYPE "Presence" AS ENUM ('resident', 'migrant', 'introduced', 'endemic', 'unknown');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('keystone', 'dominant', 'engineer', 'common', 'invasive', 'other');

-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "stato" "RecordStato" NOT NULL,
    "descrizione" TEXT,
    "data" DATE,
    "stile" "Stile",
    "pattern" "Pattern",
    "peso" "Peso",
    "curvatura" "Curvatura",
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "user" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trait" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "unit" TEXT,
    "dataType" "TraitDataType" NOT NULL,
    "allowedValues" JSONB,
    "rangeMin" DOUBLE PRECISION,
    "rangeMax" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Biome" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "climate" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Biome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Species" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeciesTrait" (
    "id" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "traitId" TEXT NOT NULL,
    "value" JSONB,
    "num" DOUBLE PRECISION,
    "bool" BOOLEAN,
    "text" TEXT,
    "category" TEXT,
    "unit" TEXT,
    "source" TEXT,
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "SpeciesTrait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeciesBiome" (
    "id" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "biomeId" TEXT NOT NULL,
    "presence" "Presence" NOT NULL,
    "abundance" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "SpeciesBiome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ecosystem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "region" TEXT,
    "climate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ecosystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcosystemBiome" (
    "id" TEXT NOT NULL,
    "ecosystemId" TEXT NOT NULL,
    "biomeId" TEXT NOT NULL,
    "proportion" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "EcosystemBiome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcosystemSpecies" (
    "id" TEXT NOT NULL,
    "ecosystemId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "abundance" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "EcosystemSpecies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Record_nome_idx" ON "Record"("nome");

-- CreateIndex
CREATE INDEX "Record_stato_idx" ON "Record"("stato");

-- CreateIndex
CREATE INDEX "Record_stile_idx" ON "Record"("stile");

-- CreateIndex
CREATE INDEX "Record_pattern_idx" ON "Record"("pattern");

-- CreateIndex
CREATE INDEX "Record_peso_idx" ON "Record"("peso");

-- CreateIndex
CREATE INDEX "Record_curvatura_idx" ON "Record"("curvatura");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Trait_slug_key" ON "Trait"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Biome_slug_key" ON "Biome"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Species_slug_key" ON "Species"("slug");

-- CreateIndex
CREATE INDEX "Species_scientificName_idx" ON "Species"("scientificName");

-- CreateIndex
CREATE INDEX "Species_commonName_idx" ON "Species"("commonName");

-- CreateIndex
CREATE INDEX "SpeciesTrait_traitId_idx" ON "SpeciesTrait"("traitId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesTrait_speciesId_traitId_category_key" ON "SpeciesTrait"("speciesId", "traitId", "category");

-- CreateIndex
CREATE INDEX "SpeciesBiome_biomeId_idx" ON "SpeciesBiome"("biomeId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesBiome_speciesId_biomeId_key" ON "SpeciesBiome"("speciesId", "biomeId");

-- CreateIndex
CREATE UNIQUE INDEX "Ecosystem_slug_key" ON "Ecosystem"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "EcosystemBiome_ecosystemId_biomeId_key" ON "EcosystemBiome"("ecosystemId", "biomeId");

-- CreateIndex
CREATE UNIQUE INDEX "EcosystemSpecies_ecosystemId_speciesId_role_key" ON "EcosystemSpecies"("ecosystemId", "speciesId", "role");

-- AddForeignKey
ALTER TABLE "Biome" ADD CONSTRAINT "Biome_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Biome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesTrait" ADD CONSTRAINT "SpeciesTrait_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesTrait" ADD CONSTRAINT "SpeciesTrait_traitId_fkey" FOREIGN KEY ("traitId") REFERENCES "Trait"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesBiome" ADD CONSTRAINT "SpeciesBiome_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesBiome" ADD CONSTRAINT "SpeciesBiome_biomeId_fkey" FOREIGN KEY ("biomeId") REFERENCES "Biome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcosystemBiome" ADD CONSTRAINT "EcosystemBiome_ecosystemId_fkey" FOREIGN KEY ("ecosystemId") REFERENCES "Ecosystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcosystemBiome" ADD CONSTRAINT "EcosystemBiome_biomeId_fkey" FOREIGN KEY ("biomeId") REFERENCES "Biome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcosystemSpecies" ADD CONSTRAINT "EcosystemSpecies_ecosystemId_fkey" FOREIGN KEY ("ecosystemId") REFERENCES "Ecosystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcosystemSpecies" ADD CONSTRAINT "EcosystemSpecies_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
