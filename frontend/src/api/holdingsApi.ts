import { apiClient } from "./client";
import type { Instrument } from "./instrumentsApi";

export type HoldingInstrument = Pick<
  Instrument,
  "id" | "symbol" | "name" | "instrumentType" | "exchange" | "currency"
>;

export type HoldingSummary = {
  id: number;
  accountId: number;
  instrumentId: number;
  quantity: number;
  instrument: HoldingInstrument;
  marketValue: number | null;
  realizedPnl: number | null;
  lastTradeDate: string | null;
};

export type AccountHoldings = {
  open: HoldingSummary[];
  closed: HoldingSummary[];
};

export async function fetchAccountHoldings(accountId: number): Promise<AccountHoldings> {
  return apiClient.get<AccountHoldings>(`/api/accounts/${accountId}/holdings`);
}

export async function fetchHolding(holdingId: number): Promise<HoldingSummary> {
  return apiClient.get<HoldingSummary>(`/api/holdings/${holdingId}`);
}

export async function createHolding(
  accountId: number,
  instrumentId: number,
): Promise<HoldingSummary> {
  return apiClient.post<HoldingSummary>(`/api/accounts/${accountId}/holdings`, { instrumentId });
}

export async function applyStockSplit(
  holdingId: number,
  input: { ratio: number; effectiveDate: string },
): Promise<HoldingSummary> {
  return apiClient.post<HoldingSummary>(`/api/holdings/${holdingId}/split`, input);
}
