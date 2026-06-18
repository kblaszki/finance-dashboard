import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { computeRealizedPnl, findOrCreateHolding, syncHoldingQuantity } from "../src/holdings";
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
