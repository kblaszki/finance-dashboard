import { apiClient } from "./client";

export type AccountHolding = {
  id: number;
  accountId: number;
  instrumentId: number;
  symbol: string | null;
  name: string | null;
  quantity: number;
  lastClose: number | null;
  lastCloseAsOf: string | null;
  marketValue: number | null;
  costBasis: number;
  averageCost: number | null;
  unrealizedPnl: number | null;
  currency: string;
};

export type AccountHoldingsResponse = {
  accountId: number;
  currency: string;
  holdingsValue: number;
  holdings: AccountHolding[];
};

export async function fetchAccountHoldings(
  accountId: number,
): Promise<AccountHoldingsResponse> {
  return apiClient.get<AccountHoldingsResponse>(
    `/api/accounts/${accountId}/holdings`,
  );
}
