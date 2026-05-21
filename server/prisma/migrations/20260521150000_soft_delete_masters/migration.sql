-- AlterTable
ALTER TABLE "Trait" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Biome" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Species" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Ecosystem" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Trait_deletedAt_idx" ON "Trait"("deletedAt");

-- CreateIndex
CREATE INDEX "Biome_deletedAt_idx" ON "Biome"("deletedAt");

-- CreateIndex
CREATE INDEX "Species_deletedAt_idx" ON "Species"("deletedAt");

-- CreateIndex
CREATE INDEX "Ecosystem_deletedAt_idx" ON "Ecosystem"("deletedAt");
