import { apiClient } from "./client";

export type InternalTransfer = {
  groupId: string;
  fromAccountId: number;
  toAccountId: number;
  fromAccountName: string;
  toAccountName: string;
  fromAmount: number;
  toAmount: number;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  commission: number;
  note?: string;
  date: string;
  outTransactionId: number;
  inTransactionId: number;
};

export type InternalTransferInput = {
  fromAccountId: number;
  toAccountId: number;
  fromAmount: number;
  toAmount: number;
  exchangeRate?: number;
  commission?: number;
  date: string;
  note?: string;
};

export type InternalTransferQuery = {
  from?: string;
  to?: string;
  accountId?: number;
};

export type FxTransferSuggestion = {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  exchangeRate: number;
  suggestedToAmount: number;
};

function buildQuery(opts?: InternalTransferQuery): string {
  if (!opts) return "";
  const q = new URLSearchParams();
  if (opts.from) q.set("from", opts.from);
  if (opts.to) q.set("to", opts.to);
  if (opts.accountId != null) q.set("accountId", String(opts.accountId));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function fetchInternalTransfers(opts?: InternalTransferQuery) {
  return apiClient.get<{ transfers: InternalTransfer[] }>(`/api/internal-transfers${buildQuery(opts)}`);
}

export function fetchInternalTransferFxSuggestion(params: {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
}) {
  const q = new URLSearchParams({
    fromCurrency: params.fromCurrency,
    toCurrency: params.toCurrency,
    fromAmount: String(params.fromAmount),
  });
  return apiClient.get<FxTransferSuggestion>(`/api/internal-transfers/fx-suggestion?${q}`);
}

export function createInternalTransfer(input: InternalTransferInput) {
  return apiClient.post<InternalTransfer>("/api/internal-transfers", input);
}

export function deleteInternalTransfer(groupId: string) {
  return apiClient.delete(`/api/internal-transfers/${groupId}`);
}
