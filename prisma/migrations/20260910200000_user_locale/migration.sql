-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('FR', 'EN');
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" "Locale" NOT NULL DEFAULT 'FR';
