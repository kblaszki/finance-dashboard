PRAGMA foreign_keys=OFF;

CREATE TABLE "PortfolioTrade" (
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
    CONSTRAINT "PortfolioTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "PortfolioTrade" ("id","userId","side","symbol","quantity","tradePrice","tradeDate","currency","category","createdAt")
SELECT "id","userId","side","symbol","quantity","tradePrice","tradeDate","currency","category","createdAt"
FROM "PortfolioLot";

DROP TABLE "PortfolioLot";
CREATE INDEX "PortfolioTrade_userId_symbol_idx" ON "PortfolioTrade"("userId", "symbol");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
