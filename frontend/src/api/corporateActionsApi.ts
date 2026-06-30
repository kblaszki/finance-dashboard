import { apiClient } from "./client";

export type CorporateActionType = "stock_split" | "reverse_split" | "merger" | "spinoff";

export type CorporateAction = {
  id: number;
  accountId: number;
  accountName: string | null;
  holdingId: number | null;
  instrumentId: number;
  symbol: string | null;
  actionType: CorporateActionType;
  actionDate: string;
  ratio: number | null;
  quantityDelta: number | null;
  notes: string | null;
  createdAt: string;
};

export type CorporateActionInput = {
  accountId: number;
  instrumentId: number;
  actionType: CorporateActionType;
  actionDate: string;
  holdingId?: number | null;
  ratio?: number | null;
  quantityDelta?: number | null;
  notes?: string | null;
};

export function fetchCorporateActions(opts?: {
  accountId?: number;
  from?: string;
  to?: string;
}): Promise<CorporateAction[]> {
  const params = new URLSearchParams();
  if (opts?.accountId) params.set("accountId", String(opts.accountId));
  if (opts?.from) params.set("from", opts.from);
  if (opts?.to) params.set("to", opts.to);
  const q = params.toString() ? `?${params}` : "";
  return apiClient.get<CorporateAction[]>(`/api/corporate-actions${q}`);
}

export function createCorporateAction(input: CorporateActionInput): Promise<CorporateAction> {
  return apiClient.post<CorporateAction>("/api/corporate-actions", input);
}
