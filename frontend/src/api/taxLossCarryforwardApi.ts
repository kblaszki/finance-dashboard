import { apiClient } from "./client";

export type TaxLossCarryforward = {
  id: number;
  taxYear: number;
  lossAmount: number;
  usedAmount: number;
  remainingAmount: number;
  note: string | null;
};

export function fetchTaxLossCarryforwards() {
  return apiClient.get<TaxLossCarryforward[]>("/api/tax-loss-carryforward");
}

export function upsertTaxLossCarryforward(input: {
  taxYear: number;
  lossAmount: number;
  usedAmount?: number;
  note?: string | null;
}) {
  return apiClient.put<TaxLossCarryforward>("/api/tax-loss-carryforward", input);
}

export function deleteTaxLossCarryforward(id: number) {
  return apiClient.delete(`/api/tax-loss-carryforward/${id}`);
}
