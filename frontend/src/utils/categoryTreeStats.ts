import type { Category } from "../api/categoriesApi";
import type { CategoryBreakdownRow } from "../api/statisticsApi";

export type CategoryTreeStatRow = {
  key: string;
  name: string;
  depth: number;
  rolledTotal: number;
  rolledCount: number;
  isRoot: boolean;
  /** True when this node has at least one active child in the tree. */
  hasChildren: boolean;
};

type Amount = { total: number; count: number };

const ZERO: Amount = { total: 0, count: 0 };

function hasActivity(a: Amount): boolean {
  return a.total > 0 || a.count > 0;
}

/**
 * Build a nested category detail list: each node shows own + descendants
 * totals. Empty branches are omitted. Uncategorized is a root-level row.
 */
export function buildCategoryTreeRows(
  rows: CategoryBreakdownRow[],
  categories: Category[],
  currency: string,
): CategoryTreeStatRow[] {
  const own = new Map<number, Amount>();
  let uncategorized: Amount = { ...ZERO };
  const nameFallback = new Map<number, string>();

  for (const row of rows) {
    if (row.currency !== currency) continue;
    if (row.categoryId == null) {
      uncategorized = {
        total: uncategorized.total + row.total,
        count: uncategorized.count + row.count,
      };
      continue;
    }
    nameFallback.set(row.categoryId, row.categoryName);
    const prev = own.get(row.categoryId) ?? ZERO;
    own.set(row.categoryId, {
      total: prev.total + row.total,
      count: prev.count + row.count,
    });
  }

  const byParent = new Map<number | null, Category[]>();
  const knownIds = new Set<number>();
  for (const cat of categories) {
    knownIds.add(cat.id);
    const list = byParent.get(cat.parentId) ?? [];
    list.push(cat);
    byParent.set(cat.parentId, list);
  }

  const rolledCache = new Map<number, Amount>();

  function rollup(id: number): Amount {
    const cached = rolledCache.get(id);
    if (cached) return cached;
    const self = own.get(id) ?? ZERO;
    let total = self.total;
    let count = self.count;
    for (const child of byParent.get(id) ?? []) {
      const childRoll = rollup(child.id);
      total += childRoll.total;
      count += childRoll.count;
    }
    const result = { total, count };
    rolledCache.set(id, result);
    return result;
  }

  const out: CategoryTreeStatRow[] = [];

  function walk(cat: Category, depth: number): void {
    const rolled = rollup(cat.id);
    if (!hasActivity(rolled)) return;
    const children = [...(byParent.get(cat.id) ?? [])]
      .filter((child) => hasActivity(rollup(child.id)))
      .sort((a, b) => rollup(b.id).total - rollup(a.id).total);
    out.push({
      key: `cat-${cat.id}`,
      name: cat.name,
      depth,
      rolledTotal: rolled.total,
      rolledCount: rolled.count,
      isRoot: depth === 0,
      hasChildren: children.length > 0,
    });
    for (const child of children) {
      walk(child, depth + 1);
    }
  }

  const roots = [...(byParent.get(null) ?? [])].sort(
    (a, b) => rollup(b.id).total - rollup(a.id).total,
  );
  for (const root of roots) {
    walk(root, 0);
  }

  for (const [id, amount] of own) {
    if (knownIds.has(id) || !hasActivity(amount)) continue;
    out.push({
      key: `cat-${id}`,
      name: nameFallback.get(id) ?? `Category ${id}`,
      depth: 0,
      rolledTotal: amount.total,
      rolledCount: amount.count,
      isRoot: true,
      hasChildren: false,
    });
  }

  if (hasActivity(uncategorized)) {
    out.push({
      key: "uncategorized",
      name: "Uncategorized",
      depth: 0,
      rolledTotal: uncategorized.total,
      rolledCount: uncategorized.count,
      isRoot: true,
      hasChildren: false,
    });
  }

  return out;
}

/**
 * Keep roots always; show deeper rows only when every ancestor key is in
 * `expandedKeys` (DFS order from {@link buildCategoryTreeRows}).
 */
export function visibleCategoryTreeRows(
  rows: CategoryTreeStatRow[],
  expandedKeys: ReadonlySet<string>,
): CategoryTreeStatRow[] {
  const out: CategoryTreeStatRow[] = [];
  const ancestorExpanded: boolean[] = [];
  for (const row of rows) {
    ancestorExpanded.length = row.depth;
    const isVisible =
      row.depth === 0 ||
      (ancestorExpanded.length === row.depth &&
        ancestorExpanded.every(Boolean));
    if (isVisible) {
      out.push(row);
      ancestorExpanded.push(expandedKeys.has(row.key));
    } else {
      ancestorExpanded.push(false);
    }
  }
  return out;
}
