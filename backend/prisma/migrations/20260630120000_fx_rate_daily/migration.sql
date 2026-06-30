-- CreateTable
CREATE TABLE "FxRateDaily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rateDate" DATETIME NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nbp'
);

-- CreateIndex
CREATE INDEX "FxRateDaily_rateDate_baseCurrency_quoteCurrency_idx" ON "FxRateDaily"("rateDate", "baseCurrency", "quoteCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "FxRateDaily_rateDate_baseCurrency_quoteCurrency_source_key" ON "FxRateDaily"("rateDate", "baseCurrency", "quoteCurrency", "source");
