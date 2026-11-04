import assert from "node:assert/strict";
import test from "node:test";
import { utcDayDiff, valueBondPosition } from "./bondValuation";

test("utcDayDiff uses UTC calendar days and floors at zero", () => {
  assert.equal(
    utcDayDiff(
      new Date("2026-01-01T12:00:00.000Z"),
      new Date("2026-01-11T00:00:00.000Z"),
    ),
    10,
  );
  assert.equal(
    utcDayDiff(
      new Date("2026-02-01T00:00:00.000Z"),
      new Date("2026-01-01T00:00:00.000Z"),
    ),
    0,
  );
});

test("valueBondPosition accrues actual/365 interest and applies fee + Belka", () => {
  // 10 × 100 = 1000 nominal; 6.5% for 365 days → 65 interest; fee 10; cost 1000
  // taxable = max(0, 1065 - 10 - 1000) = 55; belka = 10.45; net = 1065 - 10 - 10.45
  const v = valueBondPosition({
    quantity: 10,
    unitNominal: 100,
    unitPurchasePrice: 100,
    currentAnnualRatePct: 6.5,
    earlyExitFeePerUnit: 1,
    periodStart: new Date("2025-01-01T00:00:00.000Z"),
    maturityDate: new Date("2030-01-01T00:00:00.000Z"),
    asOf: new Date("2026-01-01T00:00:00.000Z"),
  });
  assert.equal(v.nominalValue, 1000);
  assert.equal(v.accruedInterest, 65);
  assert.equal(v.grossValue, 1065);
  assert.equal(v.earlyExitFee, 10);
  assert.equal(v.costBasis, 1000);
  assert.equal(v.belkaEstimate, 10.45);
  assert.equal(v.liquidationNet, 1044.55);
});

test("valueBondPosition caps accrual at maturity and zeros before periodStart", () => {
  const before = valueBondPosition({
    quantity: 1,
    unitNominal: 100,
    unitPurchasePrice: 100,
    currentAnnualRatePct: 10,
    earlyExitFeePerUnit: 1,
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    maturityDate: new Date("2027-06-01T00:00:00.000Z"),
    asOf: new Date("2026-01-01T00:00:00.000Z"),
  });
  assert.equal(before.accruedInterest, 0);
  assert.equal(before.grossValue, 100);

  const afterMaturity = valueBondPosition({
    quantity: 1,
    unitNominal: 100,
    unitPurchasePrice: 99,
    currentAnnualRatePct: 10,
    earlyExitFeePerUnit: 2,
    periodStart: new Date("2025-01-01T00:00:00.000Z"),
    maturityDate: new Date("2025-07-01T00:00:00.000Z"),
    asOf: new Date("2026-01-01T00:00:00.000Z"),
  });
  // 181 days from Jan 1 to Jul 1 2025
  assert.equal(afterMaturity.accruedInterest, 4.96);
  assert.equal(afterMaturity.grossValue, 104.96);
});

test("valueBondPosition Belka is zero when below cost after fee", () => {
  const v = valueBondPosition({
    quantity: 1,
    unitNominal: 100,
    unitPurchasePrice: 100,
    currentAnnualRatePct: 0,
    earlyExitFeePerUnit: 2,
    periodStart: new Date("2026-01-01T00:00:00.000Z"),
    maturityDate: new Date("2030-01-01T00:00:00.000Z"),
    asOf: new Date("2026-06-01T00:00:00.000Z"),
  });
  assert.equal(v.belkaEstimate, 0);
  assert.equal(v.liquidationNet, 98);
});
