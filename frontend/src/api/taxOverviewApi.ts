import { apiClient } from "./client";
import type { TaxReport } from "./statsApi";

export type CryptoTaxSection = {
  realizedGains: number;
  realizedLosses: number;
  netRealized: number;
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
  message: string;
};

export type PropertySaleRow = {
  id: number;
  accountId: number;
  accountName: string | null;
  soldOn: string;
  proceeds: number;
  acquisitionCost: number;
  improvementsCost: number;
  fiveYearExemption: boolean;
  taxableGain: number;
  currency: string;
  description: string | null;
};

export type TaxOverview = {
  taxYear: number;
  displayCurrency: string;
  pit38: TaxReport;
  crypto: CryptoTaxSection;
  propertySales: { rows: PropertySaleRow[]; totalTaxableGain: number };
  wrapperWithdrawals: Array<{
    id: number;
    accountId: number;
    accountName: string | null;
    withdrawnOn: string;
    amount: number;
    currency: string;
    withdrawalType: string;
    includeInPit38: boolean;
  }>;
  taxLiabilities: { advancesPaid: number; provisions: number; netAdvances: number };
  estimatedTotalTaxDue: number;
  correction: { needed: boolean; message: string | null; previousSnapshotAt: string | null };
};

export function fetchTaxOverview(year: number, currency = "PLN", snapshot = false) {
  const q = new URLSearchParams({ year: String(year), currency });
  if (snapshot) q.set("snapshot", "1");
  return apiClient.get<TaxOverview>(`/api/stats/tax-overview?${q}`);
}

export type PreSellSimulation = {
  holdingId: number;
  symbol: string;
  accountId: number;
  accountName: string;
  quantity: number;
  proceeds: number;
  cost: number;
  gainLoss: number;
  currency: string;
  taxRegime: "pit38" | "crypto_pit" | "excluded_wrapper";
  pit38TaxableAfterLosses: number | null;
  message: string;
};

export function simulatePreSellTax(input: {
  holdingId: number;
  quantity: number;
  salePricePerUnit?: number;
  saleDate?: string;
  currency?: string;
}) {
  return apiClient.post<PreSellSimulation>("/api/stats/pre-sell-simulator", input);
}
