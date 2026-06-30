import { apiClient } from "./client";

export type PropertySale = {
  id: number;
  accountId: number;
  accountName: string | null;
  soldOn: string;
  proceeds: number;
  acquisitionCost: number;
  improvementsCost: number;
  fiveYearExemption: boolean;
  taxableGain: number;
  currency: string;
  description: string | null;
};

export function fetchPropertySales(opts?: { accountId?: number }) {
  const params = new URLSearchParams();
  if (opts?.accountId) params.set("accountId", String(opts.accountId));
  const q = params.toString() ? `?${params}` : "";
  return apiClient.get<PropertySale[]>(`/api/property-sales${q}`);
}

export function createPropertySale(input: {
  accountId: number;
  soldOn: string;
  proceeds: number;
  acquisitionCost: number;
  improvementsCost?: number;
  fiveYearExemption?: boolean;
  currency: string;
  description?: string | null;
}) {
  return apiClient.post<PropertySale>("/api/property-sales", input);
}

export function deletePropertySale(id: number) {
  return apiClient.delete(`/api/property-sales/${id}`);
}
