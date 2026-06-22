import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth";
import { syncMarketPrices, MARKET_DATA_SOURCE } from "../src/marketDataSync";
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

async function seedBrokerageWithAapl(): Promise<{ instrumentId: number; accountId: number }> {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "sync@test.local", username: "syncuser", passwordHash },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "USD",
      openingBalance: 10000,
      cashBalance: 10000,
    },
  });
  const instrument = await prisma.instrument.create({
    data: {
      instrumentType: "STOCK",
      symbol: "AAPL",
      exchange: "NASDAQ",
      currency: "USD",
      source: "manual",
    },
  });
  const holding = await prisma.holding.create({
    data: { accountId: account.id, instrumentId: instrument.id, quantity: 10 },
  });
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 10,
      quantityAfter: 10,
      pricePerUnit: 100,
      totalPrice: 1000,
      currency: "USD",
      tradeDate: new Date("2025-01-05T12:00:00.000Z"),
    },
  });
  return { instrumentId: instrument.id, accountId: account.id };
}

test("syncMarketPrices upserts valuations and recomputes account snapshots", async () => {
  const { instrumentId, accountId } = await seedBrokerageWithAapl();

  const mockFetch = async () =>
    ({
      ok: true,
      json: async () => ({
        values: [
          { datetime: "2025-01-08", close: "180.50" },
          { datetime: "2025-01-09", close: "181.00" },
        ],
      }),
    }) as Response;

  const result = await syncMarketPrices(
    prisma,
    async () => MOCK_FX,
    {
      apiKey: "test-key",
      fetchFn: mockFetch,
      backfillDays: 2,
    },
  );

  assert.equal(result.synced, 1);
  assert.equal(result.valuationsUpserted, 2);
  assert.equal(result.accountsRecomputed, 1);

  const valuations = await prisma.instrumentValuation.findMany({
    where: { instrumentId, source: MARKET_DATA_SOURCE },
    orderBy: { valuationDate: "asc" },
  });
  assert.equal(valuations.length, 2);
  assert.equal(Number(valuations[1].price), 181);

  const accountVals = await prisma.accountValuationDaily.findMany({
    where: { accountId },
  });
  assert.ok(accountVals.length >= 1);
});

test("syncMarketPrices skips unmapped instruments", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "skip@test.local", username: "skipuser", passwordHash },
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
      instrumentType: "BOND",
      symbol: "EDO",
      exchange: null,
      currency: "PLN",
      source: "manual",
    },
  });
  await prisma.holding.create({
    data: { accountId: account.id, instrumentId: instrument.id, quantity: 1 },
  });

  const result = await syncMarketPrices(prisma, async () => MOCK_FX, { apiKey: "k" });
  assert.equal(result.synced, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.errors.length, 0);
});
