import { apiClient } from "./client";

export type SummaryStats = {
  income: number;
  expenses: number;
  balance: number;
  portfolioValue: number;
  transactionsCount: number;
  currency?: string;
  fxAsOf?: string;
};

export type CategoryAmount = {
  category: string;
  amount: number;
  currency?: string;
  fxAsOf?: string;
};

export type CashflowPeriod = {
  period: string;
  income: number;
  expenses: number;
  currency?: string;
  fxAsOf?: string;
};

type StatsQuery = {
  currency: string;
  from: string;
  to: string;
};

function statsQuery(params: StatsQuery): string {
  const q = new URLSearchParams({
    currency: params.currency,
    from: params.from,
    to: params.to,
  });
  return q.toString();
}

export function fetchSummaryStats(params: StatsQuery) {
  return apiClient.get<SummaryStats>(`/api/stats/summary?${statsQuery(params)}`);
}

export function fetchExpensesByCategory(params: StatsQuery) {
  return apiClient.get<CategoryAmount[]>(
    `/api/stats/expenses-by-category?${statsQuery(params)}`,
  );
}

export function fetchIncomeByCategory(params: StatsQuery) {
  return apiClient.get<CategoryAmount[]>(
    `/api/stats/income-by-category?${statsQuery(params)}`,
  );
}

export function fetchCashflowOverTime(params: StatsQuery) {
  return apiClient.get<CashflowPeriod[]>(
    `/api/stats/cashflow-over-time?${statsQuery(params)}`,
  );
}
