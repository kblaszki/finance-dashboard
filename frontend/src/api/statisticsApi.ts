import { apiClient } from "./client";

export type CategoryBreakdownRow = {
  categoryId: number | null;
  categoryName: string;
  currency: string;
  total: number;
  count: number;
};

export type CategoryBreakdown = {
  month: string;
  income: CategoryBreakdownRow[];
  expense: CategoryBreakdownRow[];
};

export async function fetchCategoryBreakdown(
  month: string,
): Promise<CategoryBreakdown> {
  const params = new URLSearchParams({ month });
  return apiClient.get<CategoryBreakdown>(
    `/api/statistics/category-breakdown?${params.toString()}`,
  );
}
