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
