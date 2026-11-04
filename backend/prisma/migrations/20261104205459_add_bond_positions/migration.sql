-- CreateTable
CREATE TABLE "BondPosition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "seriesCode" TEXT NOT NULL,
    "issuer" TEXT NOT NULL DEFAULT 'SKARB_PANSTWA',
    "quantity" DECIMAL NOT NULL,
    "unitNominal" DECIMAL NOT NULL DEFAULT 100,
    "unitPurchasePrice" DECIMAL NOT NULL,
    "purchasedAt" DATETIME NOT NULL,
    "rateKind" TEXT NOT NULL,
    "currentAnnualRatePct" DECIMAL NOT NULL,
    "couponFrequency" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "maturityDate" DATETIME NOT NULL,
    "earlyExitFeePerUnit" DECIMAL NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BondPosition_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BondPosition_accountId_idx" ON "BondPosition"("accountId");

-- CreateIndex
CREATE INDEX "BondPosition_accountId_maturityDate_idx" ON "BondPosition"("accountId", "maturityDate");
