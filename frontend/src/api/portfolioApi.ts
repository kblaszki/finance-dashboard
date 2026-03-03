import { apiClient } from "./client";

export interface PortfolioPosition {
  id: number;
  symbol: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  currency: string;
  category: string;
  buyPriceConverted?: number;
  currentPriceConverted?: number;
  positionValueConverted?: number;
  convertedCurrency?: string;
  fxAsOf?: string;
}

export interface PortfolioPositionInput {
  symbol: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  currency: string;
  category?: string;
}

export async function fetchPortfolio(opts?: { currency?: string }): Promise<PortfolioPosition[]> {
  const q = opts?.currency ? `?currency=${encodeURIComponent(opts.currency)}` : "";
  return apiClient.get<PortfolioPosition[]>(`/api/portfolio${q}`);
}

