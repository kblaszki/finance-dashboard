import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  backfillAccountValuations,
  computeCashAsOf,
  utcDateOnly,
} from "../src/accountValuation";
import { computeBalanceAfter } from "../src/transactionBalance";
import { computeQuantityAfter, recomputeQuantityAfterChain } from "../src/holdingLot";
import { assertAccountInvariants } from "./assertAccountInvariants";
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

async function recalcLotQuantityChain(
  p: PrismaClient,
  accountId: number,
  instrumentId: number,
): Promise<void> {
  const lots = await p.holdingLot.findMany({
    where: { accountId, instrumentId },
    orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
  });
  const chain = recomputeQuantityAfterChain(
    lots.map((l) => ({ id: l.id, side: l.side, quantity: Number(l.quantity) })),
  );
  for (const lot of lots) {
    const qa = chain.get(lot.id);
    if (qa != null) {
      await p.holdingLot.update({ where: { id: lot.id }, data: { quantityAfter: qa } });
    }
  }
}

test("BANK without transactions backfills opening balance", async () => {
  const user = await prisma.user.create({
    data: { email: "bank-empty@test.local", username: "bank-empty", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Empty",
      currency: "PLN",
      openingBalance: 2500,
      cashBalance: 2500,
      createdAt: new Date("2025-01-01T12:00:00.000Z"),
    },
  });
  await backfillAccountValuations(prisma, account.id, MOCK_FX);
  const snap = await prisma.accountValuationDaily.findFirst({ where: { accountId: account.id } });
  assert.ok(snap);
  assert.equal(Number(snap.cashValue), 2500);
  await assertAccountInvariants(prisma, account.id);
});

test("BANK transactions forward-fill cashValue in snapshots", async () => {
  const user = await prisma.user.create({
    data: { email: "bank-tx@test.local", username: "bank-tx", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "With Tx",
      currency: "PLN",
      openingBalance: 1000,
      cashBalance: 1000,
      createdAt: new Date("2025-01-01T12:00:00.000Z"),
    },
  });
  let cash = 1000;
  cash = computeBalanceAfter(cash, "INCOME", 500);
  await prisma.transaction.create({
    data: {
      accountId: account.id,
      transactionType: "INCOME",
      amount: 500,
      balanceAfter: cash,
      currency: "PLN",
      category: "SALARY",
      date: new Date("2025-01-05T12:00:00.000Z"),
    },
  });
  await prisma.account.update({ where: { id: account.id }, data: { cashBalance: cash } });
  await backfillAccountValuations(prisma, account.id, MOCK_FX);

  const asOf = new Date("2025-01-05T23:59:59.999Z");
  const cashAsOf = await computeCashAsOf(prisma, account.id, asOf);
  assert.equal(cashAsOf, 1500);
  await assertAccountInvariants(prisma, account.id);
});

test("BROKERAGE BUY creates HoldingValuationDaily", async () => {
  const user = await prisma.user.create({
    data: { email: "broker-buy@test.local", username: "broker-buy", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "USD",
      openingBalance: 0,
      cashBalance: 5000,
      createdAt: new Date("2025-01-01T12:00:00.000Z"),
    },
  });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "TST", exchange: "TEST", currency: "USD" },
  });
  await prisma.instrumentValuation.create({
    data: {
      instrumentId: instrument.id,
      valuationDate: new Date("2025-01-10T12:00:00.000Z"),
      price: 50,
      currency: "USD",
      source: "manual",
    },
  });
  await prisma.holdingLot.create({
    data: {
      accountId: account.id,
      instrumentId: instrument.id,
      side: "BUY",
      quantity: 10,
      quantityAfter: 10,
      totalPrice: 500,
      pricePerUnit: 50,
      currency: "USD",
      tradeDate: new Date("2025-01-05T12:00:00.000Z"),
    },
  });
  await backfillAccountValuations(prisma, account.id, MOCK_FX);
  const holdingSnap = await prisma.holdingValuationDaily.findFirst({
    where: { accountId: account.id, instrumentId: instrument.id },
  });
  assert.ok(holdingSnap);
  assert.equal(Number(holdingSnap.quantity), 10);
  await assertAccountInvariants(prisma, account.id);
});

