import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCategoriesCsv,
  CATEGORIES_CSV_HEADER,
  parseCategoriesCsv,
} from "./categoriesCsv";

describe("buildCategoriesCsv", () => {
  it("returns header-only when empty", () => {
    assert.equal(buildCategoriesCsv([]), `${CATEGORIES_CSV_HEADER}\n`);
  });

  it("sorts parents before children", () => {
    const csv = buildCategoriesCsv([
      { path: "Food/Groceries", ledgerType: "EXPENSE" },
      { path: "Salary", ledgerType: "INCOME" },
      { path: "Food", ledgerType: "EXPENSE" },
    ]);
    const lines = csv.trimEnd().split("\n");
    assert.equal(lines[0], CATEGORIES_CSV_HEADER);
    assert.equal(lines[1], "Food,EXPENSE");
    assert.equal(lines[2], "Salary,INCOME");
    assert.equal(lines[3], "Food/Groceries,EXPENSE");
  });
});

describe("parseCategoriesCsv", () => {
  it("round-trips build → parse", () => {
    const csv = buildCategoriesCsv([
      { path: "Food", ledgerType: "EXPENSE" },
      { path: "Food/Groceries", ledgerType: "EXPENSE" },
      { path: "Salary", ledgerType: "INCOME" },
    ]);
    const result = parseCategoriesCsv(csv);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.drafts.length, 3);
    assert.equal(result.drafts[0]!.path, "Food");
    assert.equal(result.drafts[1]!.path, "Salary");
    assert.equal(result.drafts[2]!.path, "Food/Groceries");
  });

  it("rejects wrong header and bad ledgerType", () => {
    assert.equal(parseCategoriesCsv("a,b\n").ok, false);
    const bad = parseCategoriesCsv(
      `${CATEGORIES_CSV_HEADER}\nFood,FOO\n`,
    );
    assert.equal(bad.ok, false);
    if (bad.ok) return;
    assert.match(bad.errors[0]!.message, /ledgerType/);
  });

  it("rejects conflicting ledgerType for the same path", () => {
    const csv = [
      CATEGORIES_CSV_HEADER,
      "Food,EXPENSE",
      "Food,INCOME",
    ].join("\n");
    const result = parseCategoriesCsv(csv);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.errors[0]!.message, /conflicting/);
  });

  it("accepts header-only", () => {
    const result = parseCategoriesCsv(`${CATEGORIES_CSV_HEADER}\n`);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.drafts.length, 0);
  });

  it("accepts TRANSFER ledgerType", () => {
    const csv = buildCategoriesCsv([
      { path: "Internal transfer", ledgerType: "TRANSFER" },
      { path: "Internal transfer/Savings", ledgerType: "TRANSFER" },
    ]);
    const result = parseCategoriesCsv(csv);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.drafts.length, 2);
    assert.equal(result.drafts[0]!.ledgerType, "TRANSFER");
    assert.equal(result.drafts[1]!.path, "Internal transfer/Savings");
  });
});
