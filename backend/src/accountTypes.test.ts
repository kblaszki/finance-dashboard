import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNT_TYPES,
  isHoldingsAccountType,
  isRevalueAccountType,
  isValidAccountType,
} from "./accountTypes";

test("isValidAccountType accepts spec account types", () => {
  for (const type of ACCOUNT_TYPES) {
    assert.equal(isValidAccountType(type), true);
  }
  assert.equal(isValidAccountType("INVALID"), false);
});

test("holdings and revalue account type helpers", () => {
  assert.equal(isHoldingsAccountType("BROKERAGE"), true);
  assert.equal(isHoldingsAccountType("CRYPTO"), true);
  assert.equal(isHoldingsAccountType("BANK"), false);
  assert.equal(isRevalueAccountType("REAL_ESTATE"), true);
  assert.equal(isRevalueAccountType("MANUAL"), true);
  assert.equal(isRevalueAccountType("BROKERAGE"), false);
});
