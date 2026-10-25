import type { Category } from "../api/categoriesApi";
import type {
  CategoryBreakdownRow,
  TagBreakdownRow,
} from "../api/statisticsApi";

export type RollupRow = {
  key: string;
  name: string;
  total: number;
  count: number;
};

function parentIdMap(categories: Category[]): Map<number, number | null> {
  const map = new Map<number, number | null>();
  for (const cat of categories) {
    map.set(cat.id, cat.parentId);
  }
  return map;
}

function nameById(categories: Category[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const cat of categories) {
    map.set(cat.id, cat.name);
  }
  return map;
}

/**
 * Roll totals to each category tree root (Salary, Food, …). Deeper tags roll up to the root.
 */
export function rollupByParent(
  rows: CategoryBreakdownRow[],
  currency: string,
  categories: Category[],
): RollupRow[] {
  const parents = parentIdMap(categories);
  const names = nameById(categories);
  const buckets = new Map<string, RollupRow>();

  for (const row of rows) {
    if (row.currency !== currency) continue;
    let label = "Uncategorized";
    let key = "uncategorized";
    if (row.categoryId != null) {
      let id: number | null = row.categoryId;
      let rootId = id;
      while (id != null) {
        rootId = id;
        id = parents.get(id) ?? null;
      }
      label = names.get(rootId) ?? row.categoryName;
      key = `cat-${rootId}`;
    }
    const existing = buckets.get(key);
    if (existing) {
      existing.total += row.total;
      existing.count += row.count;
    } else {
      buckets.set(key, { key, name: label, total: row.total, count: row.count });
    }
  }

  return [...buckets.values()].sort((a, b) => b.total - a.total);
}

export function tagRollupRows(rows: TagBreakdownRow[]): RollupRow[] {
  return rows.map((row) => ({
    key: `tag-${row.tagId}`,
    name: row.tagName,
    total: row.total,
    count: row.count,
  }));
}

export function withUntagged(
  rows: RollupRow[],
  untaggedTotal: number,
  untaggedCount: number,
): RollupRow[] {
  if (untaggedTotal <= 0 && untaggedCount <= 0) return rows;
  return [
    ...rows,
    {
      key: "untagged",
      name: "Untagged",
      total: untaggedTotal,
      count: untaggedCount,
    },
  ].sort((a, b) => b.total - a.total);
}
