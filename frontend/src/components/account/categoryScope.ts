import type { Category } from "../../api/categoriesApi";
import type { CashTxType } from "../../api/transactionsApi";

export function rootNameForTxType(type: CashTxType): "Income" | "Expense" {
  return type === "INCOME" ? "Income" : "Expense";
}

/** Root named Income/Expense plus all descendants (by parentId). */
export function categoryIdsUnderRoot(
  categories: Category[],
  rootName: "Income" | "Expense",
): Set<number> {
  const root = categories.find(
    (cat) => cat.parentId == null && cat.name === rootName,
  );
  if (!root) return new Set();

  const byParent = new Map<number, Category[]>();
  for (const cat of categories) {
    if (cat.parentId == null) continue;
    const list = byParent.get(cat.parentId) ?? [];
    list.push(cat);
    byParent.set(cat.parentId, list);
  }

  const ids = new Set<number>();
  function walk(id: number) {
    ids.add(id);
    for (const child of byParent.get(id) ?? []) {
      walk(child.id);
    }
  }
  walk(root.id);
  return ids;
}
