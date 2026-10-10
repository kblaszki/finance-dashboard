import { apiClient } from "./client";

export type CashTransfer = {
  id: number;
  fromAccountId: number;
  toAccountId: number;
  fromCurrency: string;
  toCurrency: string;
  amountFrom: number;
  amountTo: number;
  fxRate: number | null;
  occurredAt: string;
  description: string | null;
  createdAt: string;
};

export type CreateTransferInput = {
  fromAccountId: number;
  toAccountId: number;
  amountFrom: number;
  amountTo?: number;
  occurredAt?: string;
  description?: string | null;
};

export type UpdateTransferInput = Partial<CreateTransferInput>;

export async function fetchTransfers(): Promise<CashTransfer[]> {
  return apiClient.get<CashTransfer[]>("/api/transfers");
}

export async function createTransfer(
  input: CreateTransferInput,
): Promise<CashTransfer> {
  return apiClient.post<CashTransfer>("/api/transfers", input);
}

export async function updateTransfer(
  id: number,
  input: UpdateTransferInput,
): Promise<CashTransfer> {
  return apiClient.patch<CashTransfer>(`/api/transfers/${id}`, input);
}

export async function deleteTransfer(id: number): Promise<void> {
  await apiClient.delete(`/api/transfers/${id}`);
}
