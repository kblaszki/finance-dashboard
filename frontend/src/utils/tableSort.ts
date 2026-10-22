export type SortDir = "asc" | "desc";

export type SortState<K extends string = string> = {
  key: K;
  dir: SortDir;
};

export function toggleSort<K extends string>(
  current: SortState<K> | null,
  key: K,
): SortState<K> {
  if (current?.key === key) {
    return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  return { key, dir: "asc" };
}

export function ariaSortValue<K extends string>(
  current: SortState<K> | null,
  key: K,
): "ascending" | "descending" | "none" {
  if (current?.key !== key) return "none";
  return current.dir === "asc" ? "ascending" : "descending";
}

export function compareStrings(a: string, b: string, dir: SortDir): number {
  const cmp = a.localeCompare(b, undefined, { sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

export function compareNumbers(a: number, b: number, dir: SortDir): number {
  const cmp = a - b;
  return dir === "asc" ? cmp : -cmp;
}

export function sortBy<T, K extends string>(
  rows: T[],
  sort: SortState<K> | null,
  getters: Record<K, (row: T) => string | number | null | undefined>,
): T[] {
  if (!sort) return rows;
  const get = getters[sort.key];
  if (!get) return rows;
  return rows.slice().sort((left, right) => {
    const a = get(left);
    const b = get(right);
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === "number" && typeof b === "number") {
      return compareNumbers(a, b, sort.dir);
    }
    return compareStrings(String(a), String(b), sort.dir);
  });
}
