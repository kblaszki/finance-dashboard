import { apiClient } from "./client";

export type BondHolding = {
  id: number;
  accountId: number;
  series: string;
  nominal: number;
  purchaseDate: string;
  currency: string;
  notes: string | null;
};

export type BondHoldingInput = {
  series: string;
  nominal: number;
  purchaseDate: string;
  currency: string;
  notes?: string | null;
};

export async function fetchBondHoldings(accountId: number): Promise<BondHolding[]> {
  return apiClient.get<BondHolding[]>(`/api/accounts/${accountId}/bonds`);
}

export async function createBondHolding(
  accountId: number,
  input: BondHoldingInput,
): Promise<BondHolding> {
  return apiClient.post<BondHolding>(`/api/accounts/${accountId}/bonds`, input);
}

export async function deleteBondHolding(id: number): Promise<void> {
  return apiClient.delete(`/api/bonds/${id}`);
}
