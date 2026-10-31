import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertAssetClass,
  isGpwListed,
  parseSearchLimit,
  parseSearchQuery,
  providerSymbolForCatalog,
} from "./instruments";
import { isValuationFresh } from "./instrumentValuations";

test("assertAssetClass accepts STOCK and ETF", () => {
  assert.equal(assertAssetClass("stock"), "STOCK");
  assert.equal(assertAssetClass("ETF"), "ETF");
  assert.throws(() => assertAssetClass("CRYPTO"), /assetClass/);
});

test("parseSearchQuery and limit", () => {
  assert.equal(parseSearchQuery(" aapl "), "aapl");
  assert.throws(() => parseSearchQuery(""), /q must/);
  assert.equal(parseSearchLimit(undefined), 25);
  assert.throws(() => parseSearchLimit(0), /limit/);
  assert.throws(() => parseSearchLimit(99), /limit/);
});

test("providerSymbolForCatalog uppercases symbol", () => {
  assert.equal(
    providerSymbolForCatalog({
      symbol: "aapl",
      name: "Apple",
      exchange: "NASDAQ",
      micCode: null,
      country: null,
      currency: "USD",
    }),
    "AAPL",
  );
});

test("isGpwListed matches GPW/WSE exchange or Poland country", () => {
  assert.equal(isGpwListed({ exchange: "GPW", country: null }), true);
  assert.equal(isGpwListed({ exchange: "wse", country: null }), true);
  assert.equal(isGpwListed({ exchange: "NASDAQ", country: "Poland" }), true);
  assert.equal(
    isGpwListed({ exchange: "LSE", country: "United Kingdom" }),
    false,
  );
  assert.equal(
    isGpwListed({ exchange: "NASDAQ", country: "United States" }),
    false,
  );
});

test("isValuationFresh for today and yesterday UTC", () => {
  const now = new Date(Date.UTC(2026, 9, 30, 15, 0, 0));
  const today = new Date(Date.UTC(2026, 9, 30));
  const yesterday = new Date(Date.UTC(2026, 9, 29));
  const older = new Date(Date.UTC(2026, 9, 28));
  assert.equal(isValuationFresh(today, now), true);
  assert.equal(isValuationFresh(yesterday, now), true);
  assert.equal(isValuationFresh(older, now), false);
});
