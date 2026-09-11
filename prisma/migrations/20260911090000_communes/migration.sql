-- AlterTable
ALTER TABLE "User" ADD COLUMN     "communeCode" TEXT;

-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "communeCode" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "communeCode" TEXT;

-- CreateTable
CREATE TABLE "Commune" (
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "nomRecherche" TEXT NOT NULL,
    "codePostal" TEXT,
    "departement" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Commune_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "Commune_nomRecherche_idx" ON "Commune"("nomRecherche");

-- CreateIndex
CREATE INDEX "Commune_latitude_longitude_idx" ON "Commune"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "User_communeCode_idx" ON "User"("communeCode");

-- CreateIndex
CREATE INDEX "Club_communeCode_idx" ON "Club"("communeCode");

-- CreateIndex
CREATE INDEX "Event_communeCode_idx" ON "Event"("communeCode");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_communeCode_fkey" FOREIGN KEY ("communeCode") REFERENCES "Commune"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_communeCode_fkey" FOREIGN KEY ("communeCode") REFERENCES "Commune"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_communeCode_fkey" FOREIGN KEY ("communeCode") REFERENCES "Commune"("code") ON DELETE SET NULL ON UPDATE CASCADE;

