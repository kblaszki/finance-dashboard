import { apiClient } from "./client";

export type StatsPeriod = "month" | "quarter" | "year";

export type CategoryBreakdownRow = {
  categoryId: number | null;
  categoryName: string;
  currency: string;
  total: number;
  count: number;
};

export type CategoryBreakdown = {
  month: string;
  period: StatsPeriod;
  label: string;
  income: CategoryBreakdownRow[];
  expense: CategoryBreakdownRow[];
  transfer: CategoryBreakdownRow[];
};

export type PeriodSummary = {
  month: string;
  period: StatsPeriod;
  label: string;
  currency: string;
  income: number;
  expense: number;
  net: number;
  transfers: number;
};

export type TagBreakdownRow = {
  tagId: number;
  tagName: string;
  total: number;
  count: number;
};

export type TagBreakdown = {
  month: string;
  period: StatsPeriod;
  label: string;
  currency: string;
  income: TagBreakdownRow[];
  expense: TagBreakdownRow[];
  untagged: {
    income: number;
    expense: number;
    incomeCount: number;
    expenseCount: number;
  };
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

function withPeriod(params: URLSearchParams, period: StatsPeriod): void {
  if (period !== "month") {
    params.set("period", period);
  }
}

export async function fetchCategoryBreakdown(
  month: string,
  period: StatsPeriod = "month",
): Promise<CategoryBreakdown> {
  const params = new URLSearchParams({ month });
  withPeriod(params, period);
  return apiClient.get<CategoryBreakdown>(
    `/api/statistics/category-breakdown?${params.toString()}`,
  );
}

export async function fetchPeriodSummary(
  month: string,
  currency: string,
  period: StatsPeriod = "month",
): Promise<PeriodSummary> {
  const params = new URLSearchParams({ month, currency });
  withPeriod(params, period);
  return apiClient.get<PeriodSummary>(
    `/api/statistics/period-summary?${params.toString()}`,
  );
}

export async function fetchTagBreakdown(
  month: string,
  currency: string,
  period: StatsPeriod = "month",
): Promise<TagBreakdown> {
  const params = new URLSearchParams({ month, currency });
  withPeriod(params, period);
  return apiClient.get<TagBreakdown>(
    `/api/statistics/tag-breakdown?${params.toString()}`,
  );
}

export async function fetchCashflowHistory(
  month: string,
  currency: string,
  months: number,
  period: StatsPeriod = "month",
): Promise<CashflowHistory> {
  const params = new URLSearchParams({
    month,
    currency,
    months: String(months),
  });
  withPeriod(params, period);
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
