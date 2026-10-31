-- AlterTable
ALTER TABLE "Instrument" ADD COLUMN "allowlisted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Instrument_allowlisted_symbol_idx" ON "Instrument"("allowlisted", "symbol");

-- CreateIndex
CREATE INDEX "Instrument_allowlisted_name_idx" ON "Instrument"("allowlisted", "name");
