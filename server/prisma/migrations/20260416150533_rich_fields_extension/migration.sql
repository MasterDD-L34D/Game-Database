-- AlterTable
ALTER TABLE "Biome" ADD COLUMN     "climateTags" JSONB,
ADD COLUMN     "ecology" JSONB,
ADD COLUMN     "hazard" JSONB,
ADD COLUMN     "roleTemplates" JSONB,
ADD COLUMN     "sizeMax" INTEGER,
ADD COLUMN     "sizeMin" INTEGER,
ADD COLUMN     "summary" TEXT;

-- AlterTable
ALTER TABLE "Species" ADD COLUMN     "balance" JSONB,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "environmentAffinity" JSONB,
ADD COLUMN     "flags" JSONB,
ADD COLUMN     "functionalTags" JSONB,
ADD COLUMN     "jobsBias" JSONB,
ADD COLUMN     "morphotype" TEXT,
ADD COLUMN     "playableUnit" BOOLEAN,
ADD COLUMN     "spawnRules" JSONB,
ADD COLUMN     "telemetry" JSONB,
ADD COLUMN     "trophicRole" TEXT,
ADD COLUMN     "vcCoefficients" JSONB;

-- AlterTable
ALTER TABLE "Trait" ADD COLUMN     "conflicts" JSONB,
ADD COLUMN     "energyMaintenance" TEXT,
ADD COLUMN     "environmentalRequirements" JSONB,
ADD COLUMN     "familyType" TEXT,
ADD COLUMN     "functionalUse" TEXT,
ADD COLUMN     "inducedMutation" TEXT,
ADD COLUMN     "selectiveDrive" TEXT,
ADD COLUMN     "slotProfile" JSONB,
ADD COLUMN     "synergies" JSONB,
ADD COLUMN     "tier" TEXT,
ADD COLUMN     "usageTags" JSONB,
ADD COLUMN     "weakness" TEXT;
