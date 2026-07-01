import test from "node:test";
import assert from "node:assert/strict";
import {
  applyLossCarryforward,
  remainingLoss,
  suggestLossRowForYear,
} from "./taxLossCarryforward";
import {
  computePropertySaleTaxableGain,
  computeRentalTaxableBase,
} from "../propertySales";

test("applyLossCarryforward consumes oldest losses first", () => {
  const result = applyLossCarryforward(100, [
    { taxYear: 2023, lossAmount: 30, usedAmount: 0 },
    { taxYear: 2024, lossAmount: 50, usedAmount: 10 },
  ]);
  assert.equal(result.taxableGain, 30);
  assert.deepEqual(result.applied, [
    { taxYear: 2023, amount: 30 },
    { taxYear: 2024, amount: 40 },
  ]);
});

test("remainingLoss is non-negative", () => {
  assert.equal(remainingLoss(100, 40), 60);
  assert.equal(remainingLoss(40, 100), 0);
});

test("suggestLossRowForYear for negative net", () => {
  assert.deepEqual(suggestLossRowForYear(2025, -250), { taxYear: 2025, lossAmount: 250 });
  assert.equal(suggestLossRowForYear(2025, 10), null);
});

test("computePropertySaleTaxableGain respects exemption", () => {
  assert.equal(
    computePropertySaleTaxableGain({
      proceeds: 500000,
      acquisitionCost: 300000,
      improvementsCost: 20000,
      fiveYearExemption: true,
    }),
    0,
  );
  assert.equal(
    computePropertySaleTaxableGain({
      proceeds: 500000,
      acquisitionCost: 300000,
      improvementsCost: 20000,
      fiveYearExemption: false,
    }),
    180000,
  );
});

test("computeRentalTaxableBase lump sum vs scale", () => {
  assert.ok(Math.abs(computeRentalTaxableBase("lump_sum_8_5", 10000, 2000) - 850) < 0.01);
  assert.equal(computeRentalTaxableBase("scale", 10000, 2000), 8000);
});
