import { apiClient } from "./client";

export type PositionTransfer = {
  id: number;
  fromAccountId: number;
  fromAccountName: string | null;
  toAccountId: number;
  toAccountName: string | null;
  instrumentId: number;
  symbol: string | null;
  quantity: number;
  transferDate: string;
  createdAt: string;
};

export type PositionTransferInput = {
  fromAccountId: number;
  toAccountId: number;
  instrumentId: number;
  quantity: number;
  transferDate: string;
};

export function fetchPositionTransfers(opts?: {
  accountId?: number;
  from?: string;
  to?: string;
}): Promise<PositionTransfer[]> {
  const params = new URLSearchParams();
  if (opts?.accountId) params.set("accountId", String(opts.accountId));
  if (opts?.from) params.set("from", opts.from);
  if (opts?.to) params.set("to", opts.to);
  const q = params.toString() ? `?${params}` : "";
  return apiClient.get<PositionTransfer[]>(`/api/position-transfers${q}`);
}

export function createPositionTransfer(input: PositionTransferInput): Promise<PositionTransfer> {
  return apiClient.post<PositionTransfer>("/api/position-transfers", input);
}
