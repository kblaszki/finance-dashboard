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

export type PeriodSummary = {
  month: string;
  currency: string;
  income: number;
  expense: number;
  net: number;
};

export type CashflowHistoryPoint = {
  month: string;
  income: number;
  expense: number;
  net: number;
};

export type CashflowHistory = {
  currency: string;
  monthCount: number;
  series: CashflowHistoryPoint[];
};

export async function fetchCategoryBreakdown(
  month: string,
): Promise<CategoryBreakdown> {
  const params = new URLSearchParams({ month });
  return apiClient.get<CategoryBreakdown>(
    `/api/statistics/category-breakdown?${params.toString()}`,
  );
}

export async function fetchPeriodSummary(
  month: string,
  currency: string,
): Promise<PeriodSummary> {
  const params = new URLSearchParams({ month, currency });
  return apiClient.get<PeriodSummary>(
    `/api/statistics/period-summary?${params.toString()}`,
  );
}

export async function fetchCashflowHistory(
  month: string,
  currency: string,
  months: number,
): Promise<CashflowHistory> {
  const params = new URLSearchParams({
    month,
    currency,
    months: String(months),
  });
  return apiClient.get<CashflowHistory>(
    `/api/statistics/cashflow-history?${params.toString()}`,
  );
}
