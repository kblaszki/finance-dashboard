import test from "node:test";
import assert from "node:assert/strict";
import {
  computePropertySaleTaxableGain,
  parseRentalTaxMethod,
} from "./propertySales";

test("computePropertySaleTaxableGain respects five-year exemption", () => {
  assert.equal(
    computePropertySaleTaxableGain({
      proceeds: 500000,
      acquisitionCost: 400000,
      improvementsCost: 10000,
      fiveYearExemption: true,
    }),
    0,
  );
  assert.equal(
    computePropertySaleTaxableGain({
      proceeds: 500000,
      acquisitionCost: 400000,
      improvementsCost: 10000,
      fiveYearExemption: false,
    }),
    90000,
  );
});

test("parseRentalTaxMethod rejects invalid values", () => {
  assert.throws(() => parseRentalTaxMethod("flat"), /Invalid rentalTaxMethod/);
});
