import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateAccountBalanceHistory,
  currentUtcMonthKey,
  resolveBalanceHistoryMonth,
} from "./accountBalanceHistory";
import { listMonthsEndingAt, parseMonthsParam } from "./cashflowStats";

test("currentUtcMonthKey formats UTC YYYY-MM", () => {
  assert.equal(currentUtcMonthKey(new Date("2026-03-15T23:00:00.000Z")), "2026-03");
  assert.equal(currentUtcMonthKey(new Date("2025-12-01T00:00:00.000Z")), "2025-12");
});

test("resolveBalanceHistoryMonth defaults to current UTC month", () => {
  const resolved = resolveBalanceHistoryMonth(undefined);
  assert.equal(resolved.month, currentUtcMonthKey());
  assert.equal(resolveBalanceHistoryMonth("2026-01").month, "2026-01");
  assert.throws(() => resolveBalanceHistoryMonth("2026-13"), /month must be/);
});

test("aggregateAccountBalanceHistory is flat at opening with no txs", () => {
  const months = listMonthsEndingAt("2026-03", 3);
  const result = aggregateAccountBalanceHistory(7, "PLN", months, 10_000, []);
  assert.deepEqual(result, {
    accountId: 7,
    currency: "PLN",
    monthCount: 3,
    series: [
      { month: "2026-01", balance: 100 },
      { month: "2026-02", balance: 100 },
      { month: "2026-03", balance: 100 },
    ],
  });
});

test("aggregateAccountBalanceHistory accumulates end-of-month balances", () => {
  const months = listMonthsEndingAt("2026-03", 3);
  const result = aggregateAccountBalanceHistory(1, "USD", months, 50_00, [
    {
      type: "INCOME",
      amount: 100_00,
      occurredAt: new Date("2025-12-20T00:00:00.000Z"),
    },
    {
      type: "INCOME",
      amount: 25_00,
      occurredAt: new Date("2026-01-15T00:00:00.000Z"),
    },
    {
      type: "EXPENSE",
      amount: 10_00,
      occurredAt: new Date("2026-02-01T00:00:00.000Z"),
    },
    {
      type: "EXPENSE",
      amount: 5_00,
      occurredAt: new Date("2026-03-31T23:59:59.000Z"),
    },
    {
      type: "TRANSFER",
      amount: 999_00,
      occurredAt: new Date("2026-02-15T00:00:00.000Z"),
    },
  ]);

  // opening 50 + pre-window 100 = 150 at end of Jan (+25) = 175
  // Feb −10 = 165; Mar −5 = 160
  assert.deepEqual(result.series, [
    { month: "2026-01", balance: 175 },
    { month: "2026-02", balance: 165 },
    { month: "2026-03", balance: 160 },
  ]);
});

test("parseMonthsParam reused for balance history allows 6/12/24", () => {
  assert.equal(parseMonthsParam(undefined), 12);
  assert.equal(parseMonthsParam("6"), 6);
  assert.throws(() => parseMonthsParam("3"), /months must be/);
});
