import test from "node:test";
import assert from "node:assert/strict";
import { inferAssetBucket } from "./portfolio";

test("inferAssetBucket maps brokerage instruments to stock_market", () => {
  assert.equal(inferAssetBucket("BROKERAGE", "STOCK"), "stock_market");
  assert.equal(inferAssetBucket("BROKERAGE", "ETF"), "stock_market");
});

test("inferAssetBucket maps manual accounts to real_estate", () => {
  assert.equal(inferAssetBucket("MANUAL", "OTHER"), "real_estate");
});

test("inferAssetBucket maps crypto and metals", () => {
  assert.equal(inferAssetBucket("BROKERAGE", "CRYPTO"), "crypto");
  assert.equal(inferAssetBucket("BROKERAGE", "GOLD"), "precious_metal_other");
});
