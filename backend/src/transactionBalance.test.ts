import test from "node:test";
import assert from "node:assert/strict";
import {
  computeBalanceAfter,
  cashDelta,
  isValidTransactionType,
} from "./transactionBalance";

test("computeBalanceAfter income and expense", () => {
  assert.equal(computeBalanceAfter(500, "INCOME", 100), 600);
  assert.equal(computeBalanceAfter(600, "EXPENSE", 50), 550);
  assert.equal(computeBalanceAfter(0, "TRANSFER_IN", 1000), 1000);
  assert.equal(computeBalanceAfter(1000, "DIVIDEND", 25), 1025);
  assert.equal(computeBalanceAfter(1000, "INTEREST", 10), 1010);
});

test("computeBalanceAfter TRANSFER_OUT debits cash", () => {
  assert.equal(computeBalanceAfter(1000, "TRANSFER_OUT", 200), 800);
});

test("computeBalanceAfter rejects overdraft", () => {
  assert.throws(() => computeBalanceAfter(50, "EXPENSE", 100));
  assert.throws(() => computeBalanceAfter(50, "TRANSFER_OUT", 100));
});

test("computeBalanceAfter rejects non-positive amount", () => {
  assert.throws(() => computeBalanceAfter(100, "INCOME", 0));
  assert.throws(() => computeBalanceAfter(100, "EXPENSE", -10));
});

test("cashDelta credit and debit", () => {
  assert.equal(cashDelta("INCOME", 100), 100);
  assert.equal(cashDelta("TRANSFER_IN", 50), 50);
  assert.equal(cashDelta("DIVIDEND", 12), 12);
  assert.equal(cashDelta("INTEREST", 8), 8);
  assert.equal(cashDelta("EXPENSE", 50), -50);
  assert.equal(cashDelta("TRANSFER_OUT", 25), -25);
});

test("isValidTransactionType", () => {
  assert.equal(isValidTransactionType("INCOME"), true);
  assert.equal(isValidTransactionType("EXPENSE"), true);
  assert.equal(isValidTransactionType("TRANSFER_IN"), true);
  assert.equal(isValidTransactionType("TRANSFER_OUT"), true);
  assert.equal(isValidTransactionType("DIVIDEND"), true);
  assert.equal(isValidTransactionType("INTEREST"), true);
  assert.equal(isValidTransactionType(""), false);
});
