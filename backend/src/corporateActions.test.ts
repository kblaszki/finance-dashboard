import test from "node:test";
import assert from "node:assert/strict";
import { parseCorporateActionType, serializeCorporateAction } from "./corporateActions";

test("parseCorporateActionType accepts stock_split", () => {
  assert.equal(parseCorporateActionType("stock_split"), "stock_split");
});

test("serializeCorporateAction maps fields", () => {
  const json = serializeCorporateAction({
    id: 1,
    accountId: 2,
    holdingId: 3,
    instrumentId: 4,
    actionType: "stock_split",
    actionDate: new Date("2026-01-01"),
    ratio: 2,
    quantityDelta: null,
    notes: "test",
    createdAt: new Date("2026-01-02"),
    account: { name: "Broker" },
    instrument: { symbol: "ABC" },
  });
  assert.equal(json.symbol, "ABC");
  assert.equal(json.ratio, 2);
  assert.equal(json.accountName, "Broker");
});
