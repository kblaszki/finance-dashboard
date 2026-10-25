import { apiClient } from "./client";
import type { CashTxType } from "./transactionsApi";

export type CategoryDescriptionRule = {
  id: number;
  pattern: string;
  ledgerType: CashTxType;
  categoryId: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateCategoryDescriptionRuleInput = {
  pattern: string;
  ledgerType: CashTxType;
  categoryId: number;
};

export type UpdateCategoryDescriptionRuleInput = {
  pattern?: string;
  ledgerType?: CashTxType;
  categoryId?: number;
};

export async function fetchCategoryDescriptionRules(): Promise<
  CategoryDescriptionRule[]
> {
  return apiClient.get<CategoryDescriptionRule[]>(
    "/api/category-description-rules",
  );
}

export async function createCategoryDescriptionRule(
  input: CreateCategoryDescriptionRuleInput,
): Promise<CategoryDescriptionRule> {
  return apiClient.post<CategoryDescriptionRule>(
    "/api/category-description-rules",
    input,
  );
}

export async function updateCategoryDescriptionRule(
  id: number,
  input: UpdateCategoryDescriptionRuleInput,
): Promise<CategoryDescriptionRule> {
  return apiClient.patch<CategoryDescriptionRule>(
    `/api/category-description-rules/${id}`,
    input,
  );
}

export async function deleteCategoryDescriptionRule(id: number): Promise<void> {
  await apiClient.delete(`/api/category-description-rules/${id}`);
}
