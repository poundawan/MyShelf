-- AlterTable
ALTER TABLE "Commune" ADD COLUMN     "pays" TEXT NOT NULL DEFAULT 'FR';

-- CreateIndex
CREATE INDEX "Commune_pays_idx" ON "Commune"("pays");

