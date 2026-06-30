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
  currency: string;
};

export type CashflowHistory = {
  currency: string;
  points: Array<{
    month: string;
    income: number;
    expense: number;
    net: number;
  }>;
};

export type AllocationRow = {
  type: string;
  value: number;
  pct: number;
};

export type PortfolioSummary = {
  asOf: string;
  displayCurrency: string;
  totalValue: number;
  cashValue: number;
  securitiesValue: number;
  unrealizedPnl: number | null;
  realizedPnlClosed: number;
  returnPct: number | null;
  allocation: AllocationRow[];
};

export type PortfolioHistory = {
  points: Array<{
    date: string;
    totalValue: number;
    cashValue: number;
    securitiesValue: number;
  }>;
};

export type BenchmarkComparison = {
  benchmark: "WIG" | "SP500";
  benchmarkLabel: string;
  portfolioReturnPct: number | null;
  benchmarkReturnPct: number | null;
  displayCurrency: string;
};

type RequiredPeriodQuery = {
  from: string;
  to: string;
  currency?: string;
};

type BenchmarkQuery = RequiredPeriodQuery & {
  benchmark?: "WIG" | "SP500";
};

function periodQuery(params: RequiredPeriodQuery): string {
  const q = new URLSearchParams();
  q.set("from", params.from);
  q.set("to", params.to);
  if (params.currency) q.set("currency", params.currency);
  return `?${q.toString()}`;
}

export function fetchNetWorth(currency: string) {
  const q = new URLSearchParams({ currency });
  return apiClient.get<NetWorthStats>(`/api/stats/net-worth?${q}`);
}

export type AverageHoldingReturn = {
  averageReturnPct: number | null;
  displayCurrency: string;
};

export function fetchAverageHoldingReturn(currency: string) {
  const q = new URLSearchParams({ currency });
  return apiClient.get<AverageHoldingReturn>(`/api/stats/average-holding-return?${q}`);
}

export function fetchCashflow(params: RequiredPeriodQuery) {
  return apiClient.get<CashflowStats>(`/api/stats/cashflow${periodQuery(params)}`);
}

export type CashflowRolling12m = {
  currency: string;
  months: number;
  avgIncome: number;
  avgExpense: number;
  avgNet: number;
};

export function fetchCashflowRolling12m(currency: string) {
  const q = new URLSearchParams({ currency });
  return apiClient.get<CashflowRolling12m>(`/api/stats/cashflow-rolling-12m?${q}`);
}

export function fetchCashflowHistory(params: RequiredPeriodQuery) {
  return apiClient.get<CashflowHistory>(`/api/stats/cashflow-history${periodQuery(params)}`);
}

export function fetchExpensesByCategory(params: RequiredPeriodQuery) {
  return apiClient.get<CategoryAmount[]>(
    `/api/stats/expenses-by-category${periodQuery(params)}`,
  );
}

export function fetchIncomeByCategory(params: RequiredPeriodQuery) {
  return apiClient.get<CategoryAmount[]>(`/api/stats/income-by-category${periodQuery(params)}`);
}

export function fetchPortfolioSummary(params: RequiredPeriodQuery) {
  return apiClient.get<PortfolioSummary>(`/api/stats/portfolio-summary${periodQuery(params)}`);
}

export function fetchPortfolioHistory(params: RequiredPeriodQuery) {
  return apiClient.get<PortfolioHistory>(`/api/stats/portfolio-history${periodQuery(params)}`);
}

export function fetchBenchmarkComparison(params: BenchmarkQuery) {
  const q = new URLSearchParams();
  q.set("from", params.from);
  q.set("to", params.to);
  if (params.currency) q.set("currency", params.currency);
  if (params.benchmark) q.set("benchmark", params.benchmark);
  return apiClient.get<BenchmarkComparison>(`/api/stats/benchmark-comparison?${q.toString()}`);
}

export type TaxReportWarning = {
  accountId: number;
  accountName: string;
  symbol: string;
  holdingId: number;
  message: string;
};

export type TaxReport = {
  taxYear: number;
  displayCurrency: string;
  realizedGains: number;
  realizedLosses: number;
  netRealized: number;
  estimatedBelka: number;
  dividendsGross: number;
  byAccount: Array<{ accountId: number; name: string; netRealized: number }>;
  byInstrument: Array<{ symbol: string; netRealized: number }>;
  sellRows: Array<{
    saleDate: string;
    symbol: string;
    accountId: number;
    accountName: string;
    quantity: number;
    proceeds: number;
    cost: number;
    gainLoss: number;
    currency: string;
  }>;
  warnings: TaxReportWarning[];
};

export function fetchTaxReport(year: number, currency = "PLN") {
  const q = new URLSearchParams({ year: String(year), currency });
  return apiClient.get<TaxReport>(`/api/stats/tax-report?${q}`);
}
