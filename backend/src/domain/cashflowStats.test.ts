import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import {
  aggregateCashflowHistory,
  aggregatePeriodSummary,
  aggregateRollingCashflow12m,
  completeMonthsBefore,
  listMonthsEndingAt,
  parseCurrencyParam,
  parseMonthsParam,
} from "./cashflowStats";
import type { GetMidFn } from "./fx";

function midMap(mids: Record<string, number>): GetMidFn {
  return async (currency) => {
    const mid = mids[currency];
    if (mid == null) throw new Error(`missing mid ${currency}`);
    return new Prisma.Decimal(mid);
  };
}

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

test("aggregatePeriodSummary converts all FX currencies into reporting PLN", async () => {
  const result = await aggregatePeriodSummary(
    "2026-08",
    "PLN",
    [
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
        type: "TRANSFER_IN",
        amount: 10,
        occurredAt: new Date("2026-08-11T12:00:00.000Z"),
        account: { currency: "PLN" },
      },
    ],
    {
      getMid: midMap({ EUR: 4, USD: 4 }),
      transferRows: [
        {
          amountFrom: 100,
          occurredAt: new Date("2026-08-12T12:00:00.000Z"),
          fromAccount: { currency: "USD" },
        },
      ],
    },
  );
  assert.deepEqual(result, {
    month: "2026-08",
    period: "month",
    label: "2026-08",
    currency: "PLN",
    income: 5000,
    expense: 400,
    net: 4600,
    transfers: 400,
  });
});

test("aggregatePeriodSummary can report in EUR via PLN pivot", async () => {
  const result = await aggregatePeriodSummary(
    "2026-08",
    "EUR",
    [
      {
        type: "INCOME",
        amount: 400,
        occurredAt: new Date("2026-08-10T12:00:00.000Z"),
        account: { currency: "PLN" },
      },
      {
        type: "EXPENSE",
        amount: 25,
        occurredAt: new Date("2026-08-11T12:00:00.000Z"),
        account: { currency: "EUR" },
      },
    ],
    { getMid: midMap({ EUR: 4, USD: 4 }) },
  );
  assert.equal(result.currency, "EUR");
  assert.equal(result.income, 100);
  assert.equal(result.expense, 25);
  assert.equal(result.net, 75);
});

test("aggregatePeriodSummary fails when a required mid is missing", async () => {
  await assert.rejects(
    () =>
      aggregatePeriodSummary(
        "2026-08",
        "PLN",
        [
          {
            type: "INCOME",
            amount: 10,
            occurredAt: new Date("2026-08-10T12:00:00.000Z"),
            account: { currency: "USD" },
          },
        ],
        { getMid: midMap({ EUR: 4 }) },
      ),
    /missing mid USD/,
  );
});

test("aggregatePeriodSummary rejects unsupported account currencies", async () => {
  await assert.rejects(
    () =>
      aggregatePeriodSummary(
        "2026-08",
        "PLN",
        [
          {
            type: "INCOME",
            amount: 10,
            occurredAt: new Date("2026-08-10T12:00:00.000Z"),
            account: { currency: "GBP" },
          },
        ],
        { getMid: midMap({ EUR: 4, USD: 4 }) },
      ),
    /Unsupported account currency GBP/,
  );
});

test("aggregatePeriodSummary returns zeros for empty period", async () => {
  const result = await aggregatePeriodSummary("2026-08", "PLN", [], {
    getMid: midMap({ EUR: 4, USD: 4 }),
  });
  assert.deepEqual(result, {
    month: "2026-08",
    period: "month",
    label: "2026-08",
    currency: "PLN",
    income: 0,
    expense: 0,
    net: 0,
    transfers: 0,
  });
});

test("aggregateCashflowHistory converts and zero-fills by UTC month", async () => {
  const months = listMonthsEndingAt("2026-03", 3);
  const result = await aggregateCashflowHistory(
    months,
    "PLN",
    [
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
        account: { currency: "PLN" },
      },
      {
        type: "INCOME",
        amount: 999,
        occurredAt: new Date("2025-12-31T23:59:59.000Z"),
        account: { currency: "USD" },
      },
    ],
    midMap({ EUR: 4, USD: 4 }),
  );
  assert.equal(result.monthCount, 3);
  assert.equal(result.currency, "PLN");
  assert.deepEqual(result.series, [
    { month: "2026-01", income: 400, expense: 0, net: 400 },
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

test("aggregateRollingCashflow12m averages converted series over 12 complete months", async () => {
  const asOf = new Date("2026-08-10T00:00:00.000Z");
  const result = await aggregateRollingCashflow12m(
    "PLN",
    [
      {
        type: "INCOME",
        amount: 300,
        occurredAt: new Date("2026-07-05T00:00:00.000Z"),
        account: { currency: "USD" },
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
    midMap({ EUR: 4, USD: 4 }),
    asOf,
  );
  assert.equal(result.monthCount, 12);
  assert.equal(result.fromMonth, "2025-08");
  assert.equal(result.toMonth, "2026-07");
  // July: income 300 USD * 4 = 1200, expense 240 → net 960; avg over 12 months
  assert.equal(result.avgIncome, 100);
  assert.equal(result.avgExpense, 20);
  assert.equal(result.avgNet, 80);
});
