import { describe, expect, it } from "vitest";
import type { Category } from "../../api/categoriesApi";
import { categoryIdsForLedgerType } from "./categoryScope";

const categories: Category[] = [
  {
    id: 1,
    name: "Salary",
    parentId: null,
    ledgerType: "INCOME",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    name: "Bonus",
    parentId: 1,
    ledgerType: "INCOME",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 3,
    name: "Food",
    parentId: null,
    ledgerType: "EXPENSE",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 4,
    name: "Groceries",
    parentId: 3,
    ledgerType: "EXPENSE",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("categoryIdsForLedgerType", () => {
  it("keeps INCOME rows including roots", () => {
    expect([...categoryIdsForLedgerType(categories, "INCOME")].sort()).toEqual([
      1, 2,
    ]);
  });

  it("keeps EXPENSE rows including roots", () => {
    expect([...categoryIdsForLedgerType(categories, "EXPENSE")].sort()).toEqual([
      3, 4,
    ]);
  });

  it("returns an empty set when nothing matches", () => {
    expect(categoryIdsForLedgerType([], "INCOME").size).toBe(0);
  });
});
