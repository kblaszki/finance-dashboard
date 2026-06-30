import test from "node:test";
import assert from "node:assert/strict";
import { computeSimpleReturnPct, computeValueWeightedAverageReturnPct } from "./portfolioStats";

test("computeSimpleReturnPct returns null when base is zero", () => {
  assert.equal(computeSimpleReturnPct(0, 100, 0), null);
  assert.equal(computeSimpleReturnPct(0, 100, -100), null);
});

test("computeSimpleReturnPct calculates gain without contributions", () => {
  assert.equal(computeSimpleReturnPct(1000, 1100, 0), 10);
});

test("computeSimpleReturnPct accounts for net contributions", () => {
  // start 1000, deposit 500, end 1650 => gain 150 on base 1500 => 10%
  assert.equal(computeSimpleReturnPct(1000, 1650, 500), 10);
});

test("computeSimpleReturnPct handles negative return", () => {
  assert.equal(computeSimpleReturnPct(1000, 900, 0), -10);
});

test("computeValueWeightedAverageReturnPct weights by current value", () => {
  // 1100 @ +10% (cost 1000) and 600 @ +20% (cost 500) => 230 / 1700 ≈ 13.53%
  const result = computeValueWeightedAverageReturnPct([
    { currentValue: 1100, costBasis: 1000 },
    { currentValue: 600, costBasis: 500 },
  ]);
  assert.ok(result != null);
  assert.ok(Math.abs(result - 13.529411) < 0.01);
});

test("computeValueWeightedAverageReturnPct returns null without qualifying holdings", () => {
  assert.equal(computeValueWeightedAverageReturnPct([]), null);
  assert.equal(computeValueWeightedAverageReturnPct([{ currentValue: 100, costBasis: 0 }]), null);
});

test("computeValueWeightedAverageReturnPct handles negative return", () => {
  assert.equal(computeValueWeightedAverageReturnPct([{ currentValue: 800, costBasis: 1000 }]), -20);
});

test("computeValueWeightedAverageReturnPct skips non-positive current values", () => {
  assert.equal(
    computeValueWeightedAverageReturnPct([
      { currentValue: 0, costBasis: 100 },
      { currentValue: 1100, costBasis: 1000 },
    ]),
    10,
  );
});
