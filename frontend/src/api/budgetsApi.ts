import { apiClient } from "./client";

export type Budget = {
  id: number;
  categoryId: number;
  categoryName: string | null;
  budgetMonth: string;
  amount: number;
  currency: string;
  spent: number | null;
  pctUsed: number | null;
  createdAt: string;
  updatedAt: string;
};

export type BudgetInput = {
  categoryId: number;
  budgetMonth: string;
  amount: number;
  currency: string;
};

export function fetchBudgets(month?: string, currency?: string): Promise<Budget[]> {
  const q = new URLSearchParams();
  if (month) q.set("month", month);
  if (currency) q.set("currency", currency);
  const s = q.toString();
  return apiClient.get<Budget[]>(`/api/budgets${s ? `?${s}` : ""}`);
}

export function upsertBudget(input: BudgetInput): Promise<Budget> {
  return apiClient.put<Budget>("/api/budgets", input);
}

export function deleteBudget(id: number): Promise<void> {
  return apiClient.delete(`/api/budgets/${id}`);
}

export type BudgetAlert = {
  categoryId: number;
  categoryName: string;
  budgetMonth: string;
  budgetAmount: number;
  spent: number;
  currency: string;
  pctUsed: number;
  threshold: number;
  severity: "warning" | "exceeded";
};

export function fetchBudgetAlerts(month?: string, currency?: string): Promise<BudgetAlert[]> {
  const q = new URLSearchParams();
  if (month) q.set("month", month);
  if (currency) q.set("currency", currency);
  const s = q.toString();
  return apiClient.get<BudgetAlert[]>(`/api/budgets/alerts${s ? `?${s}` : ""}`);
}
