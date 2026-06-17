-- AlterTable
ALTER TABLE "Species" ADD COLUMN     "biomeSlugs" JSONB,
ADD COLUMN     "sourceExtras" JSONB,
ADD COLUMN     "sourceFiles" JSONB,
ADD COLUMN     "sourceKey" TEXT;

-- AlterTable
ALTER TABLE "SpeciesVersion" ADD COLUMN     "biomeSlugs" JSONB,
ADD COLUMN     "sourceExtras" JSONB,
ADD COLUMN     "sourceFiles" JSONB,
ADD COLUMN     "sourceKey" TEXT;

