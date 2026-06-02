import { apiClient } from "./client";

export type InvestmentPortfolio = {
  id: number;
  userId: number;
  name: string;
  baseCurrency: string;
  cashBalance: number;
  createdAt: string;
  updatedAt: string;
};

export type InvestmentPortfolioInput = {
  name: string;
  baseCurrency: string;
};

export async function fetchPortfolios(): Promise<InvestmentPortfolio[]> {
  return apiClient.get<InvestmentPortfolio[]>("/api/portfolios");
}

export async function createPortfolio(input: InvestmentPortfolioInput): Promise<InvestmentPortfolio> {
  return apiClient.post<InvestmentPortfolio>("/api/portfolios", input);
}

