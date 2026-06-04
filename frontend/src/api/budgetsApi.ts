import { apiClient } from "./client";

export type Budget = {
  id: number;
  userId: number;
  yearMonth: string;
  category: string | null;
  categoryId: number | null;
  limitAmount: number;
  currency: string;
};

export type BudgetInput = {
  yearMonth: string;
  category?: string | null;
  categoryId?: number | null;
  limitAmount: number;
  currency: string;
};

export type BudgetProgress = {
  id: number;
  yearMonth: string;
  category: string | null;
  categoryId: number | null;
  limitAmount: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  currency: string;
  fxAsOf: string;
};

export function fetchBudgets(params?: { yearMonth?: string }) {
  const query = params?.yearMonth ? `?yearMonth=${encodeURIComponent(params.yearMonth)}` : "";
  return apiClient.get<Budget[]>(`/api/budgets${query}`);
}

export function createBudget(input: BudgetInput) {
  return apiClient.post<Budget>("/api/budgets", input);
}

export function updateBudget(id: number, input: Partial<BudgetInput>) {
  return apiClient.put<Budget>(`/api/budgets/${id}`, input);
}

export function deleteBudget(id: number) {
  return apiClient.delete(`/api/budgets/${id}`);
}

export function fetchBudgetProgress(params: { currency: string; yearMonth?: string }) {
  const search = new URLSearchParams({ currency: params.currency });
  if (params.yearMonth) search.set("yearMonth", params.yearMonth);
  return apiClient.get<BudgetProgress[]>(`/api/stats/budget-progress?${search}`);
}
