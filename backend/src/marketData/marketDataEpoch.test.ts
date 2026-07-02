import { test } from "node:test";
import assert from "node:assert/strict";
import { MVP_MARKET_DATA_EPOCH, defaultBackfillDays } from "./marketDataEpoch";

test("MVP_MARKET_DATA_EPOCH is 2020-01-01 UTC", () => {
  assert.equal(MVP_MARKET_DATA_EPOCH.toISOString(), "2020-01-01T00:00:00.000Z");
});

test("defaultBackfillDays spans from epoch to asOf", () => {
  const asOf = new Date(Date.UTC(2020, 0, 31));
  assert.equal(defaultBackfillDays(asOf), 30);
});
