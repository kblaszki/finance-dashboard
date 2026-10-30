import { apiClient } from "./client";
import type { Instrument } from "./instrumentsApi";

export type WatchlistItem = {
  instrumentId: number;
  createdAt: string;
  instrument: Instrument;
  lastClose: number | null;
  asOf: string | null;
};

export async function fetchWatchlist(): Promise<WatchlistItem[]> {
  return apiClient.get<WatchlistItem[]>("/api/watchlist");
}

export async function addToWatchlist(
  instrumentId: number,
): Promise<WatchlistItem> {
  return apiClient.post<WatchlistItem>("/api/watchlist", { instrumentId });
}

export async function removeFromWatchlist(
  instrumentId: number,
): Promise<void> {
  await apiClient.delete(`/api/watchlist/${instrumentId}`);
}
