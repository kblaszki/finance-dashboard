import test from "node:test";
import assert from "node:assert/strict";
import {
  accountIncludedInPit38,
  isTaxAdvantagedWrapper,
  parseTaxWrapperType,
  parseWithdrawalType,
} from "./taxWrapper";
import { computeOpenBuySlices } from "./positionTransfers";

test("parseTaxWrapperType accepts known values", () => {
  assert.equal(parseTaxWrapperType("ike"), "ike");
  assert.equal(parseTaxWrapperType("STANDARD"), "standard");
});

test("isTaxAdvantagedWrapper identifies IKE/IKZE/PPK", () => {
  assert.equal(isTaxAdvantagedWrapper("ike"), true);
  assert.equal(isTaxAdvantagedWrapper("standard"), false);
});

test("accountIncludedInPit38 excludes advantaged accounts without withdrawal", () => {
  assert.equal(accountIncludedInPit38("standard", []), true);
  assert.equal(accountIncludedInPit38("ike", []), false);
  assert.equal(accountIncludedInPit38("ike", [{ includeInPit38: true }]), true);
  assert.equal(accountIncludedInPit38("ike", [{ includeInPit38: false }]), false);
});

test("parseWithdrawalType accepts partial", () => {
  assert.equal(parseWithdrawalType("partial"), "partial");
});

test("computeOpenBuySlices returns remaining buy quantity after sells", () => {
  const slices = computeOpenBuySlices([
    {
      id: 1,
      side: "BUY",
      quantity: 10,
      pricePerUnit: 10,
      totalPrice: 100,
      commission: 0,
      currency: "PLN",
      tradeDate: new Date("2025-01-01"),
    },
    {
      id: 2,
      side: "SELL",
      quantity: 4,
      pricePerUnit: 12,
      totalPrice: 48,
      commission: 0,
      currency: "PLN",
      tradeDate: new Date("2025-06-01"),
    },
    {
      id: 3,
      side: "BUY",
      quantity: 5,
      pricePerUnit: 11,
      totalPrice: 55,
      commission: 0,
      currency: "PLN",
      tradeDate: new Date("2025-07-01"),
    },
  ]);
  assert.equal(slices.length, 2);
  assert.equal(slices[0]!.openQty, 6);
  assert.equal(slices[1]!.openQty, 5);
});
