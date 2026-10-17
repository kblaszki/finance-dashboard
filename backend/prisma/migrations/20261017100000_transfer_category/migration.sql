-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CashTransfer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "fromAccountId" INTEGER NOT NULL,
    "toAccountId" INTEGER NOT NULL,
    "amountFrom" INTEGER NOT NULL,
    "amountTo" INTEGER NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "categoryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CashTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CashTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CashTransfer_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CashTransfer" ("id", "userId", "fromAccountId", "toAccountId", "amountFrom", "amountTo", "occurredAt", "description", "createdAt", "updatedAt") SELECT "id", "userId", "fromAccountId", "toAccountId", "amountFrom", "amountTo", "occurredAt", "description", "createdAt", "updatedAt" FROM "CashTransfer";
DROP TABLE "CashTransfer";
ALTER TABLE "new_CashTransfer" RENAME TO "CashTransfer";
CREATE INDEX "CashTransfer_userId_occurredAt_idx" ON "CashTransfer"("userId", "occurredAt");
CREATE INDEX "CashTransfer_fromAccountId_idx" ON "CashTransfer"("fromAccountId");
CREATE INDEX "CashTransfer_toAccountId_idx" ON "CashTransfer"("toAccountId");
CREATE INDEX "CashTransfer_categoryId_idx" ON "CashTransfer"("categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
