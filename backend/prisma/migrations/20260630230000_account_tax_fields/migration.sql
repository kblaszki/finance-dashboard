-- AlterTable
ALTER TABLE "Account" ADD COLUMN "taxWrapperType" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "Account" ADD COLUMN "rentalTaxMethod" TEXT;
