import { apiClient } from "./client";

export type LegacyAccountType = "BANK" | "REAL_ESTATE" | "CRYPTO" | "LIABILITY" | "BONDS";

export type ManagedAccountType = "BANK" | "BROKERAGE";

export type ManagedAccount = {
  id: number;
  userId: number;
  type: ManagedAccountType;
  name: string;
  currency: string;
  notes: string | null;
  openingBalance?: number;
  cashBalance?: number;
  baseCurrency?: string;
  balance: number | null;
  createdAt: string;
  updatedAt: string;
};

export type BalanceHistoryPoint = {
  date: string;
  balance: number;
  cashComponent: number | null;
  securitiesComponent: number | null;
  currency: string;
};

export type FinancialAccount = {
  id: number;
  userId: number;
  type: LegacyAccountType;
  name: string;
  currency: string;
  openingBalance: number;
  manualValue: number | null;
  notes: string | null;
  balance?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type FinancialAccountInput = {
  type: LegacyAccountType | ManagedAccountType;
  name: string;
  currency: string;
  baseCurrency?: string;
  openingBalance?: number;
  manualValue?: number | null;
  notes?: string | null;
};

export async function fetchManagedAccounts(
  types = "BANK,BROKERAGE",
): Promise<ManagedAccount[]> {
  return apiClient.get<ManagedAccount[]>(`/api/accounts?scope=managed&types=${types}`);
}

export async function fetchBalanceHistory(
  accountId: number,
  from?: string,
  to?: string,
): Promise<BalanceHistoryPoint[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const q = params.toString() ? `?${params}` : "";
  return apiClient.get<BalanceHistoryPoint[]>(`/api/accounts/${accountId}/balance-history${q}`);
}

export async function fetchAccountTransactions(accountId: number) {
  return apiClient.get(`/api/accounts/${accountId}/transactions`);
}

export async function fetchAccountTrades(accountId: number) {
  return apiClient.get(`/api/accounts/${accountId}/trades`);
}

export async function fetchAccounts(type?: LegacyAccountType): Promise<FinancialAccount[]> {
  const q = type ? `?type=${type}` : "";
  return apiClient.get<FinancialAccount[]>(`/api/accounts${q}`);
}

export async function createAccount(
  input: FinancialAccountInput,
): Promise<FinancialAccount | ManagedAccount> {
  return apiClient.post("/api/accounts", input);
}

export async function updateAccount(
  id: number,
  input: Partial<FinancialAccountInput>,
): Promise<FinancialAccount> {
  return apiClient.put<FinancialAccount>(`/api/accounts/${id}`, input);
}

export async function deleteAccount(id: number): Promise<void> {
  return apiClient.delete(`/api/accounts/${id}`);
}
