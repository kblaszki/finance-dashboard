import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  expectedCategoryLedgerType,
  parseLedgerType,
} from "./categories";

describe("parseLedgerType", () => {
  it("accepts INCOME, EXPENSE, and TRANSFER", () => {
    assert.equal(parseLedgerType("income"), "INCOME");
    assert.equal(parseLedgerType("EXPENSE"), "EXPENSE");
    assert.equal(parseLedgerType("Transfer"), "TRANSFER");
  });

  it("rejects unknown values", () => {
    assert.throws(() => parseLedgerType("FOO"), /INCOME, EXPENSE, or TRANSFER/);
  });
});

describe("expectedCategoryLedgerType", () => {
  it("maps cash and transfer tx types", () => {
    assert.equal(expectedCategoryLedgerType("INCOME"), "INCOME");
    assert.equal(expectedCategoryLedgerType("EXPENSE"), "EXPENSE");
    assert.equal(expectedCategoryLedgerType("TRANSFER_IN"), "TRANSFER");
    assert.equal(expectedCategoryLedgerType("TRANSFER_OUT"), "TRANSFER");
    assert.equal(expectedCategoryLedgerType("TRANSFER"), "TRANSFER");
  });
});
