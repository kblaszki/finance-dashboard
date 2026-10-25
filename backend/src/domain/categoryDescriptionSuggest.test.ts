import test from "node:test";
import assert from "node:assert/strict";
import {
  collectUsedDescriptions,
  mergeDescriptionSuggestions,
  parseDescriptionMappings,
  suggestFromHistory,
  suggestFromRules,
} from "./categoryDescriptionSuggest";
import type { CashLedgerImportDraft } from "./cashLedgerCsvImport";

function draft(
  partial: Partial<CashLedgerImportDraft> & Pick<CashLedgerImportDraft, "row">,
): CashLedgerImportDraft {
  return {
    type: "EXPENSE",
    amount: 10,
    occurredAt: new Date("2026-01-01T12:00:00.000Z"),
    description: "Zabka shop",
    categoryPath: null,
    ...partial,
  };
}

test("collectUsedDescriptions skips path rows and empty desc", () => {
  const used = collectUsedDescriptions([
    draft({ row: 1, description: "Zabka" }),
    draft({ row: 2, description: "  zabka  " }),
    draft({ row: 3, description: null }),
    draft({ row: 4, description: "X", categoryPath: ["Food"] }),
  ]);
  assert.equal(used.length, 1);
  assert.equal(used[0]!.descriptionKey, "zabka");
  assert.equal(used[0]!.rowCount, 2);
});

test("suggestFromRules longest pattern wins", () => {
  const used = collectUsedDescriptions([
    draft({ row: 1, description: "zabka express warsaw" }),
  ]);
  const hits = suggestFromRules(
    used,
    [
      {
        id: 1,
        pattern: "zabka",
        patternKey: "zabka",
        ledgerType: "EXPENSE",
        categoryId: 10,
      },
      {
        id: 2,
        pattern: "zabka express",
        patternKey: "zabka express",
        ledgerType: "EXPENSE",
        categoryId: 20,
      },
    ],
    [
      { id: 10, ledgerType: "EXPENSE" },
      { id: 20, ledgerType: "EXPENSE" },
    ],
  );
  assert.equal(hits.get("EXPENSE\0zabka express warsaw"), 20);
});

test("suggestFromHistory picks latest matching category", () => {
  const used = collectUsedDescriptions([draft({ row: 1, description: "Uber" })]);
  const hits = suggestFromHistory(used, [
    {
      id: 1,
      type: "EXPENSE",
      description: "Uber",
      categoryId: 5,
      occurredAt: new Date("2025-01-01T00:00:00.000Z"),
      categoryLedgerType: "EXPENSE",
    },
    {
      id: 2,
      type: "EXPENSE",
      description: "uber",
      categoryId: 6,
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      categoryLedgerType: "EXPENSE",
    },
  ]);
  assert.equal(hits.get("EXPENSE\0uber"), 6);
});

test("mergeDescriptionSuggestions prefers rules over history", () => {
  const used = collectUsedDescriptions([draft({ row: 1, description: "Zabka" })]);
  const merged = mergeDescriptionSuggestions(
    used,
    new Map([["EXPENSE\0zabka", 1]]),
    new Map([["EXPENSE\0zabka", 2]]),
  );
  assert.equal(merged[0]!.suggestedCategoryId, 1);
  assert.equal(merged[0]!.suggestionSource, "rule");
});

test("parseDescriptionMappings requires complete coverage", () => {
  const used = collectUsedDescriptions([draft({ row: 1, description: "A" })]);
  const bad = parseDescriptionMappings([], used);
  assert.equal(bad.ok, false);
  const ok = parseDescriptionMappings(
    [{ descriptionKey: "a", ledgerType: "EXPENSE", action: "none" }],
    used,
  );
  assert.equal(ok.ok, true);
});
