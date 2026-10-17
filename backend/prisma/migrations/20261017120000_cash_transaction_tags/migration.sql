-- CreateTable
CREATE TABLE "Tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashTransactionTag" (
    "cashTransactionId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    CONSTRAINT "CashTransactionTag_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashTransactionTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("cashTransactionId", "tagId")
);

-- CreateIndex
CREATE INDEX "Tag_userId_idx" ON "Tag"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_userId_nameKey_key" ON "Tag"("userId", "nameKey");

-- CreateIndex
CREATE INDEX "CashTransactionTag_tagId_idx" ON "CashTransactionTag"("tagId");
