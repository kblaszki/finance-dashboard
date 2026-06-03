import { apiClient } from "./client";

export type CategoryKind = "INCOME" | "EXPENSE";

export type CategoryNode = {
  id: number;
  parentId: number | null;
  name: string;
  kind: CategoryKind;
  path: string;
};

export type CategoryInput = {
  name: string;
  kind: CategoryKind;
  parentId?: number | null;
};

export async function fetchCategories(kind?: CategoryKind): Promise<CategoryNode[]> {
  const q = kind ? `?kind=${kind}` : "";
  return apiClient.get<CategoryNode[]>(`/api/categories${q}`);
}

export async function createCategory(input: CategoryInput): Promise<CategoryNode> {
  return apiClient.post<CategoryNode>("/api/categories", input);
}

export async function updateCategory(
  id: number,
  input: Partial<Pick<CategoryInput, "name" | "parentId">>,
): Promise<CategoryNode> {
  return apiClient.put<CategoryNode>(`/api/categories/${id}`, input);
}

export async function deleteCategory(id: number): Promise<void> {
  return apiClient.delete(`/api/categories/${id}`);
}
