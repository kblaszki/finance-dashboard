import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isMarketYahooGapSyncEnabled,
  marketYahooGapSyncUtcHour,
  startYahooGapSyncScheduler,
} from "./yahooGapSyncScheduler";

test("isMarketYahooGapSyncEnabled and utc hour defaults", () => {
  assert.equal(isMarketYahooGapSyncEnabled({}), false);
  assert.equal(isMarketYahooGapSyncEnabled({ MARKET_YAHOO_GAP_SYNC: "true" }), true);
  assert.equal(marketYahooGapSyncUtcHour({}), 21);
  assert.equal(
    marketYahooGapSyncUtcHour({ MARKET_YAHOO_GAP_SYNC_UTC_HOUR: "18" }),
    18,
  );
  assert.equal(
    marketYahooGapSyncUtcHour({ MARKET_YAHOO_GAP_SYNC_UTC_HOUR: "99" }),
    21,
  );
});

test("startYahooGapSyncScheduler no-ops when disabled", () => {
  const handle = startYahooGapSyncScheduler(
    {} as never,
    { env: {}, pollMs: 60_000 },
  );
  assert.equal(handle, null);
});

test("startYahooGapSyncScheduler runs once when utc hour reached", async () => {
  let runs = 0;
  const logs: string[] = [];
  const handle = startYahooGapSyncScheduler(
    {} as never,
    {
      env: {
        MARKET_YAHOO_GAP_SYNC: "true",
        MARKET_YAHOO_GAP_SYNC_UTC_HOUR: "21",
      },
      pollMs: 60_000,
      now: () => new Date(Date.UTC(2026, 10, 1, 21, 5, 0)),
      run: async () => {
        runs += 1;
        return {
          attempted: 0,
          updatedInstruments: 0,
          barsUpserted: 0,
          skippedFresh: 0,
          failed: 0,
          skippedDueToDayLock: true,
          errors: [],
        };
      },
      log: (msg) => {
        logs.push(msg);
      },
    },
  );
  assert.ok(handle);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(runs, 1);
  assert.ok(logs.some((l) => l.includes("starting")));
  handle!.stop();
});
