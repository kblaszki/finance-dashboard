-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "openingBalance" DECIMAL NOT NULL DEFAULT 0,
    "manualValue" DECIMAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BondHolding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "series" TEXT NOT NULL,
    "nominal" DECIMAL NOT NULL,
    "purchaseDate" DATETIME NOT NULL,
    "currency" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BondHolding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "categoryId" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN "accountId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_userId_name_key" ON "FinancialAccount"("userId", "name");
CREATE INDEX "FinancialAccount_userId_type_idx" ON "FinancialAccount"("userId", "type");
CREATE UNIQUE INDEX "Category_userId_parentId_name_kind_key" ON "Category"("userId", "parentId", "name", "kind");
CREATE INDEX "Category_userId_kind_idx" ON "Category"("userId", "kind");
CREATE INDEX "BondHolding_accountId_idx" ON "BondHolding"("accountId");
CREATE INDEX "Transaction_userId_accountId_idx" ON "Transaction"("userId", "accountId");
CREATE INDEX "Transaction_userId_categoryId_idx" ON "Transaction"("userId", "categoryId");
