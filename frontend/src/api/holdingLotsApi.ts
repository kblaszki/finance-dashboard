import { apiClient } from "./client";
import type { Instrument } from "./instrumentsApi";

export type HoldingLot = {
  id: number;
  accountId: number;
  instrumentId: number;
  side: "BUY" | "SELL";
  quantity: number;
  quantityAfter: number;
  totalPrice: number | null;
  pricePerUnit: number | null;
  currency: string;
  tradeDate: string;
  createdAt: string;
  instrument?: Pick<Instrument, "id" | "symbol" | "name" | "instrumentType" | "exchange" | "currency">;
};

export type HoldingLotInput = {
  instrumentId: number;
  side: "BUY" | "SELL";
  quantity: number;
  totalPrice?: number;
  pricePerUnit?: number;
  currency: string;
  tradeDate: string;
};

export async function fetchHoldingLots(accountId: number): Promise<HoldingLot[]> {
  return apiClient.get<HoldingLot[]>(`/api/accounts/${accountId}/holding-lots`);
}

export async function createHoldingLot(
  accountId: number,
  input: HoldingLotInput,
): Promise<HoldingLot> {
  return apiClient.post<HoldingLot>(`/api/accounts/${accountId}/holding-lots`, input);
}

export async function deleteHoldingLot(id: number): Promise<void> {
  return apiClient.delete(`/api/holding-lots/${id}`);
}
