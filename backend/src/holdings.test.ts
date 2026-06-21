import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  computeRealizedPnl,
  findOrCreateHolding,
  getAccountHoldings,
  getHoldingForUser,
  recalcLotQuantityChain,
  syncHoldingQuantity,
} from "../src/holdings";
import { createTestPrisma, disconnectTestPrisma, resetDatabase } from "../test/prismaTestClient";

const MOCK_FX = { PLN: 1, USD: 4, EUR: 4.3 };

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

test("computeRealizedPnl returns sell proceeds minus buy cost", () => {
  const pnl = computeRealizedPnl(
    [
      { side: "BUY", totalPrice: 1000, currency: "USD" },
      { side: "SELL", totalPrice: 1100, currency: "USD" },
    ],
    "USD",
    MOCK_FX,
  );
  assert.equal(pnl, 100);
});

test("findOrCreateHolding returns same row on second call", async () => {
  const user = await prisma.user.create({
    data: { email: "hold@test.local", username: "hold", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "USD",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "AAPL", exchange: "NASDAQ", currency: "USD" },
  });

  const first = await findOrCreateHolding(prisma, account.id, instrument.id);
  const second = await findOrCreateHolding(prisma, account.id, instrument.id);
  assert.equal(first.id, second.id);
});

test("syncHoldingQuantity updates holding from last lot", async () => {
  const user = await prisma.user.create({
    data: { email: "sync@test.local", username: "sync", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "USD",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "MSFT", exchange: "NASDAQ", currency: "USD" },
  });
  const holding = await findOrCreateHolding(prisma, account.id, instrument.id);

  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 10,
      quantityAfter: 10,
      totalPrice: 1000,
      pricePerUnit: 100,
      currency: "USD",
      tradeDate: new Date("2025-01-05T12:00:00.000Z"),
    },
  });
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "SELL",
      quantity: 3,
      quantityAfter: 7,
      totalPrice: 330,
      pricePerUnit: 110,
      currency: "USD",
      tradeDate: new Date("2025-01-10T12:00:00.000Z"),
    },
  });

  const qty = await syncHoldingQuantity(prisma, holding.id);
  assert.equal(qty, 7);

  const updated = await prisma.holding.findUnique({ where: { id: holding.id } });
  assert.equal(Number(updated?.quantity), 7);
});

test("recalcLotQuantityChain updates quantityAfter for all lots", async () => {
  const user = await prisma.user.create({
    data: { email: "chain@test.local", username: "chain", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "USD",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "CHAIN", exchange: "TEST", currency: "USD" },
  });
  const holding = await findOrCreateHolding(prisma, account.id, instrument.id);

  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 10,
      quantityAfter: 99,
      totalPrice: 1000,
      pricePerUnit: 100,
      currency: "USD",
      tradeDate: new Date("2025-01-05T12:00:00.000Z"),
    },
  });
  const sell = await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "SELL",
      quantity: 4,
      quantityAfter: 99,
      totalPrice: 440,
      pricePerUnit: 110,
      currency: "USD",
      tradeDate: new Date("2025-01-10T12:00:00.000Z"),
    },
  });

  await recalcLotQuantityChain(prisma, holding.id);

  const lots = await prisma.holdingLot.findMany({
    where: { holdingId: holding.id },
    orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
  });
  assert.equal(Number(lots[0]!.quantityAfter), 10);
  assert.equal(Number(lots[1]!.id), sell.id);
  assert.equal(Number(lots[1]!.quantityAfter), 6);
});

test("getAccountHoldings splits open and closed with marketValue and realizedPnl", async () => {
  const user = await prisma.user.create({
    data: { email: "holdings@test.local", username: "holdings", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "USD",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  const openInstrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "OPEN", exchange: "TEST", currency: "USD" },
  });
  const closedInstrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "CLOSED", exchange: "TEST", currency: "USD" },
  });

  await prisma.instrumentValuation.create({
    data: {
      instrumentId: openInstrument.id,
      valuationDate: new Date("2025-01-10T12:00:00.000Z"),
      price: 50,
      currency: "USD",
      source: "manual",
    },
  });

  const openHolding = await findOrCreateHolding(prisma, account.id, openInstrument.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: openHolding.id,
      side: "BUY",
      quantity: 2,
      quantityAfter: 2,
      totalPrice: 80,
      pricePerUnit: 40,
      currency: "USD",
      tradeDate: new Date("2025-01-05T12:00:00.000Z"),
    },
  });
  await syncHoldingQuantity(prisma, openHolding.id);

  const closedHolding = await findOrCreateHolding(prisma, account.id, closedInstrument.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: closedHolding.id,
      side: "BUY",
      quantity: 5,
      quantityAfter: 5,
      totalPrice: 500,
      pricePerUnit: 100,
      currency: "USD",
      tradeDate: new Date("2025-01-01T12:00:00.000Z"),
    },
  });
  await prisma.holdingLot.create({
    data: {
      holdingId: closedHolding.id,
      side: "SELL",
      quantity: 5,
      quantityAfter: 0,
      totalPrice: 600,
      pricePerUnit: 120,
      currency: "USD",
      tradeDate: new Date("2025-01-15T12:00:00.000Z"),
    },
  });
  await syncHoldingQuantity(prisma, closedHolding.id);

  const result = await getAccountHoldings(prisma, account.id, "USD", MOCK_FX);

  assert.equal(result.open.length, 1);
  assert.equal(result.closed.length, 1);
  assert.equal(result.open[0]!.instrument.symbol, "OPEN");
  assert.equal(result.open[0]!.marketValue, 100);
  assert.equal(result.closed[0]!.realizedPnl, 100);
  assert.equal(result.closed[0]!.marketValue, null);
});

test("getHoldingForUser scopes to account owner", async () => {
  const owner = await prisma.user.create({
    data: { email: "owner@test.local", username: "owner", passwordHash: "x" },
  });
  const other = await prisma.user.create({
    data: { email: "otherhold@test.local", username: "otherhold", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: owner.id,
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "USD",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "SCOPE", exchange: "TEST", currency: "USD" },
  });
  const holding = await findOrCreateHolding(prisma, account.id, instrument.id);

  const forOwner = await getHoldingForUser(prisma, owner.id, holding.id);
  assert.ok(forOwner);
  assert.equal(forOwner.id, holding.id);

  const forOther = await getHoldingForUser(prisma, other.id, holding.id);
  assert.equal(forOther, null);
});
