import { apiClient } from "./client";

export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER_TO_PORTFOLIO";

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  currency: string;
  category: string;
  categoryId?: number | null;
  date: string;
  description?: string | null;
  portfolioId?: number | null;
  accountId?: number | null;
  amountConverted?: number;
  convertedCurrency?: string;
  fxAsOf?: string;
}

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  currency: string;
  category: string;
  categoryId?: number | null;
  date: string;
  description?: string;
  portfolioId?: number | null;
  accountId?: number | null;
}

export type TransactionFilters = {
  currency?: string;
  type?: TransactionType;
  from?: string;
  to?: string;
  portfolioId?: number;
  accountId?: number;
};

function buildQuery(opts?: TransactionFilters): string {
  if (!opts) return "";
  const params = new URLSearchParams();
  if (opts.currency) params.set("currency", opts.currency);
  if (opts.type) params.set("type", opts.type);
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.portfolioId) params.set("portfolioId", String(opts.portfolioId));
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
  input: TransactionInput,
): Promise<Transaction> {
  return apiClient.put<Transaction>(`/api/transactions/${id}`, input);
}

export async function deleteTransaction(id: number): Promise<void> {
  return apiClient.delete(`/api/transactions/${id}`);
}
