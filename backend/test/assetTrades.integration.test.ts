import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { fetchUserAssetTrades } from "../src/assetTrades";
import { findOrCreateHolding, syncHoldingQuantity } from "../src/holdings";
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

test("fetchUserAssetTrades scopes to user brokerage lots", async () => {
  const user = await prisma.user.create({
    data: { email: "trades@test.local", username: "tradesuser", passwordHash: "x" },
  });
  const other = await prisma.user.create({
    data: { email: "other@test.local", username: "otheruser", passwordHash: "x" },
  });

  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Mine",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  const otherAccount = await prisma.account.create({
    data: {
      userId: other.id,
      accountType: "BROKERAGE",
      name: "Theirs",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
    },
  });

  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "TRD", exchange: "TEST", currency: "PLN" },
  });

  const holding = await findOrCreateHolding(prisma, account.id, instrument.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 1,
      quantityAfter: 1,
      totalPrice: 100,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: new Date("2025-04-01T12:00:00.000Z"),
    },
  });
  await syncHoldingQuantity(prisma, holding.id);

  const otherHolding = await findOrCreateHolding(prisma, otherAccount.id, instrument.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: otherHolding.id,
      side: "BUY",
      quantity: 9,
      quantityAfter: 9,
      totalPrice: 900,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: new Date("2025-04-02T12:00:00.000Z"),
    },
  });
  await syncHoldingQuantity(prisma, otherHolding.id);

  const rows = await fetchUserAssetTrades(prisma, user.id, {
    from: new Date("2025-04-01T00:00:00.000Z"),
    to: new Date("2025-04-30T23:59:59.999Z"),
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity.toString(), "1");
});

test("fetchUserAssetTrades filters by account and instrument", async () => {
  const user = await prisma.user.create({
    data: { email: "trade-filter@test.local", username: "tradefilter", passwordHash: "x" },
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
    data: { instrumentType: "STOCK", symbol: "A", exchange: "TEST", currency: "PLN" },
  });
  const inst2 = await prisma.instrument.create({
    data: { instrumentType: "ETF", symbol: "B", exchange: "TEST", currency: "PLN" },
  });

  for (const inst of [inst1, inst2]) {
    const holding = await findOrCreateHolding(prisma, account.id, inst.id);
    await prisma.holdingLot.create({
      data: {
        holdingId: holding.id,
        side: "BUY",
        quantity: 1,
        quantityAfter: 1,
        totalPrice: 10,
        pricePerUnit: 10,
        currency: "PLN",
        tradeDate: new Date("2025-05-01T12:00:00.000Z"),
      },
    });
    await syncHoldingQuantity(prisma, holding.id);
  }

  const byInstrument = await fetchUserAssetTrades(prisma, user.id, { instrumentId: inst2.id });
  assert.equal(byInstrument.length, 1);
  assert.equal(byInstrument[0].holding.instrumentId, inst2.id);

  const byAccount = await fetchUserAssetTrades(prisma, user.id, { accountId: account.id });
  assert.equal(byAccount.length, 2);
});
