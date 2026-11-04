import { apiClient } from "./client";

export type BondRateKind = "FIXED" | "FLOATING" | "INFLATION_LINKED";
export type BondCouponFrequency =
  | "ANNUAL"
  | "SEMI_ANNUAL"
  | "QUARTERLY"
  | "AT_MATURITY";

export type BondValuation = {
  nominalValue: number;
  accruedInterest: number;
  grossValue: number;
  earlyExitFee: number;
  costBasis: number;
  belkaEstimate: number;
  liquidationNet: number;
};

export type BondPosition = {
  id: number;
  accountId: number;
  seriesCode: string;
  issuer: string;
  quantity: number;
  unitNominal: number;
  unitPurchasePrice: number;
  purchasedAt: string;
  rateKind: BondRateKind;
  currentAnnualRatePct: number;
  couponFrequency: BondCouponFrequency;
  periodStart: string;
  maturityDate: string;
  earlyExitFeePerUnit: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  valuation: BondValuation;
};

export type BondPositionsListResponse = {
  positions: BondPosition[];
  totals: {
    nominalValue: number;
    grossValue: number;
    liquidationNet: number;
  };
};

export type CreateBondPositionInput = {
  seriesCode: string;
  quantity: number;
  unitPurchasePrice: number;
  purchasedAt: string;
  rateKind: BondRateKind;
  currentAnnualRatePct: number;
  couponFrequency: BondCouponFrequency;
  periodStart: string;
  maturityDate: string;
  issuer?: string;
  unitNominal?: number;
  earlyExitFeePerUnit?: number;
  notes?: string | null;
};

export type UpdateBondPositionInput = Partial<CreateBondPositionInput>;

export async function fetchBondPositions(
  accountId: number,
): Promise<BondPositionsListResponse> {
  return apiClient.get<BondPositionsListResponse>(
    `/api/accounts/${accountId}/bond-positions`,
  );
}

export async function createBondPosition(
  accountId: number,
  body: CreateBondPositionInput,
): Promise<BondPosition> {
  return apiClient.post<BondPosition>(
    `/api/accounts/${accountId}/bond-positions`,
    body,
  );
}

export async function updateBondPosition(
  accountId: number,
  id: number,
  body: UpdateBondPositionInput,
): Promise<BondPosition> {
  return apiClient.patch<BondPosition>(
    `/api/accounts/${accountId}/bond-positions/${id}`,
    body,
  );
}

export async function deleteBondPosition(
  accountId: number,
  id: number,
): Promise<void> {
  await apiClient.delete(`/api/accounts/${accountId}/bond-positions/${id}`);
}
