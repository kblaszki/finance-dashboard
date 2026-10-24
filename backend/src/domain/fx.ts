import { Prisma } from "@prisma/client";
import { badRequest } from "../lib/errors";
import { normalizeCurrencyCode } from "./money";

/** Supported conversion codes. PLN is the pivot and is never stored in FxRateDaily. */
export const FX_CURRENCIES = ["PLN", "EUR", "USD"] as const;
export type FxCurrency = (typeof FX_CURRENCIES)[number];

/** Foreign currencies fetched from NBP (never PLN). */
export const FX_NBP_CURRENCIES = ["EUR", "USD"] as const;
export type FxNbpCurrency = (typeof FX_NBP_CURRENCIES)[number];

const FX_SET = new Set<string>(FX_CURRENCIES);
const NBP_SET = new Set<string>(FX_NBP_CURRENCIES);

export function isFxCurrency(code: string): code is FxCurrency {
  return FX_SET.has(code);
}

export function isFxNbpCurrency(code: string): code is FxNbpCurrency {
  return NBP_SET.has(code);
}

export function assertFxCurrency(value: unknown): FxCurrency {
  const code = normalizeCurrencyCode(value);
  if (!isFxCurrency(code)) {
    throw badRequest(`FX currency must be one of ${FX_CURRENCIES.join(", ")}`);
  }
  return code;
}

export function assertFxNbpCurrency(value: unknown): FxNbpCurrency {
  const code = normalizeCurrencyCode(value);
  if (!isFxNbpCurrency(code)) {
    throw badRequest(`NBP FX sync supports only ${FX_NBP_CURRENCIES.join(", ")}`);
  }
  return code;
}

export type GetMidFn = (
  currency: FxNbpCurrency,
  asOf: Date,
) => Promise<Prisma.Decimal>;

/**
 * Convert a major-unit amount between PLN/EUR/USD using NBP mids via PLN.
 * `getMid` must return PLN per 1 unit of the foreign currency on or before asOf.
 */
export async function convertMajor(input: {
  amount: number;
  from: string;
  to: string;
  asOf: Date;
  getMid: GetMidFn;
}): Promise<number> {
  if (!Number.isFinite(input.amount)) {
    throw badRequest("amount must be a valid number");
  }
  const from = assertFxCurrency(input.from);
  const to = assertFxCurrency(input.to);
  if (from === to) return input.amount;

  const midFrom =
    from === "PLN" ? new Prisma.Decimal(1) : await input.getMid(from, input.asOf);
  const midTo =
    to === "PLN" ? new Prisma.Decimal(1) : await input.getMid(to, input.asOf);

  if (midFrom.lte(0) || midTo.lte(0)) {
    throw badRequest("FX mid rate must be positive");
  }

  const amount = new Prisma.Decimal(input.amount.toString());
  const inPln = amount.mul(midFrom);
  return inPln.div(midTo).toDecimalPlaces(8).toNumber();
}

/** Parse YYYY-MM-DD as UTC midnight. */
export function utcDateFromYmd(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) throw badRequest("date must be YYYY-MM-DD");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw badRequest("date must be a valid calendar day");
  }
  return dt;
}

export function formatYmdUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
