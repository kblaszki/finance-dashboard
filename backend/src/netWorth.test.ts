import test from "node:test";
import assert from "node:assert/strict";
import { sumAccountsInDisplayCurrency } from "./netWorth";

const MOCK_RATES: Record<string, number> = { PLN: 1, USD: 4, EUR: 4.3 };

const SAMPLE_ACCOUNTS = [
  {
    id: 1,
    name: "Bank",
    accountType: "BANK",
    currency: "PLN",
    cashBalance: 15000,
    valueNative: 15000,
  },
  {
    id: 2,
    name: "Broker USD",
    accountType: "BROKERAGE",
    currency: "USD",
    cashBalance: 10000,
    valueNative: 10000,
  },
  {
    id: 3,
    name: "Broker EUR",
    accountType: "BROKERAGE",
    currency: "EUR",
    cashBalance: 8600,
    valueNative: 8600,
  },
];

test("sumAccountsInDisplayCurrency converts multi-currency accounts to PLN", () => {
  const result = sumAccountsInDisplayCurrency(SAMPLE_ACCOUNTS, "PLN", MOCK_RATES);

  assert.equal(result.total, 91980);
  assert.equal(result.currency, "PLN");
  assert.equal(result.byAccountType.BANK, 15000);
  assert.equal(result.byAccountType.BROKERAGE, 76980);
  assert.equal(result.accounts.length, 3);
  assert.equal(result.accounts[1]!.value, 40000);
  assert.equal(result.accounts[2]!.value, 36980);
});

test("sumAccountsInDisplayCurrency converts to EUR display currency", () => {
  const result = sumAccountsInDisplayCurrency(SAMPLE_ACCOUNTS, "EUR", MOCK_RATES);
  const expectedTotal = (15000 / 4.3) + (40000 / 4.3) + 8600;

  assert.ok(Math.abs(result.total - expectedTotal) < 0.0001);
  assert.equal(result.currency, "EUR");
  assert.equal(result.accounts[0]!.value, 15000 / 4.3);
  assert.equal(result.accounts[1]!.value, 40000 / 4.3);
});

test("sumAccountsInDisplayCurrency converts to USD display currency", () => {
  const result = sumAccountsInDisplayCurrency(SAMPLE_ACCOUNTS, "USD", MOCK_RATES);
  const expectedTotal = 15000 / 4 + 10000 + 36980 / 4;

  assert.ok(Math.abs(result.total - expectedTotal) < 0.0001);
  assert.equal(result.currency, "USD");
});

test("sumAccountsInDisplayCurrency empty accounts", () => {
  const result = sumAccountsInDisplayCurrency([], "PLN", MOCK_RATES);

  assert.equal(result.total, 0);
  assert.deepEqual(result.byAccountType, {});
  assert.deepEqual(result.accounts, []);
});
