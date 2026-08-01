import { apiClient } from "./client";

export type Account = {
  id: number;
  userId: number;
  accountType: string;
  name: string;
  currency: string;
  cashBalance: number;
  openingBalance: number;
  openingCashAsOf: string | null;
  description: string | null;
  totalBalance: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateAccountInput = {
  name: string;
  currency?: string;
  openingBalance?: number;
  openingCashAsOf?: string | null;
  description?: string | null;
  accountType?: string;
};

export type UpdateAccountInput = {
  name?: string;
  currency?: string;
  description?: string | null;
};

export async function fetchAccounts(): Promise<Account[]> {
  return apiClient.get<Account[]>("/api/accounts");
}

export async function createAccount(input: CreateAccountInput): Promise<Account> {
  return apiClient.post<Account>("/api/accounts", input);
}

export async function fetchAccount(id: number): Promise<Account> {
  return apiClient.get<Account>(`/api/accounts/${id}`);
}

export async function updateAccount(id: number, input: UpdateAccountInput): Promise<Account> {
  return apiClient.patch<Account>(`/api/accounts/${id}`, input);
}

export async function deleteAccount(id: number): Promise<void> {
  await apiClient.delete(`/api/accounts/${id}`);
}
