-- CreateTable
CREATE TABLE "PortfolioLot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "buyPrice" DECIMAL NOT NULL,
    "buyDate" DATETIME NOT NULL,
    "currency" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioLot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketPriceHistory" (
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
CREATE INDEX "PortfolioLot_userId_symbol_idx" ON "PortfolioLot"("userId", "symbol");

-- CreateIndex
CREATE INDEX "MarketPriceHistory_symbol_priceDate_idx" ON "MarketPriceHistory"("symbol", "priceDate");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPriceHistory_symbol_priceDate_source_key" ON "MarketPriceHistory"("symbol", "priceDate", "source");
