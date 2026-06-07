import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyMarketDataStatus,
  refreshSymbolsIncremental,
  upsertPriceHistoryForAsset,
  type EodPriceProvider,
} from "./marketData";

test("classifyMarketDataStatus returns fresh/stale/expired thresholds", () => {
  const now = new Date("2026-06-10T00:00:00.000Z");
  assert.equal(classifyMarketDataStatus(now, new Date("2026-06-09T00:00:00.000Z")), "fresh");
  assert.equal(classifyMarketDataStatus(now, new Date("2026-06-06T00:00:00.000Z")), "stale");
  assert.equal(classifyMarketDataStatus(now, new Date("2026-05-30T00:00:00.000Z")), "expired");
  assert.equal(classifyMarketDataStatus(now, null), "missing");
});

test("refreshSymbolsIncremental upserts unique normalized symbols", async () => {
  const upserts: unknown[] = [];
  const assets = new Map<string, { id: number; symbol: string; currency: string }>();
  let nextAssetId = 1;

  const prismaMock = {
    asset: {
      findFirst: async ({ where }: { where: { symbol: string } }) => {
        for (const asset of assets.values()) {
          if (asset.symbol === where.symbol) return asset;
        }
        return null;
      },
      create: async ({ data }: { data: { symbol: string; currency: string } }) => {
        const asset = { id: nextAssetId++, symbol: data.symbol, currency: data.currency };
        assets.set(asset.symbol, asset);
        return asset;
      },
    },
    marketPriceDaily: {
      findFirst: async () => null,
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
    async fetchDailyHistory(symbol: string) {
      return [
        {
          symbol,
          exchange: "XNYS",
          currency: "USD",
          close: 100,
          priceDate: new Date("2026-06-01T00:00:00.000Z"),
          source: "mock_source",
        },
      ];
    },
  };

  const result = await refreshSymbolsIncremental(
    prismaMock as never,
    provider,
    ["aapl", "AAPL", "msft", ""],
  );

  assert.equal(result.requested, 2);
  assert.equal(result.updated, 2);
  assert.equal(result.errors.length, 0);
  assert.equal(upserts.length, 2);
});

test("upsertPriceHistoryForAsset writes all points", async () => {
  const upserts: unknown[] = [];
  const prismaMock = {
    marketPriceDaily: {
      upsert: async (payload: unknown) => {
        upserts.push(payload);
        return payload;
      },
    },
  };
  const result = await upsertPriceHistoryForAsset(prismaMock as never, 42, [
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
