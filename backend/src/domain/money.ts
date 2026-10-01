import { Prisma } from "@prisma/client";
import { badRequest } from "../lib/errors";

const SCALE = 2;
const MINOR_PER_MAJOR = 100;
const CURRENCY_RE = /^[A-Z]{3}$/;

/**
 * Parse a money amount into a 2-decimal Prisma.Decimal without adding binary floats.
 * JSON numbers are accepted only when they are finite and within the safe-integer range.
 */
export function parseMoneyDecimal(
  value: unknown,
  field: string,
  options: { allowNegative?: boolean; allowZero?: boolean } = {},
): Prisma.Decimal {
  const decimal = coerceDecimal(value, field);
  if (decimal.decimalPlaces() > SCALE) {
    throw badRequest(`${field} must have at most 2 decimal places`);
  }
  const minor = decimalToMinor(decimal, field);
  if (!options.allowNegative && minor < 0) {
    throw badRequest(`${field} must be a positive number`);
  }
  if (!options.allowZero && minor === 0) {
    throw badRequest(`${field} must be a positive number`);
  }
  if (!options.allowNegative && minor <= 0) {
    throw badRequest(`${field} must be a positive number`);
  }
  return new Prisma.Decimal(minor).div(MINOR_PER_MAJOR);
}

export function parsePositiveAmount(value: unknown): Prisma.Decimal {
  return parseMoneyDecimal(value, "amount");
}

export function parseOpeningBalance(value: unknown): Prisma.Decimal {
  return parseMoneyDecimal(value, "openingBalance", {
    allowNegative: true,
    allowZero: true,
  });
}

/** Integer minor units (cents). Exact for SQLite INTEGER columns. */
export function decimalToMinor(value: Prisma.Decimal, field = "amount"): number {
  const minor = value.mul(MINOR_PER_MAJOR);
  if (!minor.isInteger()) {
    throw badRequest(`${field} must have at most 2 decimal places`);
  }
  const n = minor.toNumber();
  if (!Number.isSafeInteger(n)) {
    throw badRequest(`${field} is too large`);
  }
  return n === 0 ? 0 : n;
}

export function majorToMinor(value: Prisma.Decimal | number, field = "amount"): number {
  const decimal = value instanceof Prisma.Decimal ? value : coerceDecimal(value, field);
  return decimalToMinor(decimal, field);
}

export function minorToMajor(minor: number): number {
  return new Prisma.Decimal(minor).div(MINOR_PER_MAJOR).toNumber();
}

export function minorToDecimal(minor: number): Prisma.Decimal {
  return new Prisma.Decimal(minor).div(MINOR_PER_MAJOR);
}

/** Half-up to cents. Used when a JS number is already a display amount (demo seed). */
export function quantizeMajorToMinor(value: number, field = "amount"): number {
  if (!Number.isFinite(value)) throw badRequest(`${field} must be a valid number`);
  const minor = new Prisma.Decimal(value.toString()).toDecimalPlaces(SCALE).mul(MINOR_PER_MAJOR);
  const n = minor.toNumber();
  if (!Number.isSafeInteger(n)) throw badRequest(`${field} is too large`);
  return n;
}

/** Major-unit input (number or Decimal) as a Decimal, or null when it is not finite. */
export function majorToDecimal(value: Prisma.Decimal | number): Prisma.Decimal | null {
  if (value instanceof Prisma.Decimal) {
    return value.isFinite() ? value : null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Prisma.Decimal(value.toString());
}

export function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

export function normalizeCurrencyCode(
  value: unknown,
  options: { defaultCode?: string } = {},
): string {
  if (
    (value === undefined || value === null || value === "") &&
    options.defaultCode
  ) {
    return options.defaultCode;
  }
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) throw badRequest("currency required");
  if (!CURRENCY_RE.test(raw)) throw badRequest("currency must be a 3-letter code");
  return raw;
}

function coerceDecimal(value: unknown, field: string): Prisma.Decimal {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw badRequest(`${field} must be a valid number`);
    if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      throw badRequest(`${field} is too large`);
    }
    return new Prisma.Decimal(value.toString());
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) throw badRequest(`${field} must be a valid number`);
    try {
      const decimal = new Prisma.Decimal(text);
      if (!decimal.isFinite()) throw badRequest(`${field} must be a valid number`);
      return decimal;
    } catch (error) {
      if (isBadRequest(error)) throw error;
      throw badRequest(`${field} must be a valid number`);
    }
  }
  throw badRequest(`${field} must be a valid number`);
}

function isBadRequest(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: number }).status === 400
  );
}
