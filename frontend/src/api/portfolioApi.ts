import { apiClient } from "./client";
import type { HoldingSummary } from "./holdingsApi";

export type AssetBucket =
  | "stock_market"
  | "crypto"
  | "precious_metal_other"
  | "real_estate";

export type PortfolioPosition = HoldingSummary & {
  accountName: string;
  accountType: string;
  accountCurrency: string;
  assetBucket: AssetBucket;
};

export type PortfolioPositionsResponse = {
  positions: PortfolioPosition[];
};

export type PortfolioQuery = {
  accountId?: number;
  instrumentType?: string;
  assetBucket?: AssetBucket;
};

export async function fetchPortfolioPositions(
  query: PortfolioQuery = {},
): Promise<PortfolioPositionsResponse> {
  const params = new URLSearchParams();
  if (query.accountId != null) params.set("accountId", String(query.accountId));
  if (query.instrumentType) params.set("instrumentType", query.instrumentType);
  if (query.assetBucket) params.set("assetBucket", query.assetBucket);
  const qs = params.toString();
  return apiClient.get<PortfolioPositionsResponse>(
    `/api/portfolio/positions${qs ? `?${qs}` : ""}`,
  );
}
