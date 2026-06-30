import { apiClient } from "./client";

export type TaxWrapperType = "standard" | "ike" | "ikze" | "ppk";
export type WithdrawalType = "partial" | "full" | "securities_transfer";

export type TaxWrapperWithdrawal = {
  id: number;
  accountId: number;
  accountName: string | null;
  withdrawnOn: string;
  amount: number;
  currency: string;
  withdrawalType: WithdrawalType;
  includeInPit38: boolean;
  description: string | null;
  createdAt: string;
};

export type TaxWrapperWithdrawalInput = {
  accountId: number;
  amount: number;
  currency: string;
  withdrawnOn: string;
  withdrawalType: WithdrawalType;
  includeInPit38?: boolean;
  description?: string | null;
};

export type IkzeContribution = {
  id: number;
  accountId: number;
  accountName: string | null;
  taxYear: number;
  amount: number;
  currency: string;
  contributedOn: string;
  createdAt: string;
};

export type IkzeContributionInput = {
  accountId: number;
  taxYear: number;
  amount: number;
  currency: string;
  contributedOn: string;
};

export function fetchTaxWrapperWithdrawals(opts?: {
  accountId?: number;
  from?: string;
  to?: string;
}): Promise<TaxWrapperWithdrawal[]> {
  const params = new URLSearchParams();
  if (opts?.accountId) params.set("accountId", String(opts.accountId));
  if (opts?.from) params.set("from", opts.from);
  if (opts?.to) params.set("to", opts.to);
  const q = params.toString() ? `?${params}` : "";
  return apiClient.get<TaxWrapperWithdrawal[]>(`/api/tax-wrapper-withdrawals${q}`);
}

export function createTaxWrapperWithdrawal(
  input: TaxWrapperWithdrawalInput,
): Promise<TaxWrapperWithdrawal> {
  return apiClient.post<TaxWrapperWithdrawal>("/api/tax-wrapper-withdrawals", input);
}

export function deleteTaxWrapperWithdrawal(id: number): Promise<void> {
  return apiClient.delete(`/api/tax-wrapper-withdrawals/${id}`);
}

export function fetchIkzeContributions(opts?: {
  accountId?: number;
  taxYear?: number;
}): Promise<IkzeContribution[]> {
  const params = new URLSearchParams();
  if (opts?.accountId) params.set("accountId", String(opts.accountId));
  if (opts?.taxYear != null) params.set("taxYear", String(opts.taxYear));
  const q = params.toString() ? `?${params}` : "";
  return apiClient.get<IkzeContribution[]>(`/api/ikze-contributions${q}`);
}

export function createIkzeContribution(input: IkzeContributionInput): Promise<IkzeContribution> {
  return apiClient.post<IkzeContribution>("/api/ikze-contributions", input);
}

export function deleteIkzeContribution(id: number): Promise<void> {
  return apiClient.delete(`/api/ikze-contributions/${id}`);
}
