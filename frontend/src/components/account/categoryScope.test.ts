import { describe, expect, it } from "vitest";
import type { Category } from "../../api/categoriesApi";
import { categoryIdsForLedgerType } from "./categoryScope";

const categories: Category[] = [
  {
    id: 1,
    name: "Przychody",
    parentId: null,
    ledgerType: "INCOME",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    name: "Salary",
    parentId: 1,
    ledgerType: "INCOME",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 3,
    name: "Wydatki",
    parentId: null,
    ledgerType: "EXPENSE",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 4,
    name: "Food",
    parentId: 3,
    ledgerType: "EXPENSE",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("categoryIdsForLedgerType", () => {
  it("keeps INCOME rows including renamed roots", () => {
    expect([...categoryIdsForLedgerType(categories, "INCOME")].sort()).toEqual([
      1, 2,
    ]);
  });

  it("keeps EXPENSE rows including renamed roots", () => {
    expect([...categoryIdsForLedgerType(categories, "EXPENSE")].sort()).toEqual([
      3, 4,
    ]);
  });

  it("excludes roots when requested for ledger pickers", () => {
    expect([
      ...categoryIdsForLedgerType(categories, "INCOME", { excludeRoots: true }),
    ]).toEqual([2]);
    expect([
      ...categoryIdsForLedgerType(categories, "EXPENSE", { excludeRoots: true }),
    ]).toEqual([4]);
  });

  it("returns an empty set when nothing matches", () => {
    expect(categoryIdsForLedgerType([], "INCOME").size).toBe(0);
  });
});
