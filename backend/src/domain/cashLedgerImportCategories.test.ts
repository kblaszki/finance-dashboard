import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectUsedCategories,
  parseCategoryMappings,
  suggestCategoryMatches,
} from "./cashLedgerImportCategories";
import type { CashLedgerImportDraft } from "./cashLedgerCsvImport";

function draft(
  partial: Partial<CashLedgerImportDraft> & Pick<CashLedgerImportDraft, "row" | "type">,
): CashLedgerImportDraft {
  return {
    amount: 1,
    occurredAt: new Date("2024-01-01T00:00:00.000Z"),
    description: null,
    categoryPath: null,
    ...partial,
  };
}

describe("collectUsedCategories", () => {
  it("groups by path and ledgerType", () => {
    const used = collectUsedCategories([
      draft({ row: 1, type: "EXPENSE", categoryPath: ["Food"] }),
      draft({ row: 2, type: "EXPENSE", categoryPath: ["Food"] }),
      draft({ row: 3, type: "INCOME", categoryPath: ["Salary"] }),
      draft({ row: 4, type: "EXPENSE", categoryPath: null }),
    ]);
    assert.equal(used.length, 2);
    const food = used.find((u) => u.path === "Food");
    assert.ok(food);
    assert.equal(food!.rowCount, 2);
    assert.equal(food!.ledgerType, "EXPENSE");
  });
});

describe("suggestCategoryMatches", () => {
  it("suggests exact case-insensitive path with matching ledgerType", () => {
    const used = collectUsedCategories([
      draft({ row: 1, type: "EXPENSE", categoryPath: ["Food", "Groceries"] }),
      draft({ row: 2, type: "INCOME", categoryPath: ["Salary"] }),
      draft({ row: 3, type: "EXPENSE", categoryPath: ["Missing"] }),
    ]);
    const preview = suggestCategoryMatches(used, [
      { id: 10, name: "Food", parentId: null, ledgerType: "EXPENSE" },
      { id: 11, name: "groceries", parentId: 10, ledgerType: "EXPENSE" },
      { id: 20, name: "Salary", parentId: null, ledgerType: "INCOME" },
    ]);
    const groceries = preview.find((p) => p.path === "Food/Groceries");
    const salary = preview.find((p) => p.path === "Salary");
    const missing = preview.find((p) => p.path === "Missing");
    assert.equal(groceries!.suggestedCategoryId, 11);
    assert.equal(salary!.suggestedCategoryId, 20);
    assert.equal(missing!.suggestedCategoryId, null);
  });
});

describe("parseCategoryMappings", () => {
  const used = collectUsedCategories([
    draft({ row: 1, type: "EXPENSE", categoryPath: ["Food"] }),
    draft({ row: 2, type: "INCOME", categoryPath: ["Salary"] }),
  ]);

  it("accepts a complete mapping set", () => {
    const result = parseCategoryMappings(
      [
        { path: "Food", ledgerType: "EXPENSE", action: "map", categoryId: 2 },
        { path: "Salary", ledgerType: "INCOME", action: "create" },
      ],
      used,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.mappings.length, 2);
  });

  it("rejects missing and extra mappings", () => {
    const missing = parseCategoryMappings(
      [{ path: "Food", ledgerType: "EXPENSE", action: "none" }],
      used,
    );
    assert.equal(missing.ok, false);
    if (missing.ok) return;
    assert.match(missing.errors.map((e) => e.message).join("; "), /missing mapping.*Salary/);

    const extra = parseCategoryMappings(
      [
        { path: "Food", ledgerType: "EXPENSE", action: "none" },
        { path: "Salary", ledgerType: "INCOME", action: "none" },
        { path: "Other", ledgerType: "EXPENSE", action: "none" },
      ],
      used,
    );
    assert.equal(extra.ok, false);
  });

  it("allows empty mappings when CSV has no categories", () => {
    const result = parseCategoryMappings([], []);
    assert.equal(result.ok, true);
    const omitted = parseCategoryMappings(undefined, []);
    assert.equal(omitted.ok, true);
  });
});
