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

export type NetWorthByBucket = {
  cash: number;
  stock: number;
  crypto: number;
  metal: number;
  real_estate: number;
  other: number;
};

export type NetWorth = {
  currency: string;
  byBucket: NetWorthByBucket;
  liabilities: number;
  netWorth: number;
};

export type CashflowRolling12m = {
  currency: string;
  monthCount: number;
  fromMonth: string;
  toMonth: string;
  avgIncome: number;
  avgExpense: number;
  avgNet: number;
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

export async function fetchNetWorth(currency: string): Promise<NetWorth> {
  const params = new URLSearchParams({ currency });
  return apiClient.get<NetWorth>(
    `/api/statistics/net-worth?${params.toString()}`,
  );
}

export async function fetchCashflowRolling12m(
  currency: string,
): Promise<CashflowRolling12m> {
  const params = new URLSearchParams({ currency });
  return apiClient.get<CashflowRolling12m>(
    `/api/statistics/cashflow-rolling-12m?${params.toString()}`,
  );
}
