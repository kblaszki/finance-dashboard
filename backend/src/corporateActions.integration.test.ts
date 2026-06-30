import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { findOrCreateHolding, syncHoldingQuantity } from "./holdings";
import { createCorporateAction } from "./corporateActions";
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

test("createCorporateAction applies stock split and records audit row", async () => {
  const user = await prisma.user.create({
    data: { email: "ca@test.local", username: "ca", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "PLN",
    },
  });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "SPL", currency: "PLN" },
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
      tradeDate: new Date("2026-01-01"),
    },
  });
  await syncHoldingQuantity(prisma, holding.id);

  const row = await createCorporateAction(
    prisma,
    user.id,
    {
      accountId: account.id,
      instrumentId: instrument.id,
      actionType: "stock_split",
      actionDate: new Date("2026-06-01"),
      ratio: 2,
    },
    {
      getFxRatesPlnPerUnit: async () => ({ plnPerUnit: MOCK_FX.plnPerUnit }),
      recomputeAccountValuationsFrom,
    },
  );

  assert.equal(row.actionType, "stock_split");
  const refreshed = await prisma.holding.findUniqueOrThrow({ where: { id: holding.id } });
  assert.equal(Number(refreshed.quantity), 10);
});
