import test from "node:test";
import assert from "node:assert/strict";
import {
  computeCashflowStats,
  computeCashflowHistory,
  computeCategoryBreakdown,
  computeRollingMonthlyAverages,
  enumerateCalendarMonths,
  isCashflowExpenseType,
  isCashflowIncomeType,
  last12CompleteCalendarMonths,
  requireTransactionDateFilter,
} from "./stats";
import { transactionDateFilter } from "./routes/routeSupport";

test("isCashflowIncomeType and isCashflowExpenseType classify transaction types", () => {
  assert.equal(isCashflowIncomeType("INCOME"), true);
  assert.equal(isCashflowIncomeType("DIVIDEND"), true);
  assert.equal(isCashflowIncomeType("TRANSFER_IN"), false);
  assert.equal(isCashflowExpenseType("EXPENSE"), true);
  assert.equal(isCashflowExpenseType("TRANSFER_OUT"), false);
});

test("requireTransactionDateFilter rejects missing range", () => {
  assert.throws(
    () => requireTransactionDateFilter(transactionDateFilter),
    /from and to query parameters are required/,
  );
  assert.throws(
    () => requireTransactionDateFilter(transactionDateFilter, "2025-01-01"),
    /from and to query parameters are required/,
  );
});

test("requireTransactionDateFilter accepts from and to", () => {
  const date = requireTransactionDateFilter(
    transactionDateFilter,
    "2025-01-01",
    "2025-01-31",
  );
  assert.ok(date.gte);
  assert.ok(date.lte);
});

test("computeCashflowStats sums income and expense", () => {
  const plnPerUnit = { PLN: 1 };
  const convert = (amount: number, from: string, to: string) => (from === to ? amount : amount);
  const result = computeCashflowStats(
    [
      { amount: 100, currency: "PLN", transactionType: "INCOME", category: "SALARY" },
      { amount: 30, currency: "PLN", transactionType: "EXPENSE", category: "FOOD" },
      { amount: 20, currency: "PLN", transactionType: "TRANSFER_OUT", category: "X" },
    ],
    "PLN",
    convert,
    Number,
    plnPerUnit,
  );
  assert.equal(result.income, 100);
  assert.equal(result.expense, 30);
  assert.equal(result.net, 70);
});

test("computeCashflowStats excludes internal transfers", () => {
  const plnPerUnit = { PLN: 1 };
  const convert = (amount: number, from: string, to: string) => (from === to ? amount : amount);
  const result = computeCashflowStats(
    [
      { amount: 100, currency: "PLN", transactionType: "INCOME", category: "SALARY" },
      { amount: 50, currency: "PLN", transactionType: "TRANSFER_IN", category: "FUNDING" },
      { amount: 20, currency: "PLN", transactionType: "TRANSFER_OUT", category: "MOVE" },
    ],
    "PLN",
    convert,
    Number,
    plnPerUnit,
  );
  assert.equal(result.income, 100);
  assert.equal(result.expense, 0);
  assert.equal(result.net, 100);
});

test("computeCashflowStats ignores non-cashflow transaction types", () => {
  const plnPerUnit = { PLN: 1 };
  const convert = (amount: number, from: string, to: string) => (from === to ? amount : amount);
  const result = computeCashflowStats(
    [{ amount: 99, currency: "PLN", transactionType: "ADJUSTMENT", category: "X" }],
    "PLN",
    convert,
    Number,
    plnPerUnit,
  );
  assert.equal(result.income, 0);
  assert.equal(result.expense, 0);
  assert.equal(result.net, 0);
});

test("computeCashflowStats counts DIVIDEND and INTEREST as income", () => {
  const plnPerUnit = { PLN: 1 };
  const convert = (amount: number, from: string, to: string) => (from === to ? amount : amount);
  const result = computeCashflowStats(
    [
      { amount: 40, currency: "PLN", transactionType: "DIVIDEND", category: "DIVIDEND" },
      { amount: 5, currency: "PLN", transactionType: "INTEREST", category: "INTEREST" },
    ],
    "PLN",
    convert,
    Number,
    plnPerUnit,
  );
  assert.equal(result.income, 45);
  assert.equal(result.expense, 0);
  assert.equal(result.net, 45);
});

test("computeCategoryBreakdown groups by category", () => {
  const plnPerUnit = { PLN: 1 };
  const convert = (amount: number, from: string, to: string) => (from === to ? amount : amount);
  const rows = computeCategoryBreakdown(
    [
      { amount: 10, currency: "PLN", transactionType: "EXPENSE", category: "FOOD" },
      { amount: 5, currency: "PLN", transactionType: "EXPENSE", category: "FOOD" },
      { amount: 3, currency: "PLN", transactionType: "EXPENSE", category: "TRAVEL" },
    ],
    "PLN",
    convert,
    Number,
    plnPerUnit,
  );
  assert.deepEqual(rows.sort((a, b) => a.category.localeCompare(b.category)), [
    { category: "FOOD", amount: 15 },
    { category: "TRAVEL", amount: 3 },
  ]);
});

test("enumerateCalendarMonths lists inclusive months", () => {
  const months = enumerateCalendarMonths(
    new Date("2025-01-15T12:00:00.000Z"),
    new Date("2025-03-10T12:00:00.000Z"),
  );
  assert.deepEqual(months, ["2025-01", "2025-02", "2025-03"]);
});

test("computeCashflowHistory buckets by month and fills zeros", () => {
  const plnPerUnit = { PLN: 1 };
  const convert = (amount: number, from: string, to: string) => (from === to ? amount : amount);
  const points = computeCashflowHistory(
    [
      {
        amount: 100,
        currency: "PLN",
        transactionType: "INCOME",
        category: "SALARY",
        date: new Date("2025-01-10T12:00:00.000Z"),
      },
      {
        amount: 40,
        currency: "PLN",
        transactionType: "EXPENSE",
        category: "FOOD",
        date: new Date("2025-01-20T12:00:00.000Z"),
      },
      {
        amount: 25,
        currency: "PLN",
        transactionType: "EXPENSE",
        category: "TRAVEL",
        date: new Date("2025-02-05T12:00:00.000Z"),
      },
    ],
    ["2025-01", "2025-02"],
    "PLN",
    convert,
    Number,
    plnPerUnit,
  );
  assert.deepEqual(points, [
    { month: "2025-01", income: 100, expense: 40, net: 60 },
    { month: "2025-02", income: 0, expense: 25, net: -25 },
  ]);
});

test("computeRollingMonthlyAverages returns mean monthly values", () => {
  const result = computeRollingMonthlyAverages([
    { month: "2025-01", income: 100, expense: 40, net: 60 },
    { month: "2025-02", income: 200, expense: 50, net: 150 },
  ]);
  assert.equal(result.avgIncome, 150);
  assert.equal(result.avgExpense, 45);
  assert.equal(result.avgNet, 105);
});

test("last12CompleteCalendarMonths spans twelve months ending previous month", () => {
  const { months, from, to } = last12CompleteCalendarMonths(new Date("2025-06-15T12:00:00.000Z"));
  assert.equal(months.length, 12);
  assert.equal(months[0], "2024-06");
  assert.equal(months[11], "2025-05");
  assert.equal(from.getFullYear(), 2024);
  assert.equal(from.getMonth(), 5);
  assert.equal(to.getFullYear(), 2025);
  assert.equal(to.getMonth(), 4);
});
