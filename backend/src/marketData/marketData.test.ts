import test from "node:test";
import assert from "node:assert/strict";
import { clearMarketDataCache, fetchEodTimeSeries } from "./marketData";

test.beforeEach(() => {
  clearMarketDataCache();
});

test("fetchEodTimeSeries parses Twelve Data time_series response", async () => {
  const mockFetch = async () =>
    ({
      ok: true,
      json: async () => ({
        status: "ok",
        values: [
          { datetime: "2025-01-10", close: "150.25" },
          { datetime: "2025-01-09", close: "149.00" },
        ],
      }),
    }) as Response;

  const bars = await fetchEodTimeSeries("AAPL", {
    apiKey: "test-key",
    fetchFn: mockFetch,
    outputsize: 2,
  });

  assert.equal(bars.length, 2);
  assert.equal(bars[0].date.toISOString().slice(0, 10), "2025-01-09");
  assert.equal(bars[0].close, 149);
  assert.equal(bars[1].close, 150.25);
});

test("fetchEodTimeSeries throws on provider error body", async () => {
  const mockFetch = async () =>
    ({
      ok: true,
      json: async () => ({ status: "error", message: "Invalid symbol" }),
    }) as Response;

  await assert.rejects(
    () => fetchEodTimeSeries("BAD", { apiKey: "test-key", fetchFn: mockFetch }),
    /Invalid symbol/,
  );
});

test("fetchEodTimeSeries requires API key", async () => {
  const prev = process.env.MARKET_DATA_API_KEY;
  delete process.env.MARKET_DATA_API_KEY;
  try {
    await assert.rejects(
      () => fetchEodTimeSeries("AAPL", { fetchFn: async () => ({ ok: true, json: async () => ({}) }) as Response }),
      /MARKET_DATA_API_KEY/,
    );
  } finally {
    if (prev) process.env.MARKET_DATA_API_KEY = prev;
  }
});

test("fetchEodTimeSeries uses cache on second call", async () => {
  let calls = 0;
  const mockFetch = async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({
        values: [{ datetime: "2025-01-10", close: "10" }],
      }),
    } as Response;
  };

  await fetchEodTimeSeries("AAPL", { apiKey: "k", fetchFn: mockFetch, outputsize: 5 });
  await fetchEodTimeSeries("AAPL", { apiKey: "k", fetchFn: mockFetch, outputsize: 5 });
  assert.equal(calls, 1);
});
