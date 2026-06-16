import test from "node:test";
import assert from "node:assert/strict";
import { computeBalanceAfter } from "./transactionBalance";

test("computeBalanceAfter income and expense", () => {
  assert.equal(computeBalanceAfter(500, "INCOME", 100), 600);
  assert.equal(computeBalanceAfter(600, "EXPENSE", 50), 550);
  assert.equal(computeBalanceAfter(0, "TRANSFER_IN", 1000), 1000);
});

test("computeBalanceAfter rejects overdraft", () => {
  assert.throws(() => computeBalanceAfter(50, "EXPENSE", 100));
});
