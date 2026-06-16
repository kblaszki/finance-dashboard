import { apiClient } from "./client";

export type HoldingValuationPoint = {
  valuationDate: string;
  quantity: number;
  marketValue: number;
  currency: string;
};

export async function fetchHoldingValuations(
  accountId: number,
  instrumentId: number,
  from?: string,
  to?: string,
): Promise<HoldingValuationPoint[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const q = params.toString() ? `?${params}` : "";
  return apiClient.get<HoldingValuationPoint[]>(
    `/api/accounts/${accountId}/holdings/${instrumentId}/valuations${q}`,
  );
}
