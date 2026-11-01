-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LotClose" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lotId" INTEGER NOT NULL,
    "tradeId" INTEGER NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "commissionAllocated" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LotClose_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LotClose_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "AssetTrade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LotClose" ("createdAt", "id", "lotId", "quantity", "tradeId") SELECT "createdAt", "id", "lotId", "quantity", "tradeId" FROM "LotClose";
DROP TABLE "LotClose";
ALTER TABLE "new_LotClose" RENAME TO "LotClose";
CREATE INDEX "LotClose_lotId_idx" ON "LotClose"("lotId");
CREATE INDEX "LotClose_tradeId_idx" ON "LotClose"("tradeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
