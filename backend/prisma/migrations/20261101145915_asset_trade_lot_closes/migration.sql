-- CreateTable
CREATE TABLE "LotClose" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lotId" INTEGER NOT NULL,
    "tradeId" INTEGER NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LotClose_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LotClose_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "AssetTrade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LotClose_lotId_idx" ON "LotClose"("lotId");

-- CreateIndex
CREATE INDEX "LotClose_tradeId_idx" ON "LotClose"("tradeId");
