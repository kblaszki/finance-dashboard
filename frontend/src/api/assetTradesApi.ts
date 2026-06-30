import { apiClient } from "./client";
import type { HoldingInstrument } from "./holdingsApi";
import type { HoldingLot, HoldingLotInput } from "./holdingLotsApi";

export type AssetTrade = HoldingLot & {
  accountName?: string;
};

export type AssetTradeInput = HoldingLotInput & {
  accountId: number;
  instrumentId: number;
};

export type AssetTradeQuery = {
  from?: string;
  to?: string;
  accountId?: number;
  instrumentId?: number;
};

function buildQuery(opts?: AssetTradeQuery): string {
  if (!opts) return "";
  const q = new URLSearchParams();
  if (opts.from) q.set("from", opts.from);
  if (opts.to) q.set("to", opts.to);
  if (opts.accountId != null) q.set("accountId", String(opts.accountId));
  if (opts.instrumentId != null) q.set("instrumentId", String(opts.instrumentId));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function fetchAssetTrades(opts?: AssetTradeQuery): Promise<AssetTrade[]> {
  return apiClient.get<AssetTrade[]>(`/api/asset-trades${buildQuery(opts)}`);
}

export function createAssetTrade(input: AssetTradeInput): Promise<AssetTrade> {
  return apiClient.post<AssetTrade>("/api/asset-trades", input);
}

export type { HoldingInstrument };