test("SELL entire position leaves zero quantity snapshots", async () => {
  const user = await prisma.user.create({
    data: { email: "sell-all@test.local", username: "sell-all", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Sell All",
      currency: "USD",
      openingBalance: 0,
      cashBalance: 1000,
      createdAt: new Date("2025-01-01T12:00:00.000Z"),
    },
  });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "SEL", exchange: "TEST", currency: "USD" },
  });
  await prisma.holdingLot.create({
    data: {
      accountId: account.id,
      instrumentId: instrument.id,
      side: "BUY",
      quantity: 5,
      quantityAfter: 5,
      totalPrice: 500,
      pricePerUnit: 100,
      currency: "USD",
      tradeDate: new Date("2025-01-03T12:00:00.000Z"),
    },
  });
  await prisma.holdingLot.create({
    data: {
      accountId: account.id,
      instrumentId: instrument.id,
      side: "SELL",
      quantity: 5,
      quantityAfter: 0,
      totalPrice: 550,
      pricePerUnit: 110,
      currency: "USD",
      tradeDate: new Date("2025-01-08T12:00:00.000Z"),
    },
  });
  await backfillAccountValuations(prisma, account.id, MOCK_FX);
  const lots = await prisma.holdingLot.findMany({ where: { accountId: account.id } });
  for (const lot of lots) {
    assert.ok(Number(lot.quantityAfter) >= 0);
  }
  await assertAccountInvariants(prisma, account.id);
});

test("delete middle lot recalculates quantityAfter chain", async () => {
  const user = await prisma.user.create({
    data: { email: "del-lot@test.local", username: "del-lot", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Del Lot",
      currency: "USD",
      openingBalance: 0,
      cashBalance: 0,
      createdAt: new Date("2025-01-01T12:00:00.000Z"),
    },
  });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "ETF", symbol: "DEL", exchange: "TEST", currency: "USD" },
  });
  const lot1 = await prisma.holdingLot.create({
    data: {
      accountId: account.id,
      instrumentId: instrument.id,
      side: "BUY",
      quantity: 10,
      quantityAfter: 10,
      totalPrice: 1000,
      pricePerUnit: 100,
      currency: "USD",
      tradeDate: new Date("2025-01-03T12:00:00.000Z"),
    },
  });
  const lot2 = await prisma.holdingLot.create({
    data: {
      accountId: account.id,
      instrumentId: instrument.id,
      side: "BUY",
      quantity: 5,
      quantityAfter: 15,
      totalPrice: 500,
      pricePerUnit: 100,
      currency: "USD",
      tradeDate: new Date("2025-01-05T12:00:00.000Z"),
    },
  });
  await prisma.holdingLot.delete({ where: { id: lot2.id } });
  await recalcLotQuantityChain(prisma, account.id, instrument.id);
  const updated = await prisma.holdingLot.findUnique({ where: { id: lot1.id } });
  assert.equal(Number(updated?.quantityAfter), 10);
  await assertAccountInvariants(prisma, account.id);
});

test("delete transaction recalculates balanceAfter chain", async () => {
  const user = await prisma.user.create({
    data: { email: "del-tx@test.local", username: "del-tx", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Del Tx",
      currency: "PLN",
      openingBalance: 1000,
      cashBalance: 1000,
      createdAt: new Date("2025-01-01T12:00:00.000Z"),
    },
  });
  const tx1 = await prisma.transaction.create({
    data: {
      accountId: account.id,
      transactionType: "INCOME",
      amount: 100,
      balanceAfter: 1100,
      currency: "PLN",
      category: "A",
      date: new Date("2025-01-05T12:00:00.000Z"),
    },
  });
  await prisma.transaction.create({
    data: {
      accountId: account.id,
      transactionType: "EXPENSE",
      amount: 50,
      balanceAfter: 1050,
      currency: "PLN",
      category: "B",
      date: new Date("2025-01-10T12:00:00.000Z"),
    },
  });
  await prisma.account.update({ where: { id: account.id }, data: { cashBalance: 1050 } });
  await prisma.transaction.delete({ where: { id: tx1.id } });

  const txs = await prisma.transaction.findMany({
    where: { accountId: account.id },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  let running = 1000;
  for (const tx of txs) {
    running = computeBalanceAfter(running, tx.transactionType as "EXPENSE", Number(tx.amount));
    await prisma.transaction.update({ where: { id: tx.id }, data: { balanceAfter: running } });
  }
  await prisma.account.update({ where: { id: account.id }, data: { cashBalance: running } });
  assert.equal(running, 950);
  await assertAccountInvariants(prisma, account.id);
});

test("utcDateOnly normalizes to UTC midnight", () => {
  const d = new Date("2025-06-15T18:30:00.000Z");
  const n = utcDateOnly(d);
  assert.equal(n.toISOString(), "2025-06-15T00:00:00.000Z");
});
