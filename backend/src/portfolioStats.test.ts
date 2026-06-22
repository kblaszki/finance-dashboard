import test from "node:test";
import assert from "node:assert/strict";
import { computeSimpleReturnPct } from "./portfolioStats";

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
