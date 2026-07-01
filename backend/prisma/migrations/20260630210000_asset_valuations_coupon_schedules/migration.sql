-- CreateTable
CREATE TABLE "AssetValuation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "accountId" INTEGER,
    "instrumentId" INTEGER,
    "valuedOn" DATETIME NOT NULL,
    "value" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetValuation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetValuation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetValuation_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CouponSchedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "instrumentId" INTEGER NOT NULL,
    "scheduleType" TEXT NOT NULL,
    "paymentOn" DATETIME NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT,
    "incomeEventId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CouponSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CouponSchedule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CouponSchedule_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CouponSchedule_incomeEventId_fkey" FOREIGN KEY ("incomeEventId") REFERENCES "IncomeEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AssetValuation_userId_accountId_valuedOn_idx" ON "AssetValuation"("userId", "accountId", "valuedOn");

-- CreateIndex
CREATE INDEX "AssetValuation_userId_instrumentId_valuedOn_idx" ON "AssetValuation"("userId", "instrumentId", "valuedOn");

-- CreateIndex
CREATE INDEX "CouponSchedule_userId_paymentOn_idx" ON "CouponSchedule"("userId", "paymentOn");

-- CreateIndex
CREATE INDEX "CouponSchedule_accountId_instrumentId_idx" ON "CouponSchedule"("accountId", "instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "CouponSchedule_incomeEventId_key" ON "CouponSchedule"("incomeEventId");
