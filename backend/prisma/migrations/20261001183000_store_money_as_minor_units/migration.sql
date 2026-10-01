-- Store cash amounts as integer minor units (cents).
-- SQLite NUMERIC affinity stored Prisma DECIMAL as REAL, so cent increments drifted.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Account" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "accountType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "cashBalance" INTEGER NOT NULL DEFAULT 0,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "openingCashAsOf" DATETIME,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Account" ("id", "userId", "accountType", "name", "currency", "cashBalance", "openingBalance", "openingCashAsOf", "description", "createdAt", "updatedAt")
SELECT "id", "userId", "accountType", "name", "currency",
       CAST(ROUND("cashBalance" * 100) AS INTEGER),
       CAST(ROUND("openingBalance" * 100) AS INTEGER),
       "openingCashAsOf", "description", "createdAt", "updatedAt"
FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE INDEX "Account_userId_accountType_idx" ON "Account"("userId", "accountType");
CREATE UNIQUE INDEX "Account_userId_name_key" ON "Account"("userId", "name");

CREATE TABLE "new_CashTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "categoryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CashTransaction" ("id", "accountId", "type", "amount", "occurredAt", "description", "categoryId", "createdAt")
SELECT "id", "accountId", "type",
       CAST(ROUND("amount" * 100) AS INTEGER),
       "occurredAt", "description", "categoryId", "createdAt"
FROM "CashTransaction";
DROP TABLE "CashTransaction";
ALTER TABLE "new_CashTransaction" RENAME TO "CashTransaction";
CREATE INDEX "CashTransaction_accountId_occurredAt_idx" ON "CashTransaction"("accountId", "occurredAt");
CREATE INDEX "CashTransaction_categoryId_idx" ON "CashTransaction"("categoryId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
