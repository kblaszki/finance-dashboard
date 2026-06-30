import { apiClient } from "./client";

export type IncomeEventType =
  | "dividend"
  | "interest"
  | "coupon"
  | "capital_gain_distribution";

export type IncomeTaxType = "belka" | "pit38" | "exempt";

export type IncomeEvent = {
  id: number;
  accountId: number;
  accountName: string | null;
  instrumentId: number | null;
  instrumentSymbol: string | null;
  instrumentCountry: string | null;
  eventType: IncomeEventType;
  taxType: IncomeTaxType | null;
  amount: number;
  currency: string;
  occurredOn: string;
  description: string | null;
  withheldTax: number;
  sourceCountry: string | null;
  foreignTaxPaid: number;
  createdAt: string;
};

export type IncomeEventInput = {
  accountId: number;
  instrumentId?: number | null;
  eventType: IncomeEventType;
  taxType?: IncomeTaxType | null;
  amount: number;
  currency: string;
  date: string;
  description?: string | null;
  withheldTax?: number;
  sourceCountry?: string | null;
  foreignTaxPaid?: number;
};

export type IncomeEventFilters = {
  from?: string;
  to?: string;
  accountId?: number;
};

function buildQuery(opts?: IncomeEventFilters): string {
  if (!opts) return "";
  const params = new URLSearchParams();
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.accountId) params.set("accountId", String(opts.accountId));
  const q = params.toString();
  return q ? `?${q}` : "";
}

export function fetchIncomeEvents(opts?: IncomeEventFilters): Promise<IncomeEvent[]> {
  return apiClient.get<IncomeEvent[]>(`/api/income-events${buildQuery(opts)}`);
}

export function createIncomeEvent(input: IncomeEventInput): Promise<IncomeEvent> {
  return apiClient.post<IncomeEvent>("/api/income-events", input);
}

export function updateIncomeEvent(
  id: number,
  input: Partial<IncomeEventInput>,
): Promise<IncomeEvent> {
  return apiClient.put<IncomeEvent>(`/api/income-events/${id}`, input);
}

export function deleteIncomeEvent(id: number): Promise<void> {
  return apiClient.delete(`/api/income-events/${id}`);
}
