import { apiClient } from "./client";

export type TransactionType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "DIVIDEND"
  | "INTEREST";

export interface Transaction {
  id: number;
  accountId: number;
  transactionType: TransactionType;
  amount: number;
  balanceAfter: number;
  currency: string;
  category: string;
  categoryId: number | null;
  date: string;
  description?: string | null;
  splits?: Array<{
    id: number;
    categoryId: number;
    categoryName: string | null;
    amount: number;
  }>;
}

export interface TransactionInput {
  accountId: number;
  transactionType: TransactionType;
  amount: number;
  currency: string;
  category?: string;
  categoryId?: number | null;
  date: string;
  description?: string;
  splits?: Array<{ categoryId: number; amount: number }>;
}

export type TransactionFilters = {
  from?: string;
  to?: string;
  accountId?: number;
};

function buildQuery(opts?: TransactionFilters): string {
  if (!opts) return "";
  const params = new URLSearchParams();
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.accountId) params.set("accountId", String(opts.accountId));
  const q = params.toString();
  return q ? `?${q}` : "";
}

export async function fetchTransactions(opts?: TransactionFilters): Promise<Transaction[]> {
  return apiClient.get<Transaction[]>(`/api/transactions${buildQuery(opts)}`);
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  return apiClient.post<Transaction>("/api/transactions", input);
}

export async function updateTransaction(
  id: number,
  input: Partial<TransactionInput>,
): Promise<Transaction> {
  return apiClient.put<Transaction>(`/api/transactions/${id}`, input);
}

export async function deleteTransaction(id: number): Promise<void> {
  return apiClient.delete(`/api/transactions/${id}`);
}
