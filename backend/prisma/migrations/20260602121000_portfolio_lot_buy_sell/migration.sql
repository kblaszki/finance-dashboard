PRAGMA foreign_keys=OFF;

CREATE TABLE "new_PortfolioLot" (
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
    CONSTRAINT "PortfolioLot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_PortfolioLot" ("id","userId","side","symbol","quantity","tradePrice","tradeDate","currency","category","createdAt")
SELECT "id","userId",'BUY',"symbol","quantity","buyPrice","buyDate","currency","category","createdAt"
FROM "PortfolioLot";

DROP TABLE "PortfolioLot";
ALTER TABLE "new_PortfolioLot" RENAME TO "PortfolioLot";

CREATE INDEX "PortfolioLot_userId_symbol_idx" ON "PortfolioLot"("userId", "symbol");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
