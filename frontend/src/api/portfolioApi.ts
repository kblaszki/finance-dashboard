import { apiClient } from "./client";

export interface PortfolioPosition {
  id: number | string;
  symbol: string;
  quantity: number;
  buyPrice: number;
  buyDate?: string | null;
  currency: string;
  category: string;
  lotsCount?: number;
  marketDataStatus?: "fresh" | "stale" | "expired" | "missing";
  lastClose?: number | null;
  lastCloseDate?: string | null;
  marketDataCurrency?: string;
  marketDataSource?: string;
  marketDataFetchedAt?: string | null;
  buyPriceConverted?: number;
  currentPriceConverted?: number | null;
  positionCostConverted?: number | null;
  positionValueConverted?: number | null;
  profitAbs?: number | null;
  profitPct?: number | null;
  convertedCurrency?: string;
  fxAsOf?: string;
}

export interface PortfolioPositionInput {
  portfolioId: number;
  side: "BUY" | "SELL";
  symbol: string;
  quantity: number;
  tradePrice: number;
  tradeDate: string;
  currency: string;
  category?: string;
}

export interface PortfolioTrade {
  id: number;
  portfolioId: number;
  side: "BUY" | "SELL";
  symbol: string;
  quantity: number;
  tradePrice: number;
  tradeDate: string;
  currency: string;
  category: string;
  createdAt: string;
}

export async function fetchPortfolio(opts: { currency?: string; portfolioId: number }): Promise<PortfolioPosition[]> {
  const q = new URLSearchParams();
  q.set("portfolioId", String(opts.portfolioId));
  if (opts.currency) q.set("currency", opts.currency);
  return apiClient.get<PortfolioPosition[]>(`/api/portfolio?${q.toString()}`);
}

export type MarketRefreshResponse = {
  source: string;
  requested: number;
  symbolsProcessed: number;
  rowsInserted: number;
  rowsUpdated: number;
  errors: Array<{ symbol: string; error: string }>;
};

export async function refreshPortfolioMarketData(
  symbols?: string[],
): Promise<MarketRefreshResponse> {
  return apiClient.post<MarketRefreshResponse>("/api/market-data/refresh", {
    symbols,
  });
}

export async function createPortfolioPosition(
  input: PortfolioPositionInput,
): Promise<PortfolioPosition> {
  return apiClient.post<PortfolioPosition>("/api/portfolio", input);
}

export async function updatePortfolioPosition(
  id: number,
  input: Partial<PortfolioPositionInput>,
): Promise<PortfolioPosition> {
  return apiClient.put<PortfolioPosition>(`/api/portfolio/${id}`, input);
}

export async function deletePortfolioPosition(id: number): Promise<void> {
  return apiClient.delete(`/api/portfolio/${id}`);
}

export async function fetchPortfolioTrades(opts: { symbol?: string; portfolioId: number }): Promise<PortfolioTrade[]> {
  const q = new URLSearchParams({ portfolioId: String(opts.portfolioId) });
  if (opts.symbol) q.set("symbol", opts.symbol);
  return apiClient.get<PortfolioTrade[]>(`/api/portfolio/trades?${q.toString()}`);
}

export async function updatePortfolioTrade(
  id: number,
  input: Partial<PortfolioPositionInput>,
): Promise<PortfolioTrade> {
  return apiClient.put<PortfolioTrade>(`/api/portfolio/${id}`, input);
}

export type PortfolioHistoryPoint = {
  date: string;
  close: number;
  closeCurrency: string;
  quantity: number;
  positionValue: number;
  costBasis: number;
  profitAbs: number;
  profitPct: number;
  currency: string;
};

export async function fetchPortfolioSymbolHistory(opts: {
  symbol: string;
  method: "weighted" | "fifo";
  currency: string;
  portfolioId: number;
}): Promise<PortfolioHistoryPoint[]> {
  const q = new URLSearchParams({
    method: opts.method,
    currency: opts.currency,
    portfolioId: String(opts.portfolioId),
  });
  return apiClient.get<PortfolioHistoryPoint[]>(`/api/portfolio/${encodeURIComponent(opts.symbol)}/history?${q.toString()}`);
}
