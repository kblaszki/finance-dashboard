import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultTaxTypeForEvent,
  isBelkaIncomeEvent,
  parseIncomeEventType,
  parseIncomeTaxType,
} from "./incomeEvents";

test("parseIncomeEventType and parseIncomeTaxType validate input", () => {
  assert.equal(parseIncomeEventType("dividend"), "dividend");
  assert.throws(() => parseIncomeEventType("salary"), /Invalid eventType/);
  assert.equal(parseIncomeTaxType("belka"), "belka");
  assert.equal(parseIncomeTaxType(null), null);
  assert.throws(() => parseIncomeTaxType("vat"), /Invalid taxType/);
});

test("defaultTaxTypeForEvent maps event kinds", () => {
  assert.equal(defaultTaxTypeForEvent("interest"), "belka");
  assert.equal(defaultTaxTypeForEvent("dividend"), "pit38");
  assert.equal(defaultTaxTypeForEvent("capital_gain_distribution"), null);
});

test("isBelkaIncomeEvent respects explicit taxType", () => {
  assert.equal(isBelkaIncomeEvent("dividend", "belka"), true);
  assert.equal(isBelkaIncomeEvent("dividend", "pit38"), false);
  assert.equal(isBelkaIncomeEvent("interest", null), true);
  assert.equal(isBelkaIncomeEvent("dividend", null), false);
});
