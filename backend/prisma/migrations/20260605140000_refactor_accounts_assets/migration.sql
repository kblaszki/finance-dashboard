-- Drop budgets
DROP TABLE IF EXISTS "Budget";

-- New account model
CREATE TABLE "Account" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BankAccountDetails" (
    "accountId" INTEGER NOT NULL PRIMARY KEY,
    "openingBalance" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "BankAccountDetails_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BrokerageAccountDetails" (
    "accountId" INTEGER NOT NULL PRIMARY KEY,
    "baseCurrency" TEXT NOT NULL,
    "cashBalance" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "BrokerageAccountDetails_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AccountBalanceDaily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "balanceDate" DATETIME NOT NULL,
    "balance" DECIMAL NOT NULL,
    "cashComponent" DECIMAL,
    "securitiesComponent" DECIMAL,
    "currency" TEXT NOT NULL,
    CONSTRAINT "AccountBalanceDaily_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AccountBalanceDaily_accountId_balanceDate_key" ON "AccountBalanceDaily"("accountId", "balanceDate");
CREATE INDEX "AccountBalanceDaily_accountId_balanceDate_idx" ON "AccountBalanceDaily"("accountId", "balanceDate");
CREATE UNIQUE INDEX "Account_userId_name_key" ON "Account"("userId", "name");
CREATE INDEX "Account_userId_type_idx" ON "Account"("userId", "type");

-- Asset catalog
CREATE TABLE "Asset" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "assetType" TEXT NOT NULL DEFAULT 'STOCK',
    "currency" TEXT NOT NULL,
    "exchange" TEXT,
    "source" TEXT NOT NULL DEFAULT 'twelve_data',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "MarketPriceDaily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assetId" INTEGER NOT NULL,
    "close" DECIMAL NOT NULL,
    "priceDate" DATETIME NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    CONSTRAINT "MarketPriceDaily_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Asset_symbol_exchange_source_key" ON "Asset"("symbol", "exchange", "source");
CREATE INDEX "Asset_symbol_idx" ON "Asset"("symbol");
CREATE UNIQUE INDEX "MarketPriceDaily_assetId_priceDate_source_key" ON "MarketPriceDaily"("assetId", "priceDate", "source");
CREATE INDEX "MarketPriceDaily_assetId_priceDate_idx" ON "MarketPriceDaily"("assetId", "priceDate");

-- Migrate BANK financial accounts to Account
INSERT INTO "Account" ("userId", "type", "name", "currency", "notes", "createdAt", "updatedAt")
SELECT "userId", 'BANK', "name", "currency", "notes", "createdAt", "updatedAt"
FROM "FinancialAccount"
WHERE "type" = 'BANK';

INSERT INTO "BankAccountDetails" ("accountId", "openingBalance")
SELECT a."id", fa."openingBalance"
FROM "FinancialAccount" fa
JOIN "Account" a ON a."userId" = fa."userId" AND a."name" = fa."name" AND a."type" = 'BANK'
WHERE fa."type" = 'BANK';

-- Migrate investment portfolios to Account
INSERT INTO "Account" ("userId", "type", "name", "currency", "notes", "createdAt", "updatedAt")
SELECT "userId", 'BROKERAGE', "name", "baseCurrency", NULL, "createdAt", "updatedAt"
FROM "InvestmentPortfolio";

INSERT INTO "BrokerageAccountDetails" ("accountId", "baseCurrency", "cashBalance")
SELECT a."id", ip."baseCurrency", ip."cashBalance"
FROM "InvestmentPortfolio" ip
JOIN "Account" a ON a."userId" = ip."userId" AND a."name" = ip."name" AND a."type" = 'BROKERAGE';

-- Transaction schema: legacy bank FK + unified account FK
CREATE TABLE "new_Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "categoryId" INTEGER,
    "date" DATETIME NOT NULL,
    "description" TEXT,
    "accountId" INTEGER,
    "legacyFinancialAccountId" INTEGER,
    "importHash" TEXT,
    CONSTRAINT "new_Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "new_Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "new_Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "new_Transaction_legacyFinancialAccountId_fkey" FOREIGN KEY ("legacyFinancialAccountId") REFERENCES "FinancialAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Transaction" ("id", "userId", "type", "amount", "currency", "category", "categoryId", "date", "description", "accountId", "legacyFinancialAccountId", "importHash")
SELECT
    t."id",
    t."userId",
    t."type",
    t."amount",
    t."currency",
    t."category",
    t."categoryId",
    t."date",
    t."description",
    CASE
        WHEN t."portfolioId" IS NOT NULL THEN (
            SELECT a."id" FROM "Account" a
            JOIN "InvestmentPortfolio" ip ON ip."id" = t."portfolioId"
            WHERE a."userId" = ip."userId" AND a."name" = ip."name" AND a."type" = 'BROKERAGE'
        )
        WHEN t."accountId" IS NOT NULL AND fa."type" = 'BANK' THEN (
            SELECT a."id" FROM "Account" a
            WHERE a."userId" = fa."userId" AND a."name" = fa."name" AND a."type" = 'BANK'
        )
        ELSE NULL
    END,
    CASE WHEN fa."type" IS NOT NULL AND fa."type" != 'BANK' THEN t."accountId" ELSE NULL END,
    t."importHash"
FROM "Transaction" t
LEFT JOIN "FinancialAccount" fa ON fa."id" = t."accountId";

DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE UNIQUE INDEX "Transaction_userId_importHash_key" ON "Transaction"("userId", "importHash");
CREATE INDEX "Transaction_userId_accountId_idx" ON "Transaction"("userId", "accountId");
CREATE INDEX "Transaction_userId_categoryId_idx" ON "Transaction"("userId", "categoryId");
CREATE INDEX "Transaction_userId_legacyFinancialAccountId_idx" ON "Transaction"("userId", "legacyFinancialAccountId");

-- PortfolioTrade: portfolioId -> accountId, add assetId
CREATE TABLE "new_PortfolioTrade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "side" TEXT NOT NULL DEFAULT 'BUY',
    "symbol" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "tradePrice" DECIMAL NOT NULL,
    "tradeDate" DATETIME NOT NULL,
    "currency" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" INTEGER NOT NULL,
    "assetId" INTEGER,
    CONSTRAINT "new_PortfolioTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "new_PortfolioTrade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "new_PortfolioTrade_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_PortfolioTrade" ("id", "userId", "side", "symbol", "quantity", "tradePrice", "tradeDate", "currency", "category", "createdAt", "accountId", "assetId")
SELECT
    pt."id",
    pt."userId",
    pt."side",
    pt."symbol",
    pt."quantity",
    pt."tradePrice",
    pt."tradeDate",
    pt."currency",
    pt."category",
    pt."createdAt",
    (
        SELECT a."id" FROM "Account" a
        JOIN "InvestmentPortfolio" ip ON ip."id" = pt."portfolioId"
        WHERE a."userId" = ip."userId" AND a."name" = ip."name" AND a."type" = 'BROKERAGE'
    ),
    NULL
FROM "PortfolioTrade" pt;

DROP TABLE "PortfolioTrade";
ALTER TABLE "new_PortfolioTrade" RENAME TO "PortfolioTrade";
CREATE INDEX "PortfolioTrade_userId_accountId_symbol_idx" ON "PortfolioTrade"("userId", "accountId", "symbol");
CREATE INDEX "PortfolioTrade_assetId_idx" ON "PortfolioTrade"("assetId");

-- Assets from distinct symbols
INSERT INTO "Asset" ("symbol", "assetType", "currency", "exchange", "source")
SELECT DISTINCT UPPER("symbol"), 'STOCK', "currency", NULL, 'twelve_data'
FROM "PortfolioTrade";

UPDATE "PortfolioTrade"
SET "assetId" = (
    SELECT "id" FROM "Asset" WHERE "symbol" = UPPER("PortfolioTrade"."symbol") AND "exchange" IS NULL AND "source" = 'twelve_data'
);

-- Migrate market price history
INSERT INTO "Asset" ("symbol", "assetType", "currency", "exchange", "source")
SELECT DISTINCT UPPER(h."symbol"), 'STOCK', h."currency", h."exchange", h."source"
FROM "MarketPriceHistory" h
WHERE NOT EXISTS (
    SELECT 1 FROM "Asset" a
    WHERE a."symbol" = UPPER(h."symbol")
      AND (a."exchange" IS h."exchange" OR (a."exchange" IS NULL AND h."exchange" IS NULL))
      AND a."source" = h."source"
);

INSERT INTO "MarketPriceDaily" ("assetId", "close", "priceDate", "fetchedAt", "source")
SELECT a."id", h."close", h."priceDate", h."fetchedAt", h."source"
FROM "MarketPriceHistory" h
JOIN "Asset" a ON a."symbol" = UPPER(h."symbol")
  AND (a."exchange" IS h."exchange" OR (a."exchange" IS NULL AND h."exchange" IS NULL))
  AND a."source" = h."source";

DROP TABLE IF EXISTS "MarketPriceSnapshot";
DROP TABLE IF EXISTS "MarketPriceHistory";
DROP TABLE "InvestmentPortfolio";
