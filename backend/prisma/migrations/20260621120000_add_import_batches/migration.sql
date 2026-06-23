-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "broker" TEXT NOT NULL,
    "filename" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportBatch_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batchId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "externalHash" TEXT NOT NULL,
    "holdingLotId" INTEGER,
    "transactionId" INTEGER,
    CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ImportBatch_accountId_importedAt_idx" ON "ImportBatch"("accountId", "importedAt");

-- CreateIndex
CREATE INDEX "ImportRow_batchId_idx" ON "ImportRow"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_accountId_externalHash_key" ON "ImportRow"("accountId", "externalHash");
