import { apiClient } from "./client";

export type PropertyFlowType = "rent" | "maintenance" | "other";

export type PropertyCashFlow = {
  id: number;
  accountId: number;
  accountName: string | null;
  flowType: PropertyFlowType;
  amount: number;
  currency: string;
  occurredOn: string;
  description: string | null;
  createdAt: string;
};

export type PropertyCashFlowInput = {
  accountId: number;
  flowType: PropertyFlowType;
  amount: number;
  currency: string;
  date: string;
  description?: string | null;
};

export type PropertyCashFlowFilters = {
  accountId?: number;
  from?: string;
  to?: string;
};

function buildQuery(opts?: PropertyCashFlowFilters): string {
  if (!opts) return "";
  const params = new URLSearchParams();
  if (opts.accountId) params.set("accountId", String(opts.accountId));
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  const q = params.toString();
  return q ? `?${q}` : "";
}

export function fetchPropertyCashFlows(opts?: PropertyCashFlowFilters): Promise<PropertyCashFlow[]> {
  return apiClient.get<PropertyCashFlow[]>(`/api/property-cash-flows${buildQuery(opts)}`);
}

export function createPropertyCashFlow(input: PropertyCashFlowInput): Promise<PropertyCashFlow> {
  return apiClient.post<PropertyCashFlow>("/api/property-cash-flows", input);
}

export function updatePropertyCashFlow(
  id: number,
  input: Partial<PropertyCashFlowInput>,
): Promise<PropertyCashFlow> {
  return apiClient.put<PropertyCashFlow>(`/api/property-cash-flows/${id}`, input);
}

export function deletePropertyCashFlow(id: number): Promise<void> {
  return apiClient.delete(`/api/property-cash-flows/${id}`);
}
