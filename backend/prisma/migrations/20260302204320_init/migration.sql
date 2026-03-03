-- CreateTable
CREATE TABLE "Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "PortfolioPosition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "buyPrice" DECIMAL NOT NULL,
    "currentPrice" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "category" TEXT NOT NULL
);
