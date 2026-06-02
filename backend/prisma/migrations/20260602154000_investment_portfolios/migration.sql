PRAGMA foreign_keys=OFF;

CREATE TABLE "InvestmentPortfolio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "cashBalance" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvestmentPortfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InvestmentPortfolio_userId_name_key" ON "InvestmentPortfolio"("userId","name");
CREATE INDEX "InvestmentPortfolio_userId_baseCurrency_idx" ON "InvestmentPortfolio"("userId","baseCurrency");

ALTER TABLE "Transaction" ADD COLUMN "portfolioId" INTEGER REFERENCES "InvestmentPortfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Transaction_userId_portfolioId_idx" ON "Transaction"("userId","portfolioId");

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
    "portfolioId" INTEGER NOT NULL,
    CONSTRAINT "PortfolioTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PortfolioTrade_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "InvestmentPortfolio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "InvestmentPortfolio" ("userId","name","baseCurrency","cashBalance","createdAt","updatedAt")
SELECT DISTINCT pt."userId", 'Domyślny', COALESCE(pt."currency",'PLN'), 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "PortfolioTrade" pt;

INSERT INTO "new_PortfolioTrade" ("id","userId","side","symbol","quantity","tradePrice","tradeDate","currency","category","createdAt","portfolioId")
SELECT pt."id", pt."userId", pt."side", pt."symbol", pt."quantity", pt."tradePrice", pt."tradeDate", pt."currency", pt."category", pt."createdAt", ip."id"
FROM "PortfolioTrade" pt
JOIN "InvestmentPortfolio" ip ON ip."userId" = pt."userId" AND ip."name" = 'Domyślny';

DROP TABLE "PortfolioTrade";
ALTER TABLE "new_PortfolioTrade" RENAME TO "PortfolioTrade";
CREATE INDEX "PortfolioTrade_userId_portfolioId_symbol_idx" ON "PortfolioTrade"("userId","portfolioId","symbol");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
