import { describe, expect, it } from "vitest";
import type { Category } from "../api/categoriesApi";
import { rollupByParent, tagRollupRows, withUntagged } from "./statisticsRollup";

const categories: Category[] = [
  {
    id: 1,
    name: "Food",
    parentId: null,
    ledgerType: "EXPENSE",
    createdAt: "",
  },
  {
    id: 2,
    name: "Groceries",
    parentId: 1,
    ledgerType: "EXPENSE",
    createdAt: "",
  },
];

describe("statisticsRollup", () => {
  it("rolls child category totals to the root", () => {
    const rows = rollupByParent(
      [
        {
          categoryId: 2,
          categoryName: "Groceries",
          currency: "PLN",
          total: 30,
          count: 2,
        },
      ],
      "PLN",
      categories,
    );
    expect(rows).toEqual([
      { key: "cat-1", name: "Food", total: 30, count: 2 },
    ]);
  });

  it("maps tags and appends untagged", () => {
    expect(
      tagRollupRows([{ tagId: 9, tagName: "Work", total: 5, count: 1 }]),
    ).toEqual([{ key: "tag-9", name: "Work", total: 5, count: 1 }]);
    expect(withUntagged([], 4, 1)[0]!.key).toBe("untagged");
  });
});
