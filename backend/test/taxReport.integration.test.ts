import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { computeTaxReport } from "../src/taxReport";
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

test("tax report aggregates FIFO sell in tax year and dividends", async () => {
  const user = await prisma.user.create({
    data: { email: "tax@test.local", username: "taxuser", passwordHash: "x" },
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
    data: { instrumentType: "STOCK", symbol: "AAA", exchange: "GPW", currency: "PLN" },
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
      currency: "PLN",
      tradeDate: new Date("2024-06-01T12:00:00.000Z"),
    },
  });
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "SELL",
      quantity: 4,
      quantityAfter: 6,
      totalPrice: 480,
      pricePerUnit: 120,
      currency: "PLN",
      tradeDate: new Date("2025-04-01T12:00:00.000Z"),
    },
  });
  await syncHoldingQuantity(prisma, holding.id);

  await prisma.transaction.create({
    data: {
      accountId: account.id,
      transactionType: "DIVIDEND",
      amount: 50,
      balanceAfter: 50,
      currency: "PLN",
      category: "DIVIDEND",
      date: new Date("2025-05-01T12:00:00.000Z"),
    },
  });

  const report = await computeTaxReport(prisma, user.id, 2025, "PLN", MOCK_FX.plnPerUnit);

  assert.equal(report.sellRows.length, 1);
  assert.equal(report.sellRows[0].gainLoss, 80);
  assert.equal(report.netRealized, 80);
  assert.equal(report.estimatedBelka, 80 * 0.19);
  assert.equal(report.dividendsGross, 50);
  assert.equal(report.byInstrument[0].symbol, "AAA");
});

test("tax report ignores sells outside selected year", async () => {
  const user = await prisma.user.create({
    data: { email: "taxyear@test.local", username: "taxyear", passwordHash: "x" },
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
    data: { instrumentType: "STOCK", symbol: "BBB", exchange: "GPW", currency: "PLN" },
  });
  const holding = await findOrCreateHolding(prisma, account.id, instrument.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 5,
      quantityAfter: 5,
      totalPrice: 500,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: new Date("2023-01-01T12:00:00.000Z"),
    },
  });
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "SELL",
      quantity: 5,
      quantityAfter: 0,
      totalPrice: 600,
      pricePerUnit: 120,
      currency: "PLN",
      tradeDate: new Date("2023-12-01T12:00:00.000Z"),
    },
  });
  await syncHoldingQuantity(prisma, holding.id);

  const report = await computeTaxReport(prisma, user.id, 2025, "PLN", MOCK_FX.plnPerUnit);
  assert.equal(report.sellRows.length, 0);
  assert.equal(report.netRealized, 0);
});
