import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { computeUserAverageHoldingReturn } from "../src/portfolioStats";
import { findOrCreateHolding, syncHoldingQuantity } from "../src/holdings";
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

test("computeUserAverageHoldingReturn returns null without open holdings", async () => {
  const user = await prisma.user.create({
    data: { email: "avg-empty@test.local", username: "avgempty", passwordHash: "x" },
  });
  await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Cash",
      currency: "PLN",
      openingBalance: 1000,
      cashBalance: 1000,
    },
  });

  const result = await computeUserAverageHoldingReturn(prisma, user.id, "PLN", MOCK_FX);
  assert.equal(result.averageReturnPct, null);
  assert.equal(result.displayCurrency, "PLN");
});

test("computeUserAverageHoldingReturn value-weights multiple holdings", async () => {
  const user = await prisma.user.create({
    data: { email: "avg-multi@test.local", username: "avgmulti", passwordHash: "x" },
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

  const inst1 = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "AVGA", exchange: "TEST", currency: "PLN" },
  });
  const inst2 = await prisma.instrument.create({
    data: { instrumentType: "ETF", symbol: "AVGB", exchange: "TEST", currency: "PLN" },
  });

  await prisma.instrumentValuation.createMany({
    data: [
      {
        instrumentId: inst1.id,
        valuationDate: new Date("2025-01-10T12:00:00.000Z"),
        price: 110,
        currency: "PLN",
        source: "manual",
      },
      {
        instrumentId: inst2.id,
        valuationDate: new Date("2025-01-10T12:00:00.000Z"),
        price: 120,
        currency: "PLN",
        source: "manual",
      },
    ],
  });

  const holding1 = await findOrCreateHolding(prisma, account.id, inst1.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: holding1.id,
      side: "BUY",
      quantity: 10,
      quantityAfter: 10,
      totalPrice: 1000,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: new Date("2025-01-05T12:00:00.000Z"),
    },
  });
  await syncHoldingQuantity(prisma, holding1.id);

  const holding2 = await findOrCreateHolding(prisma, account.id, inst2.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: holding2.id,
      side: "BUY",
      quantity: 5,
      quantityAfter: 5,
      totalPrice: 500,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: new Date("2025-01-06T12:00:00.000Z"),
    },
  });
  await syncHoldingQuantity(prisma, holding2.id);

  const result = await computeUserAverageHoldingReturn(prisma, user.id, "PLN", MOCK_FX);
  assert.ok(result.averageReturnPct != null);
  assert.ok(Math.abs(result.averageReturnPct - 13.529411) < 0.01);
});

test("computeUserAverageHoldingReturn skips holdings without market price", async () => {
  const user = await prisma.user.create({
    data: { email: "avg-noprice@test.local", username: "avgnoprice", passwordHash: "x" },
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

  const priced = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "HASPX", exchange: "TEST", currency: "PLN" },
  });
  const unpriced = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "NOPX", exchange: "TEST", currency: "PLN" },
  });

  await prisma.instrumentValuation.create({
    data: {
      instrumentId: priced.id,
      valuationDate: new Date("2025-01-10T12:00:00.000Z"),
      price: 110,
      currency: "PLN",
      source: "manual",
    },
  });

  const pricedHolding = await findOrCreateHolding(prisma, account.id, priced.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: pricedHolding.id,
      side: "BUY",
      quantity: 10,
      quantityAfter: 10,
      totalPrice: 1000,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: new Date("2025-01-05T12:00:00.000Z"),
    },
  });
  await syncHoldingQuantity(prisma, pricedHolding.id);

  const unpricedHolding = await findOrCreateHolding(prisma, account.id, unpriced.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: unpricedHolding.id,
      side: "BUY",
      quantity: 5,
      quantityAfter: 5,
      totalPrice: 500,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: new Date("2025-01-06T12:00:00.000Z"),
    },
  });
  await syncHoldingQuantity(prisma, unpricedHolding.id);

  const result = await computeUserAverageHoldingReturn(prisma, user.id, "PLN", MOCK_FX);
  assert.ok(result.averageReturnPct != null);
  assert.ok(Math.abs(result.averageReturnPct - 10) < 0.01);
});

test("computePortfolioHistory aggregates account valuation dailies", async () => {
  const user = await prisma.user.create({
    data: { email: "hist@test.local", username: "histuser", passwordHash: "x" },
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
  await prisma.accountValuationDaily.createMany({
    data: [
      {
        accountId: account.id,
        valuationDate: new Date("2025-06-01T12:00:00.000Z"),
        totalValue: 1000,
        cashValue: 200,
        securitiesValue: 800,
        currency: "PLN",
      },
      {
        accountId: account.id,
        valuationDate: new Date("2025-06-15T12:00:00.000Z"),
        totalValue: 1100,
        cashValue: 250,
        securitiesValue: 850,
        currency: "PLN",
      },
    ],
  });

  const { computePortfolioHistory, computeBenchmarkComparison } = await import("../src/portfolioStats");
  const history = await computePortfolioHistory(
    prisma,
    user.id,
    new Date("2025-06-01T00:00:00.000Z"),
    new Date("2025-06-30T00:00:00.000Z"),
    "PLN",
    MOCK_FX.plnPerUnit,
  );
  assert.equal(history.points.length, 2);
  assert.equal(history.points[0].totalValue, 1000);

  const bench = await computeBenchmarkComparison(
    prisma,
    user.id,
    "WIG",
    new Date("2025-06-01T00:00:00.000Z"),
    new Date("2025-06-30T00:00:00.000Z"),
    "PLN",
    MOCK_FX.plnPerUnit,
  );
  assert.ok("portfolioReturnPct" in bench);
});
