import { Prisma } from "@prisma/client";
import { badRequest } from "../lib/errors";

export const CASH_TX_TYPES = ["INCOME", "EXPENSE"] as const;

export type CashTxType = (typeof CASH_TX_TYPES)[number];

const ALLOWED = new Set<string>(CASH_TX_TYPES);

export function parseCashTxType(value: unknown): CashTxType {
  if (value === undefined || value === null || value === "") {
    throw badRequest(`type must be one of: ${CASH_TX_TYPES.join(", ")}`);
  }
  const raw = String(value).trim().toUpperCase();
  if (!ALLOWED.has(raw)) {
    throw badRequest(`type must be one of: ${CASH_TX_TYPES.join(", ")}`);
  }
  return raw as CashTxType;
}

/** Positive finite amount only (rejects 0 and negatives). */
export function parsePositiveAmount(value: unknown): Prisma.Decimal {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw badRequest("amount must be a positive number");
  }
  return new Prisma.Decimal(n);
}

/** INCOME → +amount, EXPENSE → −amount. */
export function signedDelta(type: CashTxType, amount: Prisma.Decimal): Prisma.Decimal {
  return type === "INCOME" ? amount : amount.negated();
}
