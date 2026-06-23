import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  backfillAccountValuations,
  computeCashAsOf,
  recalcTransactionBalances,
  recomputeAccountValuationsFrom,
} from "../src/accountValuation";
import { findOrCreateHolding, syncHoldingQuantity } from "../src/holdings";
import { applyStockSplit } from "../src/stockSplit";
import { computeCashflowStats } from "../src/stats";
import { MOCK_FX } from "./helpers/seedFromFixture";
import { createTestPrisma, disconnectTestPrisma, resetDatabase } from "./prismaTestClient";

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

test("DIVIDEND credits brokerage cash and counts as income in cashflow", async () => {
  const user = await prisma.user.create({
    data: { email: "div@test.local", username: "divuser", passwordHash: "x" },
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
  const txDate = new Date("2025-03-15T12:00:00.000Z");
  await prisma.transaction.create({
    data: {
      accountId: account.id,
      transactionType: "DIVIDEND",
      amount: 50,
      balanceAfter: 0,
      currency: "PLN",
      category: "DIVIDEND",
      date: txDate,
      description: "PKO dividend",
    },
  });
  await recalcTransactionBalances(prisma, account.id);
  await backfillAccountValuations(prisma, account.id, MOCK_FX.plnPerUnit);

  const cash = await computeCashAsOf(prisma, account.id, new Date());
  assert.equal(cash, 1050);

  const rows = await prisma.transaction.findMany({ where: { accountId: account.id } });
  const stats = computeCashflowStats(
    rows,
    "PLN",
    (amount) => amount,
    (v) => Number(v),
    MOCK_FX.plnPerUnit,
  );
  assert.equal(stats.income, 50);
  assert.equal(stats.net, 50);
});

test("4:1 stock split multiplies quantity and keeps market value stable", async () => {
  const user = await prisma.user.create({
    data: { email: "split@test.local", username: "splituser", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  const instrument = await prisma.instrument.create({
    data: {
      symbol: "AAA",
      name: "Test Co",
      instrumentType: "STOCK",
      currency: "PLN",
    },
  });
  const holding = await findOrCreateHolding(prisma, account.id, instrument.id);
  const tradeDate = new Date("2025-01-10T12:00:00.000Z");
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 10,
      quantityAfter: 10,
      totalPrice: 1000,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate,
    },
  });
  await syncHoldingQuantity(prisma, holding.id);
  await prisma.instrumentValuation.create({
    data: {
      instrumentId: instrument.id,
      price: 110,
      currency: "PLN",
      valuationDate: new Date("2025-06-01T12:00:00.000Z"),
      source: "manual",
    },
  });
  await backfillAccountValuations(prisma, account.id, MOCK_FX.plnPerUnit);

  const before = await prisma.holding.findUniqueOrThrow({ where: { id: holding.id } });
  assert.equal(Number(before.quantity), 10);

  const effectiveDate = new Date("2025-06-01T12:00:00.000Z");
  await prisma.$transaction(async (tx) => {
    await applyStockSplit(tx, holding.id, 4);
    await syncHoldingQuantity(tx, holding.id);
    await recomputeAccountValuationsFrom(tx, account.id, effectiveDate, MOCK_FX.plnPerUnit);
  });

  const after = await prisma.holding.findUniqueOrThrow({ where: { id: holding.id } });
  assert.equal(Number(after.quantity), 40);

  const lot = await prisma.holdingLot.findFirstOrThrow({ where: { holdingId: holding.id } });
  assert.equal(Number(lot.quantity), 40);
  assert.equal(Number(lot.pricePerUnit), 25);
  assert.equal(Number(lot.totalPrice), 1000);

  const snap = await prisma.holdingValuationDaily.findFirst({
    where: { accountId: account.id, instrumentId: instrument.id },
    orderBy: { valuationDate: "desc" },
  });
  assert.ok(snap);
  assert.equal(Number(snap.quantity), 40);
  assert.equal(Number(snap.marketValue), 4400);
});

test("INTEREST credits bank account cash", async () => {
  const user = await prisma.user.create({
    data: { email: "int@test.local", username: "intuser", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Savings",
      currency: "PLN",
      openingBalance: 5000,
      cashBalance: 5000,
    },
  });
  await prisma.transaction.create({
    data: {
      accountId: account.id,
      transactionType: "INTEREST",
      amount: 12.5,
      balanceAfter: 0,
      currency: "PLN",
      category: "INTEREST",
      date: new Date("2025-04-01T12:00:00.000Z"),
    },
  });
  await recalcTransactionBalances(prisma, account.id);
  const updated = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
  assert.equal(Number(updated.cashBalance), 5012.5);
});
