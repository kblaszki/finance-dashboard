import { apiClient } from "./client";
import type { HoldingInstrument } from "./holdingsApi";

export type HoldingLot = {
  id: number;
  holdingId: number;
  accountId?: number;
  instrumentId?: number;
  side: "BUY" | "SELL";
  quantity: number;
  quantityAfter: number;
  totalPrice: number | null;
  pricePerUnit: number | null;
  currency: string;
  tradeDate: string;
  createdAt: string;
  instrument?: HoldingInstrument;
};

export type HoldingLotInput = {
  side: "BUY" | "SELL";
  quantity: number;
  totalPrice?: number;
  pricePerUnit?: number;
  currency: string;
  tradeDate: string;
};

export async function fetchHoldingLots(holdingId: number): Promise<HoldingLot[]> {
  return apiClient.get<HoldingLot[]>(`/api/holdings/${holdingId}/lots`);
}

export async function createHoldingLot(
  holdingId: number,
  input: HoldingLotInput,
): Promise<HoldingLot> {
  return apiClient.post<HoldingLot>(`/api/holdings/${holdingId}/lots`, input);
}

export async function deleteHoldingLot(id: number): Promise<void> {
  return apiClient.delete(`/api/holding-lots/${id}`);
}
