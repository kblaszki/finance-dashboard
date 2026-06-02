import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyMarketDataStatus,
  refreshSymbolsLastClose,
  upsertPriceHistory,
  type EodPriceProvider,
} from "./marketData";

test("classifyMarketDataStatus returns fresh/stale/expired thresholds", () => {
  const now = new Date("2026-06-10T00:00:00.000Z");
  assert.equal(classifyMarketDataStatus(now, new Date("2026-06-09T00:00:00.000Z")), "fresh");
  assert.equal(classifyMarketDataStatus(now, new Date("2026-06-06T00:00:00.000Z")), "stale");
  assert.equal(classifyMarketDataStatus(now, new Date("2026-05-30T00:00:00.000Z")), "expired");
  assert.equal(classifyMarketDataStatus(now, null), "missing");
});

test("refreshSymbolsLastClose upserts unique normalized symbols", async () => {
  const upserts: unknown[] = [];
  const prismaMock = {
    marketPriceHistory: {
      upsert: async (payload: unknown) => {
        upserts.push(payload);
        return payload;
      },
    },
  };

  const provider: EodPriceProvider = {
    source: "mock_source",
    async fetchLastClose(symbol: string) {
      return {
        symbol,
        exchange: "XNYS",
        currency: "USD",
        close: 100,
        priceDate: new Date("2026-06-01T00:00:00.000Z"),
        source: "mock_source",
      };
    },
    async fetchDailyHistory() {
      return [];
    },
  };

  const result = await refreshSymbolsLastClose(
    prismaMock as never,
    provider,
    ["aapl", "AAPL", "msft", ""],
  );

  assert.equal(result.requested, 2);
  assert.equal(result.updated, 2);
  assert.equal(result.errors.length, 0);
  assert.equal(upserts.length, 2);
});

test("upsertPriceHistory writes all points", async () => {
  const upserts: unknown[] = [];
  const prismaMock = {
    marketPriceHistory: {
      upsert: async (payload: unknown) => {
        upserts.push(payload);
        return payload;
      },
      findMany: async () => [],
    },
  };
  const result = await upsertPriceHistory(prismaMock as never, [
    {
      symbol: "AAPL",
      currency: "USD",
      close: 100,
      priceDate: new Date("2026-01-01T00:00:00.000Z"),
      source: "mock",
      exchange: "XNYS",
    },
    {
      symbol: "AAPL",
      currency: "USD",
      close: 101,
      priceDate: new Date("2026-01-02T00:00:00.000Z"),
      source: "mock",
      exchange: "XNYS",
    },
  ]);
  assert.equal(result.insertedOrUpdated, 2);
  assert.equal(upserts.length, 2);
});

