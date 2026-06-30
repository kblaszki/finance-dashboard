import { apiClient } from "./client";

export type Category = {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
  createdAt: string;
};

export type CategoryTreeNode = Category & { children: CategoryTreeNode[] };

export type CategoriesResponse = {
  flat: Category[];
  tree: CategoryTreeNode[];
};

export type CategoryInput = {
  name: string;
  parentId?: number | null;
  sortOrder?: number;
};

export function fetchCategories(): Promise<CategoriesResponse> {
  return apiClient.get<CategoriesResponse>("/api/categories");
}

export function createCategory(input: CategoryInput): Promise<Category> {
  return apiClient.post<Category>("/api/categories", input);
}

export function updateCategory(id: number, input: Partial<CategoryInput>): Promise<Category> {
  return apiClient.put<Category>(`/api/categories/${id}`, input);
}

export function deleteCategory(id: number): Promise<void> {
  return apiClient.delete(`/api/categories/${id}`);
}
