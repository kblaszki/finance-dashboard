import { apiClient } from "./client";

export type InstrumentAssetClass = "STOCK" | "ETF" | "INDEX";

export type InstrumentSearchScope = "allowlist" | "catalog";

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
  allowlisted?: boolean;
};

export type SearchInstrumentsParams = {
  q: string;
  assetClass?: InstrumentAssetClass;
  limit?: number;
  /** Default allowlist. Use catalog to browse full Twelve Data table. */
  scope?: InstrumentSearchScope;
};

export async function searchInstruments(
  params: SearchInstrumentsParams,
): Promise<Instrument[]> {
  const qs = new URLSearchParams({ q: params.q });
  if (params.assetClass) qs.set("assetClass", params.assetClass);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.scope) qs.set("scope", params.scope);
  return apiClient.get<Instrument[]>(`/api/instruments?${qs.toString()}`);
}

export async function addInstrumentToAllowlist(
  instrumentId: number,
): Promise<Instrument> {
  return apiClient.post<Instrument>("/api/instruments/allowlist", {
    instrumentId,
  });
}
