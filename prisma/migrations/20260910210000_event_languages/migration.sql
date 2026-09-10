-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "languages" "Locale"[] DEFAULT ARRAY['FR']::"Locale"[];
