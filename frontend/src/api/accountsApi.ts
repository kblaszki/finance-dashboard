import { apiClient } from "./client";

export type AccountType =
  | "BANK"
  | "BROKERAGE"
  | "CRYPTO"
  | "PRECIOUS_METAL"
  | "REAL_ESTATE"
  | "OTHER"
  | "MANUAL";

export type TaxWrapperType = "standard" | "ike" | "ikze" | "ppk";

export type RentalTaxMethod = "scale" | "lump_sum_8_5";

export type Account = {
  id: number;
  accountType: AccountType;
  name: string;
  currency: string;
  cashBalance: number;
  totalBalance: number;
  openingBalance: number;
  openingCashAsOf: string | null;
  metalGrams: number | null;
  taxWrapperType: TaxWrapperType;
  rentalTaxMethod: RentalTaxMethod | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountInput = {
  accountType: AccountType;
  name: string;
  currency: string;
  openingBalance?: number;
  openingCashAsOf?: string | null;
  description?: string | null;
};

export type AccountValuationPoint = {
  valuationDate: string;
  totalValue: number;
  cashValue: number;
  securitiesValue: number;
  currency: string;
};

export type AccountDetailStats = {
  currency: string;
  ytdIncome: number;
  ytdExpense: number;
  ytdNet: number;
  yoyChangeAbs: number | null;
  yoyChangePct: number | null;
  currentTotal: number;
  breakdown?: {
    cashValue: number;
    securitiesValue: number;
    cashPct: number;
    securitiesPct: number;
  };
};

export async function fetchAccounts(): Promise<Account[]> {
  return apiClient.get<Account[]>("/api/accounts");
}

export async function fetchAccount(id: number): Promise<Account> {
  return apiClient.get<Account>(`/api/accounts/${id}`);
}

export async function fetchAccountStats(
  accountId: number,
  currency?: string,
): Promise<AccountDetailStats> {
  const params = new URLSearchParams();
  if (currency) params.set("currency", currency);
  const q = params.toString() ? `?${params}` : "";
  return apiClient.get<AccountDetailStats>(`/api/accounts/${accountId}/stats${q}`);
}

export async function createAccount(input: AccountInput): Promise<Account> {
  return apiClient.post<Account>("/api/accounts", input);
}

export async function updateAccount(
  id: number,
  input: Partial<Pick<AccountInput, "name" | "description">> & {
    metalGrams?: number | null;
    taxWrapperType?: TaxWrapperType;
    rentalTaxMethod?: RentalTaxMethod | null;
  },
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

export type AccountRevalueInput = {
  value: number;
  valuationDate?: string;
};

export async function revalueAccount(id: number, input: AccountRevalueInput): Promise<Account> {
  return apiClient.post<Account>(`/api/accounts/${id}/revalue`, input);
}
