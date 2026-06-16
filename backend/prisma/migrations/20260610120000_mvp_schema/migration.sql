-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Account" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "accountType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "cashBalance" DECIMAL NOT NULL DEFAULT 0,
    "openingBalance" DECIMAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "transactionType" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "balanceAfter" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Instrument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instrumentType" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "exchange" TEXT,
    "currency" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "HoldingLot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "instrumentId" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "quantityAfter" DECIMAL NOT NULL,
    "totalPrice" DECIMAL,
    "pricePerUnit" DECIMAL,
    "currency" TEXT NOT NULL,
    "tradeDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HoldingLot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HoldingLot_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "InstrumentValuation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instrumentId" INTEGER NOT NULL,
    "valuationDate" DATETIME NOT NULL,
    "price" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstrumentValuation_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AccountValuationDaily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "valuationDate" DATETIME NOT NULL,
    "totalValue" DECIMAL NOT NULL,
    "cashValue" DECIMAL NOT NULL,
    "securitiesValue" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    CONSTRAINT "AccountValuationDaily_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "HoldingValuationDaily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "instrumentId" INTEGER NOT NULL,
    "valuationDate" DATETIME NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "marketValue" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    CONSTRAINT "HoldingValuationDaily_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HoldingValuationDaily_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "Account_userId_name_key" ON "Account"("userId", "name");
CREATE INDEX "Account_userId_accountType_idx" ON "Account"("userId", "accountType");
CREATE INDEX "Transaction_accountId_date_idx" ON "Transaction"("accountId", "date");
CREATE UNIQUE INDEX "Instrument_symbol_exchange_source_key" ON "Instrument"("symbol", "exchange", "source");
CREATE INDEX "Instrument_symbol_idx" ON "Instrument"("symbol");
CREATE INDEX "HoldingLot_accountId_instrumentId_tradeDate_idx" ON "HoldingLot"("accountId", "instrumentId", "tradeDate");
CREATE UNIQUE INDEX "InstrumentValuation_instrumentId_valuationDate_source_key" ON "InstrumentValuation"("instrumentId", "valuationDate", "source");
CREATE INDEX "InstrumentValuation_instrumentId_valuationDate_idx" ON "InstrumentValuation"("instrumentId", "valuationDate");
CREATE UNIQUE INDEX "AccountValuationDaily_accountId_valuationDate_key" ON "AccountValuationDaily"("accountId", "valuationDate");
CREATE INDEX "AccountValuationDaily_accountId_valuationDate_idx" ON "AccountValuationDaily"("accountId", "valuationDate");
CREATE UNIQUE INDEX "HoldingValuationDaily_accountId_instrumentId_valuationDate_key" ON "HoldingValuationDaily"("accountId", "instrumentId", "valuationDate");
CREATE INDEX "HoldingValuationDaily_accountId_instrumentId_valuationDate_idx" ON "HoldingValuationDaily"("accountId", "instrumentId", "valuationDate");
