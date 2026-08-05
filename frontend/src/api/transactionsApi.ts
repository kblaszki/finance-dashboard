import { apiClient } from "./client";

export const CASH_TX_TYPES = ["INCOME", "EXPENSE"] as const;

export type CashTxType = (typeof CASH_TX_TYPES)[number];

export type CashTransaction = {
  id: number;
  accountId: number;
  type: CashTxType | string;
  amount: number;
  occurredAt: string;
  description: string | null;
  categoryId: number | null;
  createdAt: string;
};

export type CreateCashTransactionInput = {
  type: CashTxType;
  amount: number;
  occurredAt?: string;
  description?: string | null;
  categoryId?: number | null;
};

export async function fetchTransactions(
  accountId: number,
): Promise<CashTransaction[]> {
  return apiClient.get<CashTransaction[]>(
    `/api/accounts/${accountId}/transactions`,
  );
}

export async function createTransaction(
  accountId: number,
  input: CreateCashTransactionInput,
): Promise<CashTransaction> {
  return apiClient.post<CashTransaction>(
    `/api/accounts/${accountId}/transactions`,
    input,
  );
}

export async function deleteTransaction(
  accountId: number,
  id: number,
): Promise<void> {
  await apiClient.delete(`/api/accounts/${accountId}/transactions/${id}`);
}

export async function exportTransactionsCsv(accountId: number): Promise<Blob> {
  return apiClient.getBlob(`/api/accounts/${accountId}/transactions/export`);
}

export type ImportTransactionsResult = {
  created: number;
};

export async function importTransactionsCsv(
  accountId: number,
  csv: string,
): Promise<ImportTransactionsResult> {
  return apiClient.post<ImportTransactionsResult>(
    `/api/accounts/${accountId}/transactions/import`,
    { csv },
  );
}
