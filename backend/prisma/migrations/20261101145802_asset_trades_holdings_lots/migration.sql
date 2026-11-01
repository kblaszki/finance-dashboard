-- CreateTable
CREATE TABLE "Holding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "instrumentId" INTEGER NOT NULL,
    "quantity" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Holding_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "holdingId" INTEGER NOT NULL,
    "openTradeId" INTEGER,
    "openedAt" DATETIME NOT NULL,
    "quantityOpen" DECIMAL NOT NULL,
    "quantityClosed" DECIMAL NOT NULL DEFAULT 0,
    "unitCost" DECIMAL NOT NULL,
    "commissionOpen" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lot_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lot_openTradeId_fkey" FOREIGN KEY ("openTradeId") REFERENCES "AssetTrade" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetTrade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "instrumentId" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unitPrice" DECIMAL NOT NULL,
    "commission" DECIMAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settlementDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetTrade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssetTrade_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CashTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "categoryId" INTEGER,
    "transferId" INTEGER,
    "assetTradeId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashTransaction_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "CashTransfer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashTransaction_assetTradeId_fkey" FOREIGN KEY ("assetTradeId") REFERENCES "AssetTrade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CashTransaction" ("accountId", "amount", "categoryId", "createdAt", "description", "id", "occurredAt", "transferId", "type") SELECT "accountId", "amount", "categoryId", "createdAt", "description", "id", "occurredAt", "transferId", "type" FROM "CashTransaction";
DROP TABLE "CashTransaction";
ALTER TABLE "new_CashTransaction" RENAME TO "CashTransaction";
CREATE INDEX "CashTransaction_accountId_occurredAt_idx" ON "CashTransaction"("accountId", "occurredAt");
CREATE INDEX "CashTransaction_categoryId_idx" ON "CashTransaction"("categoryId");
CREATE INDEX "CashTransaction_transferId_idx" ON "CashTransaction"("transferId");
CREATE INDEX "CashTransaction_assetTradeId_idx" ON "CashTransaction"("assetTradeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Holding_accountId_idx" ON "Holding"("accountId");

-- CreateIndex
CREATE INDEX "Holding_instrumentId_idx" ON "Holding"("instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_accountId_instrumentId_key" ON "Holding"("accountId", "instrumentId");

-- CreateIndex
CREATE INDEX "Lot_holdingId_openedAt_idx" ON "Lot"("holdingId", "openedAt");

-- CreateIndex
CREATE INDEX "Lot_openTradeId_idx" ON "Lot"("openTradeId");

-- CreateIndex
CREATE INDEX "AssetTrade_accountId_occurredAt_idx" ON "AssetTrade"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "AssetTrade_instrumentId_idx" ON "AssetTrade"("instrumentId");
