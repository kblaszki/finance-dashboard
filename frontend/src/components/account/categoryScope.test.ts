import { describe, expect, it } from "vitest";
import type { Category } from "../../api/categoriesApi";
import { categoryIdsUnderRoot } from "./categoryScope";

const categories: Category[] = [
  { id: 1, name: "Income", parentId: null, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: 2, name: "Salary", parentId: 1, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: 3, name: "Expense", parentId: null, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: 4, name: "Food", parentId: 3, createdAt: "2026-01-01T00:00:00.000Z" },
];

describe("categoryIdsUnderRoot", () => {
  it("keeps Income descendants and drops Expense rows", () => {
    expect([...categoryIdsUnderRoot(categories, "Income")].sort()).toEqual([1, 2]);
  });

  it("keeps Expense descendants and drops Income rows", () => {
    expect([...categoryIdsUnderRoot(categories, "Expense")].sort()).toEqual([3, 4]);
  });

  it("returns an empty set when the root is missing", () => {
    expect(categoryIdsUnderRoot([], "Income").size).toBe(0);
  });
});
