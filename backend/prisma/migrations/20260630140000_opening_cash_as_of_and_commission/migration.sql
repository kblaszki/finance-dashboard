-- AlterTable
ALTER TABLE "Account" ADD COLUMN "openingCashAsOf" DATETIME;

-- AlterTable
ALTER TABLE "HoldingLot" ADD COLUMN "commission" DECIMAL NOT NULL DEFAULT 0;
