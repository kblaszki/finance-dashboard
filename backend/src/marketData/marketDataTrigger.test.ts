import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleMarketSyncAfterBuy } from "./marketDataTrigger";

test("scheduleMarketSyncAfterBuy is no-op without API key", () => {
  const prev = process.env.MARKET_DATA_API_KEY;
  delete process.env.MARKET_DATA_API_KEY;
  assert.doesNotThrow(() =>
    scheduleMarketSyncAfterBuy({} as never, async () => ({ plnPerUnit: { PLN: 1 } }), {
      userId: 1,
      instrumentType: "STOCK",
    }),
  );
  if (prev) process.env.MARKET_DATA_API_KEY = prev;
});

test("scheduleMarketSyncAfterBuy skips non-syncable instrument types", () => {
  process.env.MARKET_DATA_API_KEY = "test-key";
  assert.doesNotThrow(() =>
    scheduleMarketSyncAfterBuy({} as never, async () => ({ plnPerUnit: { PLN: 1 } }), {
      userId: 1,
      instrumentType: "BOND",
    }),
  );
});
