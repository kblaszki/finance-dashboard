import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { computeAccountDetailStats } from "./accountStats";
import { findOrCreateHolding, syncHoldingQuantity } from "./holdings";
import { createTestPrisma, disconnectTestPrisma, resetDatabase } from "../test/prismaTestClient";

let prisma: PrismaClient;

test.before(async () => {
  prisma = await createTestPrisma();
});

test.after(async () => {
  await disconnectTestPrisma(prisma);
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
});

const MOCK_FX = { PLN: 1 };

test("computeAccountDetailStats returns YTD cashflow excluding transfers", async () => {
  const user = await prisma.user.create({
    data: { email: "acctstats@test.local", username: "acctstats", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Bank",
      currency: "PLN",
      openingBalance: 1000,
      cashBalance: 1000,
    },
  });

  await prisma.transaction.createMany({
    data: [
      {
        accountId: account.id,
        transactionType: "INCOME",
        amount: 300,
        balanceAfter: 1300,
        currency: "PLN",
        category: "SALARY",
        date: new Date("2026-02-01T12:00:00.000Z"),
      },
      {
        accountId: account.id,
        transactionType: "EXPENSE",
        amount: 100,
        balanceAfter: 1200,
        currency: "PLN",
        category: "FOOD",
        date: new Date("2026-03-01T12:00:00.000Z"),
      },
      {
        accountId: account.id,
        transactionType: "TRANSFER_IN",
        amount: 500,
        balanceAfter: 1700,
        currency: "PLN",
        category: "INTERNAL_TRANSFER",
        date: new Date("2026-03-02T12:00:00.000Z"),
      },
    ],
  });

  const stats = await computeAccountDetailStats(
    prisma,
    account,
    "PLN",
    MOCK_FX,
  );

  assert.equal(stats.ytdIncome, 300);
  assert.equal(stats.ytdExpense, 100);
  assert.equal(stats.ytdNet, 200);
});

test("computeAccountDetailStats computes YoY change from valuations", async () => {
  const user = await prisma.user.create({
    data: { email: "yoy@test.local", username: "yoystats", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Bank",
      currency: "PLN",
      openingBalance: 1000,
      cashBalance: 1200,
    },
  });

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  oneYearAgo.setHours(12, 0, 0, 0);

  await prisma.accountValuationDaily.createMany({
    data: [
      {
        accountId: account.id,
        valuationDate: oneYearAgo,
        totalValue: 1000,
        cashValue: 1000,
        securitiesValue: 0,
        currency: "PLN",
      },
      {
        accountId: account.id,
        valuationDate: new Date(),
        totalValue: 1200,
        cashValue: 1200,
        securitiesValue: 0,
        currency: "PLN",
      },
    ],
  });

  const stats = await computeAccountDetailStats(prisma, account, "PLN", MOCK_FX);
  assert.equal(stats.currentTotal, 1200);
  assert.equal(stats.yoyChangeAbs, 200);
  assert.equal(stats.yoyChangePct, 20);
});

test("computeAccountDetailStats includes brokerage cash vs securities breakdown", async () => {
  const user = await prisma.user.create({
    data: { email: "brkstats@test.local", username: "brkstats", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "PLN",
      openingBalance: 1000,
      cashBalance: 1000,
    },
  });
  const instrument = await prisma.instrument.create({
    data: {
      symbol: "TST",
      instrumentType: "STOCK",
      currency: "PLN",
      exchange: "GPW",
    },
  });
  const holding = await findOrCreateHolding(prisma, account.id, instrument.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 10,
      pricePerUnit: 50,
      totalPrice: 500,
      currency: "PLN",
      tradeDate: new Date("2025-01-01T12:00:00.000Z"),
      quantityAfter: 10,
    },
  });
  await syncHoldingQuantity(prisma, holding.id);
  await prisma.instrumentValuation.create({
    data: {
      instrumentId: instrument.id,
      valuationDate: new Date(),
      price: 60,
      currency: "PLN",
      source: "manual",
    },
  });

  const stats = await computeAccountDetailStats(prisma, account, "PLN", MOCK_FX);
  assert.ok(stats.breakdown);
  assert.equal(stats.breakdown!.cashValue, 1000);
  assert.equal(stats.breakdown!.securitiesValue, 600);
  assert.ok(stats.breakdown!.cashPct > 0);
  assert.ok(stats.breakdown!.securitiesPct > 0);
});
