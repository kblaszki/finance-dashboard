import { apiClient } from "./client";

export type CategoryLedgerType = "INCOME" | "EXPENSE";

export type Category = {
  id: number;
  name: string;
  parentId: number | null;
  ledgerType: CategoryLedgerType;
  createdAt: string;
};

export type CreateCategoryInput = {
  name: string;
  parentId?: number | null;
  /** Required when creating a root (parentId null/omitted). */
  ledgerType?: CategoryLedgerType;
};

export type UpdateCategoryInput = {
  name?: string;
  parentId?: number | null;
};

export async function fetchCategories(): Promise<Category[]> {
  return apiClient.get<Category[]>("/api/categories");
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  return apiClient.post<Category>("/api/categories", input);
}

export async function updateCategory(
  id: number,
  input: UpdateCategoryInput,
): Promise<Category> {
  return apiClient.patch<Category>(`/api/categories/${id}`, input);
}

export async function deleteCategory(id: number): Promise<void> {
  await apiClient.delete(`/api/categories/${id}`);
}

/** Flat list → depth-first rows ordered for indented UI. */
export function flattenCategoryTree(categories: Category[]): Array<Category & { depth: number }> {
  const byParent = new Map<number | null, Category[]>();
  for (const cat of categories) {
    const key = cat.parentId;
    const list = byParent.get(key) ?? [];
    list.push(cat);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const rows: Array<Category & { depth: number }> = [];
  function walk(parentId: number | null, depth: number) {
    const children = byParent.get(parentId) ?? [];
    for (const child of children) {
      rows.push({ ...child, depth });
      walk(child.id, depth + 1);
    }
  }
  walk(null, 0);
  return rows;
}
