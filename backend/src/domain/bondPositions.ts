import { Prisma, type BondPosition, type PrismaClient } from "@prisma/client";
import { badRequest } from "../lib/errors";
import {
  BOND_COUPON_FREQUENCIES,
  BOND_RATE_KINDS,
  type BondCouponFrequency,
  type BondRateKind,
  sumBondGross,
  valueBondPosition,
} from "./bondValuation";
import {
  parseMoneyDecimal,
  parseQuantityDecimal,
} from "./money";

type Db = PrismaClient | Prisma.TransactionClient;

export const TREASURY_BONDS_ACCOUNT_TYPE = "TREASURY_BONDS";
export const DEFAULT_BOND_ISSUER = "SKARB_PANSTWA";

export function assertTreasuryBondsAccount(account: {
  accountType: string;
  currency: string;
}): void {
  if (account.accountType !== TREASURY_BONDS_ACCOUNT_TYPE) {
    throw badRequest("bond positions require accountType TREASURY_BONDS");
  }
  if (account.currency !== "PLN") {
    throw badRequest("bond positions require PLN currency");
  }
}

function parseEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!(allowed as readonly string[]).includes(raw)) {
    throw badRequest(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return raw as T;
}

function parseRequiredDate(value: unknown, field: string): Date {
  if (value === undefined || value === null || value === "") {
    throw badRequest(`${field} is required`);
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${field} must be a valid date`);
  }
  return date;
}

function parseOptionalNotes(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text.length > 500) throw badRequest("notes must be at most 500 characters");
  return text.length ? text : null;
}

function parseSeriesCode(value: unknown): string {
  const code = String(value ?? "").trim().toUpperCase();
  if (!code) throw badRequest("seriesCode is required");
  if (code.length > 32) throw badRequest("seriesCode must be at most 32 characters");
  return code;
}

function parseRatePct(value: unknown, field: string): Prisma.Decimal {
  const decimal = parseMoneyDecimal(value, field, {
    allowNegative: false,
    allowZero: true,
  });
  if (decimal.gt(100)) {
    throw badRequest(`${field} must be at most 100`);
  }
  return decimal;
}

export type BondPositionCreateInput = {
  seriesCode: string;
  issuer: string;
  quantity: Prisma.Decimal;
  unitNominal: Prisma.Decimal;
  unitPurchasePrice: Prisma.Decimal;
  purchasedAt: Date;
  rateKind: BondRateKind;
  currentAnnualRatePct: Prisma.Decimal;
  couponFrequency: BondCouponFrequency;
  periodStart: Date;
  maturityDate: Date;
  earlyExitFeePerUnit: Prisma.Decimal;
  notes: string | null;
};

export type BondPositionPatchInput = Partial<BondPositionCreateInput>;

export function parseBondPositionCreate(
  body: Record<string, unknown>,
): BondPositionCreateInput {
  const quantity = parseQuantityDecimal(body.quantity);
  const unitNominal =
    body.unitNominal === undefined || body.unitNominal === null || body.unitNominal === ""
      ? new Prisma.Decimal(100)
      : parseMoneyDecimal(body.unitNominal, "unitNominal");
  const unitPurchasePrice = parseMoneyDecimal(body.unitPurchasePrice, "unitPurchasePrice", {
    allowZero: true,
  });
  const earlyExitFeePerUnit =
    body.earlyExitFeePerUnit === undefined ||
    body.earlyExitFeePerUnit === null ||
    body.earlyExitFeePerUnit === ""
      ? new Prisma.Decimal(1)
      : parseMoneyDecimal(body.earlyExitFeePerUnit, "earlyExitFeePerUnit", {
          allowZero: true,
        });
  const periodStart = parseRequiredDate(body.periodStart, "periodStart");
  const maturityDate = parseRequiredDate(body.maturityDate, "maturityDate");
  if (maturityDate.getTime() < periodStart.getTime()) {
    throw badRequest("maturityDate must be on or after periodStart");
  }
  const issuerRaw = body.issuer === undefined || body.issuer === null || body.issuer === ""
    ? DEFAULT_BOND_ISSUER
    : String(body.issuer).trim().toUpperCase();
  if (!issuerRaw) throw badRequest("issuer is required");
  if (issuerRaw.length > 64) throw badRequest("issuer must be at most 64 characters");

  return {
    seriesCode: parseSeriesCode(body.seriesCode),
    issuer: issuerRaw,
    quantity,
    unitNominal,
    unitPurchasePrice,
    purchasedAt: parseRequiredDate(body.purchasedAt, "purchasedAt"),
    rateKind: parseEnum(body.rateKind, "rateKind", BOND_RATE_KINDS),
    currentAnnualRatePct: parseRatePct(body.currentAnnualRatePct, "currentAnnualRatePct"),
    couponFrequency: parseEnum(
      body.couponFrequency,
      "couponFrequency",
      BOND_COUPON_FREQUENCIES,
    ),
    periodStart,
    maturityDate,
    earlyExitFeePerUnit,
    notes: parseOptionalNotes(body.notes),
  };
}

export function parseBondPositionPatch(
  body: Record<string, unknown>,
): BondPositionPatchInput {
  const patch: BondPositionPatchInput = {};
  if (body.seriesCode !== undefined) patch.seriesCode = parseSeriesCode(body.seriesCode);
  if (body.issuer !== undefined) {
    const issuer = String(body.issuer ?? "").trim().toUpperCase();
    if (!issuer) throw badRequest("issuer is required");
    if (issuer.length > 64) throw badRequest("issuer must be at most 64 characters");
    patch.issuer = issuer;
  }
  if (body.quantity !== undefined) patch.quantity = parseQuantityDecimal(body.quantity);
  if (body.unitNominal !== undefined) {
    patch.unitNominal = parseMoneyDecimal(body.unitNominal, "unitNominal");
  }
  if (body.unitPurchasePrice !== undefined) {
    patch.unitPurchasePrice = parseMoneyDecimal(
      body.unitPurchasePrice,
      "unitPurchasePrice",
      { allowZero: true },
    );
  }
  if (body.purchasedAt !== undefined) {
    patch.purchasedAt = parseRequiredDate(body.purchasedAt, "purchasedAt");
  }
  if (body.rateKind !== undefined) {
    patch.rateKind = parseEnum(body.rateKind, "rateKind", BOND_RATE_KINDS);
  }
  if (body.currentAnnualRatePct !== undefined) {
    patch.currentAnnualRatePct = parseRatePct(
      body.currentAnnualRatePct,
      "currentAnnualRatePct",
    );
  }
  if (body.couponFrequency !== undefined) {
    patch.couponFrequency = parseEnum(
      body.couponFrequency,
      "couponFrequency",
      BOND_COUPON_FREQUENCIES,
    );
  }
  if (body.periodStart !== undefined) {
    patch.periodStart = parseRequiredDate(body.periodStart, "periodStart");
  }
  if (body.maturityDate !== undefined) {
    patch.maturityDate = parseRequiredDate(body.maturityDate, "maturityDate");
  }
  if (body.earlyExitFeePerUnit !== undefined) {
    patch.earlyExitFeePerUnit = parseMoneyDecimal(
      body.earlyExitFeePerUnit,
      "earlyExitFeePerUnit",
      { allowZero: true },
    );
  }
  if (body.notes !== undefined) {
    patch.notes = parseOptionalNotes(body.notes);
  }
  if (Object.keys(patch).length === 0) {
    throw badRequest("No updatable fields provided");
  }
  return patch;
}

export function valuationForPosition(
  position: BondPosition,
  asOf: Date = new Date(),
) {
  return valueBondPosition({
    quantity: position.quantity,
    unitNominal: position.unitNominal,
    unitPurchasePrice: position.unitPurchasePrice,
    currentAnnualRatePct: position.currentAnnualRatePct,
    earlyExitFeePerUnit: position.earlyExitFeePerUnit,
    periodStart: position.periodStart,
    maturityDate: position.maturityDate,
    asOf,
  });
}

/** Gross bond value per account (major units), valued asOf. */
export async function bondGrossByAccountIds(
  db: Db,
  accountIds: number[],
  asOf: Date = new Date(),
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (accountIds.length === 0) return out;
  const positions = await db.bondPosition.findMany({
    where: { accountId: { in: accountIds } },
  });
  const byAccount = new Map<number, BondPosition[]>();
  for (const position of positions) {
    const list = byAccount.get(position.accountId) ?? [];
    list.push(position);
    byAccount.set(position.accountId, list);
  }
  for (const [accountId, list] of byAccount) {
    const valuations = list.map((p) => valuationForPosition(p, asOf));
    out.set(accountId, sumBondGross(valuations));
  }
  return out;
}

/** Add bond gross into equity holdings map (same keys / major units). */
export function mergeHoldingsWithBondGross(
  holdings: Map<number, number>,
  bondGross: Map<number, number>,
): Map<number, number> {
  const out = new Map(holdings);
  for (const [accountId, gross] of bondGross) {
    const prev = out.get(accountId) ?? 0;
    out.set(accountId, Math.round((prev + gross) * 100) / 100);
  }
  return out;
}
