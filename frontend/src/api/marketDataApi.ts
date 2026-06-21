import { apiClient } from "./client";

export type MarketDataStatus = {
  lastSyncAt: string | null;
  instrumentCount: number;
  staleCount: number;
};

export type MarketDataSyncResult = {
  synced: number;
  skipped: number;
  valuationsUpserted: number;
  accountsRecomputed: number;
  errors: Array<{ instrumentId: number; symbol: string; message: string }>;
};

export async function fetchMarketDataStatus(): Promise<MarketDataStatus> {
  return apiClient.get<MarketDataStatus>("/api/market-data/status");
}

export async function triggerMarketSync(backfillDays?: number): Promise<MarketDataSyncResult> {
  return apiClient.post<MarketDataSyncResult>("/api/market-data/sync", {
    ...(backfillDays != null ? { backfillDays } : {}),
  });
}
