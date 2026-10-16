import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CategoryCsvDraft } from "./categoriesCsv";
import {
  applyCategoriesImport,
  previewCategoriesImport,
  type OwnedCategoryRow,
} from "./categoriesImport";

function draft(
  partial: Partial<CategoryCsvDraft> &
    Pick<CategoryCsvDraft, "row" | "path" | "ledgerType" | "segments">,
): CategoryCsvDraft {
  return partial;
}

describe("previewCategoriesImport", () => {
  const owned: OwnedCategoryRow[] = [
    { id: 1, name: "Food", parentId: null, ledgerType: "EXPENSE" },
    { id: 2, name: "Salary", parentId: null, ledgerType: "INCOME" },
  ];

  it("marks existing and to-create rows", () => {
    const result = previewCategoriesImport(
      [
        draft({
          row: 1,
          path: "Food",
          ledgerType: "EXPENSE",
          segments: ["Food"],
        }),
        draft({
          row: 2,
          path: "Food/Groceries",
          ledgerType: "EXPENSE",
          segments: ["Food", "Groceries"],
        }),
      ],
      owned,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.preview.existing, 1);
    assert.equal(result.preview.toCreate, 1);
    assert.equal(result.preview.rows[0]!.status, "exists");
    assert.equal(result.preview.rows[1]!.status, "create");
  });

  it("rejects path with conflicting owned ledgerType", () => {
    const result = previewCategoriesImport(
      [
        draft({
          row: 1,
          path: "Food",
          ledgerType: "INCOME",
          segments: ["Food"],
        }),
      ],
      owned,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /exists with ledgerType/);
  });
});

describe("applyCategoriesImport", () => {
  it("creates nested path and skips existing on re-run", async () => {
    const created: OwnedCategoryRow[] = [
      { id: 1, name: "Food", parentId: null, ledgerType: "EXPENSE" },
    ];
    let nextId = 10;
    const db = {
      category: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = {
            id: nextId++,
            name: String(data.name),
            parentId: (data.parentId as number | null) ?? null,
            ledgerType: String(data.ledgerType),
            userId: data.userId,
            nameKey: data.nameKey,
            createdAt: new Date(),
          };
          created.push({
            id: row.id,
            name: row.name,
            parentId: row.parentId,
            ledgerType: row.ledgerType,
          });
          return row;
        },
      },
    };

    const drafts = [
      draft({
        row: 1,
        path: "Food",
        ledgerType: "EXPENSE",
        segments: ["Food"],
      }),
      draft({
        row: 2,
        path: "Food/Groceries",
        ledgerType: "EXPENSE",
        segments: ["Food", "Groceries"],
      }),
    ];

    const first = await applyCategoriesImport(
      db as never,
      1,
      drafts,
      [{ id: 1, name: "Food", parentId: null, ledgerType: "EXPENSE" }],
    );
    assert.equal(first.created, 1);
    assert.equal(first.skipped, 1);
    assert.ok(created.some((c) => c.name === "Groceries"));

    const second = await applyCategoriesImport(
      db as never,
      1,
      drafts,
      created,
    );
    assert.equal(second.created, 0);
    assert.equal(second.skipped, 2);
  });
});
