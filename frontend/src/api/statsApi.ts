import { apiClient } from "./client";

export type NetWorthStats = {
  total: number;
  currency: string;
  byAccountType: Record<string, number>;
  accounts: Array<{
    id: number;
    name: string;
    accountType: string;
    value: number;
  }>;
};

export type CategoryAmount = {
  category: string;
  amount: number;
};

export type CashflowStats = {
  income: number;
  expense: number;
  net: number;
};

type PeriodQuery = {
  from?: string;
  to?: string;
};

function periodQuery(params?: PeriodQuery): string {
  if (!params) return "";
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function fetchNetWorth(currency: string) {
  const q = new URLSearchParams({ currency });
  return apiClient.get<NetWorthStats>(`/api/stats/net-worth?${q}`);
}

export function fetchCashflow(params?: PeriodQuery) {
  return apiClient.get<CashflowStats>(`/api/stats/cashflow${periodQuery(params)}`);
}

export function fetchExpensesByCategory(params?: PeriodQuery) {
  return apiClient.get<CategoryAmount[]>(
    `/api/stats/expenses-by-category${periodQuery(params)}`,
  );
}

export function fetchIncomeByCategory(params?: PeriodQuery) {
  return apiClient.get<CategoryAmount[]>(`/api/stats/income-by-category${periodQuery(params)}`);
}
