import { apiClient } from "./client";

export type AssetTradeSide = "BUY" | "SELL";

export type AssetTrade = {
  id: number;
  accountId: number;
  instrumentId: number;
  side: AssetTradeSide;
  quantity: number;
  unitPrice: number;
  commission: number;
  currency: string;
  occurredAt: string;
  settlementDate: string | null;
  notes: string | null;
  createdAt: string;
  instrumentSymbol: string | null;
  instrumentName: string | null;
};

export type AssetTradePage = {
  items: AssetTrade[];
  nextCursor: string | null;
};

export type CreateAssetTradeInput = {
  instrumentId: number;
  side: AssetTradeSide;
  quantity: number;
  unitPrice: number;
  commission?: number;
  occurredAt?: string;
  settlementDate?: string | null;
  notes?: string | null;
};

export async function fetchAssetTrades(
  accountId: number,
  options: { month?: string; limit?: number; cursor?: string } = {},
): Promise<AssetTradePage> {
  const params = new URLSearchParams();
  if (options.month) params.set("month", options.month);
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.cursor) params.set("cursor", options.cursor);
  const query = params.toString();
  return apiClient.get<AssetTradePage>(
    `/api/accounts/${accountId}/asset-trades${query ? `?${query}` : ""}`,
  );
}

export async function createAssetTrade(
  accountId: number,
  input: CreateAssetTradeInput,
): Promise<AssetTrade> {
  return apiClient.post<AssetTrade>(
    `/api/accounts/${accountId}/asset-trades`,
    input,
  );
}

export async function deleteAssetTrade(
  accountId: number,
  tradeId: number,
): Promise<void> {
  await apiClient.delete(`/api/accounts/${accountId}/asset-trades/${tradeId}`);
}
