import { apiClient } from "./client";

export type InstrumentAssetClass = "STOCK" | "ETF";

export type Instrument = {
  id: number;
  symbol: string;
  name: string;
  exchange: string;
  micCode: string | null;
  country: string | null;
  currency: string;
  assetClass: InstrumentAssetClass | string;
  provider: string;
  providerSymbol: string;
};

export type SearchInstrumentsParams = {
  q: string;
  assetClass?: InstrumentAssetClass;
  limit?: number;
};

export async function searchInstruments(
  params: SearchInstrumentsParams,
): Promise<Instrument[]> {
  const qs = new URLSearchParams({ q: params.q });
  if (params.assetClass) qs.set("assetClass", params.assetClass);
  if (params.limit != null) qs.set("limit", String(params.limit));
  return apiClient.get<Instrument[]>(`/api/instruments?${qs.toString()}`);
}
