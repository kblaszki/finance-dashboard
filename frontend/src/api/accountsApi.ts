import { apiClient } from "./client";

export type AccountType = "BANK" | "REAL_ESTATE" | "CRYPTO" | "LIABILITY" | "BONDS";

export type FinancialAccount = {
  id: number;
  userId: number;
  type: AccountType;
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
  type: AccountType;
  name: string;
  currency: string;
  openingBalance?: number;
  manualValue?: number | null;
  notes?: string | null;
};

export async function fetchAccounts(type?: AccountType): Promise<FinancialAccount[]> {
  const q = type ? `?type=${type}` : "";
  return apiClient.get<FinancialAccount[]>(`/api/accounts${q}`);
}

export async function createAccount(input: FinancialAccountInput): Promise<FinancialAccount> {
  return apiClient.post<FinancialAccount>("/api/accounts", input);
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
