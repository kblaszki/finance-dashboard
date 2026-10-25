-- CreateTable
CREATE TABLE "CategoryDescriptionRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "pattern" TEXT NOT NULL,
    "patternKey" TEXT NOT NULL,
    "ledgerType" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CategoryDescriptionRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CategoryDescriptionRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CategoryDescriptionRule_userId_ledgerType_idx" ON "CategoryDescriptionRule"("userId", "ledgerType");

-- CreateIndex
CREATE INDEX "CategoryDescriptionRule_categoryId_idx" ON "CategoryDescriptionRule"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryDescriptionRule_userId_ledgerType_patternKey_key" ON "CategoryDescriptionRule"("userId", "ledgerType", "patternKey");
