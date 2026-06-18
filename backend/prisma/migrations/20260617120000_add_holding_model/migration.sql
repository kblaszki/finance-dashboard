-- CreateTable
CREATE TABLE "Holding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "instrumentId" INTEGER NOT NULL,
    "quantity" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Holding_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Backfill holdings from existing lots
INSERT INTO "Holding" ("accountId", "instrumentId", "quantity", "createdAt", "updatedAt")
SELECT
    hl."accountId",
    hl."instrumentId",
    (
        SELECT hl2."quantityAfter"
        FROM "HoldingLot" hl2
        WHERE hl2."accountId" = hl."accountId" AND hl2."instrumentId" = hl."instrumentId"
        ORDER BY hl2."tradeDate" DESC, hl2."id" DESC
        LIMIT 1
    ),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "HoldingLot" hl
GROUP BY hl."accountId", hl."instrumentId";

CREATE UNIQUE INDEX "Holding_accountId_instrumentId_key" ON "Holding"("accountId", "instrumentId");
CREATE INDEX "Holding_accountId_idx" ON "Holding"("accountId");

-- Recreate HoldingLot with holdingId
CREATE TABLE "new_HoldingLot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "holdingId" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "quantityAfter" DECIMAL NOT NULL,
    "totalPrice" DECIMAL,
    "pricePerUnit" DECIMAL,
    "currency" TEXT NOT NULL,
    "tradeDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HoldingLot_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_HoldingLot" ("id", "holdingId", "side", "quantity", "quantityAfter", "totalPrice", "pricePerUnit", "currency", "tradeDate", "createdAt")
SELECT
    hl."id",
    h."id",
    hl."side",
    hl."quantity",
    hl."quantityAfter",
    hl."totalPrice",
    hl."pricePerUnit",
    hl."currency",
    hl."tradeDate",
    hl."createdAt"
FROM "HoldingLot" hl
INNER JOIN "Holding" h ON h."accountId" = hl."accountId" AND h."instrumentId" = hl."instrumentId";

DROP TABLE "HoldingLot";
ALTER TABLE "new_HoldingLot" RENAME TO "HoldingLot";

CREATE INDEX "HoldingLot_holdingId_tradeDate_idx" ON "HoldingLot"("holdingId", "tradeDate");

DROP INDEX IF EXISTS "HoldingLot_accountId_instrumentId_tradeDate_idx";
