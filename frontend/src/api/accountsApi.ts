import { apiClient } from "./client";

export type AccountType = "BANK" | "BROKERAGE" | "MANUAL";

export type Account = {
  id: number;
  accountType: AccountType;
  name: string;
  currency: string;
  cashBalance: number;
  openingBalance: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountInput = {
  accountType: AccountType;
  name: string;
  currency: string;
  openingBalance?: number;
  description?: string | null;
};

export type AccountValuationPoint = {
  valuationDate: string;
  totalValue: number;
  cashValue: number;
  securitiesValue: number;
  currency: string;
};

export async function fetchAccounts(): Promise<Account[]> {
  return apiClient.get<Account[]>("/api/accounts");
}

export async function fetchAccount(id: number): Promise<Account> {
  return apiClient.get<Account>(`/api/accounts/${id}`);
}

export async function createAccount(input: AccountInput): Promise<Account> {
  return apiClient.post<Account>("/api/accounts", input);
}

export async function updateAccount(
  id: number,
  input: Partial<Pick<AccountInput, "name" | "description">>,
): Promise<Account> {
  return apiClient.put<Account>(`/api/accounts/${id}`, input);
}

export async function deleteAccount(id: number): Promise<void> {
  return apiClient.delete(`/api/accounts/${id}`);
}

export async function fetchAccountValuations(
  accountId: number,
  from?: string,
  to?: string,
): Promise<AccountValuationPoint[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const q = params.toString() ? `?${params}` : "";
  return apiClient.get<AccountValuationPoint[]>(`/api/accounts/${accountId}/valuations${q}`);
}
