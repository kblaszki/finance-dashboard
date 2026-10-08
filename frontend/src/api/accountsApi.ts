import { apiClient } from "./client";

export const ACCOUNT_TYPES = [
  "BANK",
  "BROKERAGE",
  "CRYPTO",
  "PRECIOUS_METAL",
  "REAL_ESTATE",
  "OTHER",
  "MANUAL",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export type Account = {
  id: number;
  userId: number;
  accountType: AccountType | string;
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
  accountType?: AccountType;
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

export type AccountBalanceHistoryPoint = {
  month: string;
  balance: number;
};

export type AccountBalanceHistory = {
  accountId: number;
  currency: string;
  monthCount: number;
  series: AccountBalanceHistoryPoint[];
};

export async function fetchAccountBalanceHistory(
  id: number,
  options: { month?: string; months?: number } = {},
): Promise<AccountBalanceHistory> {
  const params = new URLSearchParams();
  if (options.month) params.set("month", options.month);
  if (options.months != null) params.set("months", String(options.months));
  const query = params.toString();
  return apiClient.get<AccountBalanceHistory>(
    `/api/accounts/${id}/balance-history${query ? `?${query}` : ""}`,
  );
}

export async function updateAccount(id: number, input: UpdateAccountInput): Promise<Account> {
  return apiClient.patch<Account>(`/api/accounts/${id}`, input);
}

export async function deleteAccount(id: number): Promise<void> {
  await apiClient.delete(`/api/accounts/${id}`);
}
