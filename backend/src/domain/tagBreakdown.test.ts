import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregateTagBreakdown } from "./tagBreakdown";

describe("aggregateTagBreakdown", () => {
  it("attributes full amount to each tag and tracks untagged", () => {
    const result = aggregateTagBreakdown("2026-08", "PLN", [
      {
        type: "EXPENSE",
        amount: 100,
        account: { currency: "PLN" },
        cashTransactionTags: [
          { tag: { id: 1, name: "Lidl" } },
          { tag: { id: 2, name: "food" } },
        ],
      },
      {
        type: "EXPENSE",
        amount: 40,
        account: { currency: "PLN" },
        cashTransactionTags: [],
      },
      {
        type: "INCOME",
        amount: 50,
        account: { currency: "PLN" },
        cashTransactionTags: [{ tag: { id: 3, name: "bonus" } }],
      },
      {
        type: "TRANSFER_OUT",
        amount: 999,
        account: { currency: "PLN" },
        cashTransactionTags: [{ tag: { id: 1, name: "Lidl" } }],
      },
    ]);

    assert.equal(result.expense.find((r) => r.tagId === 1)?.total, 100);
    assert.equal(result.expense.find((r) => r.tagId === 2)?.total, 100);
    assert.equal(result.untagged.expense, 40);
    assert.equal(result.untagged.expenseCount, 1);
    assert.equal(result.income[0]?.tagName, "bonus");
    assert.equal(result.income[0]?.total, 50);
  });
});
