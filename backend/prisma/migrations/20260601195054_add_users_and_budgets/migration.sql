/*
  Warnings:

  - Added the required column `userId` to the `PortfolioPosition` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "category" TEXT,
    "limitAmount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PortfolioPosition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "buyPrice" DECIMAL NOT NULL,
    "currentPrice" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    CONSTRAINT "PortfolioPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PortfolioPosition" ("buyPrice", "category", "currency", "currentPrice", "id", "quantity", "symbol") SELECT "buyPrice", "category", "currency", "currentPrice", "id", "quantity", "symbol" FROM "PortfolioPosition";
DROP TABLE "PortfolioPosition";
ALTER TABLE "new_PortfolioPosition" RENAME TO "PortfolioPosition";
CREATE TABLE "new_Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "category", "currency", "date", "description", "id", "type") SELECT "amount", "category", "currency", "date", "description", "id", "type" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_userId_yearMonth_category_key" ON "Budget"("userId", "yearMonth", "category");
