import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { findOrCreateHolding, syncHoldingQuantity } from "./holdings";
import { createPositionTransfer } from "./positionTransfers";
import { MOCK_FX } from "../test/helpers/seedFromFixture";
import { createTestPrisma, disconnectTestPrisma, resetDatabase } from "../test/prismaTestClient";
import { recomputeAccountValuationsFrom } from "./accountValuation";

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

test("createPositionTransfer moves open buy lots between accounts", async () => {
  const user = await prisma.user.create({
    data: { email: "pt@test.local", username: "pt", passwordHash: "x" },
  });
  const from = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "From",
      currency: "PLN",
      openingBalance: 1000,
      cashBalance: 1000,
    },
  });
  const to = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "To",
      currency: "PLN",
    },
  });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "MV", currency: "PLN" },
  });
  const holding = await findOrCreateHolding(prisma, from.id, instrument.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 10,
      quantityAfter: 10,
      totalPrice: 100,
      pricePerUnit: 10,
      currency: "PLN",
      tradeDate: new Date("2026-01-01"),
    },
  });
  await syncHoldingQuantity(prisma, holding.id);

  const row = await createPositionTransfer(
    prisma,
    user.id,
    {
      fromAccountId: from.id,
      toAccountId: to.id,
      instrumentId: instrument.id,
      quantity: 4,
      transferDate: new Date("2026-02-01"),
    },
    {
      getFxRatesPlnPerUnit: async () => ({ plnPerUnit: MOCK_FX.plnPerUnit }),
      recomputeAccountValuationsFrom,
    },
  );

  assert.equal(Number(row.quantity), 4);
  const fromHolding = await prisma.holding.findFirst({
    where: { accountId: from.id, instrumentId: instrument.id },
  });
  const toHolding = await prisma.holding.findFirst({
    where: { accountId: to.id, instrumentId: instrument.id },
  });
  assert.equal(Number(fromHolding?.quantity), 6);
  assert.equal(Number(toHolding?.quantity), 4);
});

test("createPositionTransfer deletes source lot when moving full quantity", async () => {
  const user = await prisma.user.create({
    data: { email: `pt-full-${Date.now()}@test.local`, username: `ptf${Date.now()}`, passwordHash: "x" },
  });
  const from = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "From full",
      currency: "PLN",
      cashBalance: 0,
    },
  });
  const to = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "To full",
      currency: "PLN",
    },
  });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "FULL", currency: "PLN" },
  });
  const holding = await findOrCreateHolding(prisma, from.id, instrument.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 3,
      quantityAfter: 3,
      totalPrice: 30,
      pricePerUnit: 10,
      currency: "PLN",
      tradeDate: new Date("2026-01-01"),
    },
  });
  await syncHoldingQuantity(prisma, holding.id);

  await createPositionTransfer(
    prisma,
    user.id,
    {
      fromAccountId: from.id,
      toAccountId: to.id,
      instrumentId: instrument.id,
      quantity: 3,
      transferDate: new Date("2026-02-01"),
    },
    {
      getFxRatesPlnPerUnit: async () => ({ plnPerUnit: MOCK_FX.plnPerUnit }),
      recomputeAccountValuationsFrom,
    },
  );

  const lots = await prisma.holdingLot.findMany({ where: { holdingId: holding.id } });
  assert.equal(lots.length, 0);
});
