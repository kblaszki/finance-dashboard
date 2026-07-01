import test from "node:test";
import assert from "node:assert/strict";
import {
  accountValuationAsOf,
  buildPortfolioHistoryPoints,
  computeSimpleReturnPct,
  computeValueWeightedAverageReturnPct,
} from "./portfolioStats";

test("buildPortfolioHistoryPoints forward-fills sparse account valuations", () => {
  const accounts = [
    { id: 1, currency: "PLN" },
    { id: 2, currency: "PLN" },
  ];
  const rowsByAccountId = new Map([
    [
      1,
      [
        {
          valuationDate: new Date("2025-06-01T12:00:00.000Z"),
          totalValue: 1000,
          cashValue: 100,
          securitiesValue: 900,
          currency: "PLN",
        },
      ],
    ],
    [
      2,
      [
        {
          valuationDate: new Date("2025-06-15T12:00:00.000Z"),
          totalValue: 500,
          cashValue: 50,
          securitiesValue: 450,
          currency: "PLN",
        },
      ],
    ],
  ]);

  const points = buildPortfolioHistoryPoints(
    accounts,
    rowsByAccountId,
    new Date("2025-06-01T00:00:00.000Z"),
    new Date("2025-06-16T00:00:00.000Z"),
    "PLN",
    { PLN: 1, USD: 4, EUR: 4.3 },
  );

  assert.equal(points.length, 16);
  assert.equal(points[0]!.totalValue, 1000);
  assert.equal(points[13]!.totalValue, 1000);
  assert.equal(points[14]!.totalValue, 1500);
  assert.equal(points[15]!.totalValue, 1500);
});

test("accountValuationAsOf returns latest row on or before date", () => {
  const rows = [
    {
      valuationDate: new Date("2025-06-01T12:00:00.000Z"),
      totalValue: 100,
      cashValue: 10,
      securitiesValue: 90,
      currency: "PLN",
    },
    {
      valuationDate: new Date("2025-06-10T12:00:00.000Z"),
      totalValue: 200,
      cashValue: 20,
      securitiesValue: 180,
      currency: "PLN",
    },
  ];
  const mid = accountValuationAsOf(rows, new Date("2025-06-05T23:59:59.999Z"));
  assert.equal(mid?.totalValue, 100);
  const later = accountValuationAsOf(rows, new Date("2025-06-10T23:59:59.999Z"));
  assert.equal(later?.totalValue, 200);
});

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
