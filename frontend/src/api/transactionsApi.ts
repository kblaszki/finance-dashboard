import { apiClient } from "./client";

export type TransactionType = "INCOME" | "EXPENSE";

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  currency: string;
  category: string;
  date: string;
  description?: string | null;
  amountConverted?: number;
  convertedCurrency?: string;
  fxAsOf?: string;
}

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  currency: string;
  category: string;
  date: string;
  description?: string;
}

export async function fetchTransactions(opts?: { currency?: string }): Promise<Transaction[]> {
  const q = opts?.currency ? `?currency=${encodeURIComponent(opts.currency)}` : "";
  return apiClient.get<Transaction[]>(`/api/transactions${q}`);
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  return apiClient.post<Transaction>("/api/transactions", input);
}

