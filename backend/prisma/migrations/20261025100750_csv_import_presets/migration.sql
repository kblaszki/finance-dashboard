-- CreateTable
CREATE TABLE "CsvImportPreset" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "mappingJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CsvImportPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CsvImportPreset_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CsvImportPreset_userId_idx" ON "CsvImportPreset"("userId");

-- CreateIndex
CREATE INDEX "CsvImportPreset_accountId_idx" ON "CsvImportPreset"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "CsvImportPreset_accountId_nameKey_key" ON "CsvImportPreset"("accountId", "nameKey");
