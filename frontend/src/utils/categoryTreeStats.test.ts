import { describe, expect, it } from "vitest";
import type { Category } from "../api/categoriesApi";
import type { CategoryBreakdownRow } from "../api/statisticsApi";
import {
  buildCategoryTreeRows,
  visibleCategoryTreeRows,
} from "./categoryTreeStats";

function cat(
  id: number,
  name: string,
  parentId: number | null,
  ledgerType: Category["ledgerType"] = "EXPENSE",
): Category {
  return {
    id,
    name,
    parentId,
    ledgerType,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function row(
  categoryId: number | null,
  categoryName: string,
  total: number,
  count: number,
  currency = "PLN",
): CategoryBreakdownRow {
  return { categoryId, categoryName, currency, total, count };
}

describe("buildCategoryTreeRows", () => {
  const categories: Category[] = [
    cat(1, "Food", null),
    cat(2, "Groceries", 1),
    cat(3, "Supermarket", 2),
    cat(4, "Markets", 2),
    cat(5, "Dining", 1),
    cat(6, "Restaurants", 5),
    cat(10, "Salary", null, "INCOME"),
  ];

  it("rolls leaf amounts up to parents and nests by depth", () => {
    const rows = [
      row(3, "Supermarket", 300, 3),
      row(4, "Markets", 100, 1),
      row(6, "Restaurants", 50, 2),
    ];

    const tree = buildCategoryTreeRows(rows, categories, "PLN");
    const byKey = Object.fromEntries(tree.map((r) => [r.key, r]));

    expect(byKey["cat-1"].rolledTotal).toBe(450);
    expect(byKey["cat-1"].rolledCount).toBe(6);
    expect(byKey["cat-1"].depth).toBe(0);
    expect(byKey["cat-1"].isRoot).toBe(true);

    expect(byKey["cat-2"].rolledTotal).toBe(400);
    expect(byKey["cat-2"].depth).toBe(1);
    expect(byKey["cat-3"].rolledTotal).toBe(300);
    expect(byKey["cat-3"].depth).toBe(2);
    expect(byKey["cat-6"].rolledTotal).toBe(50);
    expect(byKey["cat-6"].depth).toBe(2);

    expect(tree.map((r) => r.name)).toEqual([
      "Food",
      "Groceries",
      "Supermarket",
      "Markets",
      "Dining",
      "Restaurants",
    ]);
    expect(tree.some((r) => r.key === "cat-10")).toBe(false);
  });

  it("includes Uncategorized as a root-level row", () => {
    const tree = buildCategoryTreeRows(
      [row(null, "Uncategorized", 40, 2), row(3, "Supermarket", 10, 1)],
      categories,
      "PLN",
    );
    const last = tree[tree.length - 1]!;
    expect(last).toMatchObject({
      key: "uncategorized",
      name: "Uncategorized",
      depth: 0,
      isRoot: true,
      rolledTotal: 40,
      rolledCount: 2,
    });
    expect(tree.find((r) => r.key === "cat-1")!.rolledTotal).toBe(10);
  });

  it("filters by currency and prunes empty branches", () => {
    const tree = buildCategoryTreeRows(
      [
        row(3, "Supermarket", 20, 1, "PLN"),
        row(6, "Restaurants", 99, 5, "EUR"),
      ],
      categories,
      "PLN",
    );
    expect(tree.map((r) => r.name)).toEqual([
      "Food",
      "Groceries",
      "Supermarket",
    ]);
    expect(tree.find((r) => r.key === "cat-1")!.hasChildren).toBe(true);
    expect(tree.find((r) => r.key === "cat-3")!.hasChildren).toBe(false);
  });

  it("visibleCategoryTreeRows collapses descendants until parents expand", () => {
    const tree = buildCategoryTreeRows(
      [
        row(3, "Supermarket", 300, 3),
        row(4, "Markets", 100, 1),
        row(6, "Restaurants", 50, 2),
      ],
      categories,
      "PLN",
    );

    expect(visibleCategoryTreeRows(tree, new Set()).map((r) => r.name)).toEqual(
      ["Food"],
    );

    expect(
      visibleCategoryTreeRows(tree, new Set(["cat-1"])).map((r) => r.name),
    ).toEqual(["Food", "Groceries", "Dining"]);

    expect(
      visibleCategoryTreeRows(
        tree,
        new Set(["cat-1", "cat-2"]),
      ).map((r) => r.name),
    ).toEqual(["Food", "Groceries", "Supermarket", "Markets", "Dining"]);
  });
});
