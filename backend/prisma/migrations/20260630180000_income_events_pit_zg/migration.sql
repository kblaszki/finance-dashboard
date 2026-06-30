-- CreateTable
CREATE TABLE "IncomeEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "instrumentId" INTEGER,
    "eventType" TEXT NOT NULL,
    "taxType" TEXT,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "occurredOn" DATETIME NOT NULL,
    "description" TEXT,
    "withheldTax" DECIMAL NOT NULL DEFAULT 0,
    "sourceCountry" TEXT,
    "foreignTaxPaid" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncomeEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IncomeEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IncomeEvent_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Instrument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instrumentType" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "exchange" TEXT,
    "currency" TEXT NOT NULL,
    "pitZgCountry" TEXT NOT NULL DEFAULT 'PL',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Instrument" ("id", "instrumentType", "symbol", "name", "exchange", "currency", "source", "createdAt", "pitZgCountry")
SELECT "id", "instrumentType", "symbol", "name", "exchange", "currency", "source", "createdAt", 'PL' FROM "Instrument";
DROP TABLE "Instrument";
ALTER TABLE "new_Instrument" RENAME TO "Instrument";
CREATE UNIQUE INDEX "Instrument_symbol_exchange_source_key" ON "Instrument"("symbol", "exchange", "source");
CREATE INDEX "Instrument_symbol_idx" ON "Instrument"("symbol");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "IncomeEvent_userId_occurredOn_idx" ON "IncomeEvent"("userId", "occurredOn");
CREATE INDEX "IncomeEvent_accountId_occurredOn_idx" ON "IncomeEvent"("accountId", "occurredOn");
