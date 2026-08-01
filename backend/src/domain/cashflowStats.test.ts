import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateCashflowHistory,
  aggregatePeriodSummary,
  aggregateRollingCashflow12m,
  completeMonthsBefore,
  listMonthsEndingAt,
  parseCurrencyParam,
  parseMonthsParam,
} from "./cashflowStats";

test("parseCurrencyParam requires 3-letter uppercase code", () => {
  assert.equal(parseCurrencyParam("pln"), "PLN");
  assert.equal(parseCurrencyParam("EUR"), "EUR");
  assert.throws(() => parseCurrencyParam(""), /currency required/);
  assert.throws(() => parseCurrencyParam(undefined), /currency required/);
  assert.throws(() => parseCurrencyParam("US"), /3-letter/);
  assert.throws(() => parseCurrencyParam("123"), /3-letter/);
});

test("parseMonthsParam defaults to 12 and allows 6/12/24", () => {
  assert.equal(parseMonthsParam(undefined), 12);
  assert.equal(parseMonthsParam(""), 12);
  assert.equal(parseMonthsParam("6"), 6);
  assert.equal(parseMonthsParam(12), 12);
  assert.equal(parseMonthsParam("24"), 24);
  assert.throws(() => parseMonthsParam("5"), /months must be/);
  assert.throws(() => parseMonthsParam("0"), /months must be/);
  assert.throws(() => parseMonthsParam("abc"), /months must be/);
});

test("listMonthsEndingAt returns oldest-to-newest including year rollover", () => {
  assert.deepEqual(listMonthsEndingAt("2026-01", 3), [
    "2025-11",
    "2025-12",
    "2026-01",
  ]);
  assert.deepEqual(listMonthsEndingAt("2026-08", 1), ["2026-08"]);
  const twelve = listMonthsEndingAt("2026-01", 12);
  assert.equal(twelve.length, 12);
  assert.equal(twelve[0], "2025-02");
  assert.equal(twelve[11], "2026-01");
});

test("aggregatePeriodSummary sums one currency and ignores others", () => {
  const result = aggregatePeriodSummary("2026-08", "PLN", [
    {
      type: "INCOME",
      amount: 5000,
      occurredAt: new Date("2026-08-10T12:00:00.000Z"),
      account: { currency: "PLN" },
    },
    {
      type: "EXPENSE",
      amount: 200,
      occurredAt: new Date("2026-08-11T12:00:00.000Z"),
      account: { currency: "PLN" },
    },
    {
      type: "EXPENSE",
      amount: 50,
      occurredAt: new Date("2026-08-11T12:00:00.000Z"),
      account: { currency: "EUR" },
    },
    {
      type: "TRANSFER",
      amount: 10,
      occurredAt: new Date("2026-08-11T12:00:00.000Z"),
      account: { currency: "PLN" },
    },
  ]);
  assert.deepEqual(result, {
    month: "2026-08",
    currency: "PLN",
    income: 5000,
    expense: 200,
    net: 4800,
  });
});

test("aggregateCashflowHistory zero-fills and buckets by UTC month", () => {
  const months = listMonthsEndingAt("2026-03", 3);
  const result = aggregateCashflowHistory(months, "USD", [
    {
      type: "INCOME",
      amount: 100,
      occurredAt: new Date("2026-01-15T00:00:00.000Z"),
      account: { currency: "USD" },
    },
    {
      type: "EXPENSE",
      amount: 40,
      occurredAt: new Date("2026-03-01T00:00:00.000Z"),
      account: { currency: "USD" },
    },
    {
      type: "INCOME",
      amount: 999,
      occurredAt: new Date("2025-12-31T23:59:59.000Z"),
      account: { currency: "USD" },
    },
  ]);
  assert.equal(result.monthCount, 3);
  assert.equal(result.currency, "USD");
  assert.deepEqual(result.series, [
    { month: "2026-01", income: 100, expense: 0, net: 100 },
    { month: "2026-02", income: 0, expense: 0, net: 0 },
    { month: "2026-03", income: 0, expense: 40, net: -40 },
  ]);
});

test("completeMonthsBefore excludes current UTC month and spans year boundary", () => {
  const months = completeMonthsBefore(new Date("2026-01-15T12:00:00.000Z"), 12);
  assert.equal(months.length, 12);
  assert.equal(months[0], "2025-01");
  assert.equal(months[11], "2025-12");
});

test("aggregateRollingCashflow12m averages over 12 complete months and ignores current month", () => {
  const asOf = new Date("2026-08-10T00:00:00.000Z");
  const result = aggregateRollingCashflow12m(
    "PLN",
    [
      {
        type: "INCOME",
        amount: 1200,
        occurredAt: new Date("2026-07-05T00:00:00.000Z"),
        account: { currency: "PLN" },
      },
      {
        type: "EXPENSE",
        amount: 240,
        occurredAt: new Date("2026-07-20T00:00:00.000Z"),
        account: { currency: "PLN" },
      },
      {
        type: "INCOME",
        amount: 9999,
        occurredAt: new Date("2026-08-01T00:00:00.000Z"),
        account: { currency: "PLN" },
      },
    ],
    asOf,
  );
  assert.equal(result.monthCount, 12);
  assert.equal(result.fromMonth, "2025-08");
  assert.equal(result.toMonth, "2026-07");
  assert.equal(result.avgIncome, 100);
  assert.equal(result.avgExpense, 20);
  assert.equal(result.avgNet, 80);
});
