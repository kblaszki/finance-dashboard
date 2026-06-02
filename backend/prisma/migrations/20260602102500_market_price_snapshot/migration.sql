-- CreateTable
CREATE TABLE "MarketPriceSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT,
    "currency" TEXT NOT NULL,
    "close" DECIMAL NOT NULL,
    "priceDate" DATETIME NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "MarketPriceSnapshot_symbol_priceDate_idx" ON "MarketPriceSnapshot"("symbol", "priceDate");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPriceSnapshot_symbol_priceDate_source_key" ON "MarketPriceSnapshot"("symbol", "priceDate", "source");
