import { apiClient } from "./client";

export type LiabilityType = "mortgage" | "loan" | "credit" | "tax_provision" | "tax_advance";

export type Liability = {
  id: number;
  name: string;
  liabilityType: LiabilityType;
  balance: number;
  currency: string;
  accountId: number | null;
  accountName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LiabilityInput = {
  name: string;
  liabilityType: LiabilityType;
  balance: number;
  currency: string;
  accountId?: number | null;
};

export function fetchLiabilities(): Promise<Liability[]> {
  return apiClient.get<Liability[]>("/api/liabilities");
}

export function createLiability(input: LiabilityInput): Promise<Liability> {
  return apiClient.post<Liability>("/api/liabilities", input);
}

export function updateLiability(id: number, input: Partial<LiabilityInput>): Promise<Liability> {
  return apiClient.put<Liability>(`/api/liabilities/${id}`, input);
}

export function deleteLiability(id: number): Promise<void> {
  return apiClient.delete(`/api/liabilities/${id}`);
}
