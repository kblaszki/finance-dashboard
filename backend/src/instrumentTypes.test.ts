import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedInstrumentType, parseInstrumentType } from "./instrumentTypes";

test("parseInstrumentType accepts whitelisted types", () => {
  assert.equal(parseInstrumentType("stock"), "STOCK");
  assert.equal(parseInstrumentType("ETF"), "ETF");
  assert.equal(parseInstrumentType("bond"), "BOND");
  assert.equal(parseInstrumentType("FUND"), "FUND");
});

test("parseInstrumentType rejects unknown types", () => {
  assert.throws(() => parseInstrumentType("CRYPTO"), /Invalid instrumentType/);
});

test("isAllowedInstrumentType", () => {
  assert.equal(isAllowedInstrumentType("BOND"), true);
  assert.equal(isAllowedInstrumentType("crypto"), false);
});
