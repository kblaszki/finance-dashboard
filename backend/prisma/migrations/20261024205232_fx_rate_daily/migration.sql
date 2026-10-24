-- CreateTable
CREATE TABLE "FxRateDaily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rateDate" DATETIME NOT NULL,
    "currency" TEXT NOT NULL,
    "mid" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "FxRateDaily_currency_rateDate_idx" ON "FxRateDaily"("currency", "rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "FxRateDaily_rateDate_currency_key" ON "FxRateDaily"("rateDate", "currency");
