import test from "node:test";
import assert from "node:assert/strict";
import {
  computeCashflowStats,
  computeCategoryBreakdown,
  requireTransactionDateFilter,
} from "./stats";
import { transactionDateFilter } from "./routes/routeSupport";

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
  assert.equal(result.expense, 50);
  assert.equal(result.net, 50);
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
