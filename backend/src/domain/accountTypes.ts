import { badRequest } from "../lib/errors";

export const ACCOUNT_TYPES = [
  "BANK",
  "BROKERAGE",
  "CRYPTO",
  "PRECIOUS_METAL",
  "REAL_ESTATE",
  "OTHER",
  "MANUAL",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

const ALLOWED = new Set<string>(ACCOUNT_TYPES);

/** Omit / null / whitespace → BANK. Non-empty: trim + upper; reject unknown. */
export function parseAccountType(value: unknown): AccountType {
  if (value === undefined || value === null) return "BANK";
  const raw = String(value).trim().toUpperCase();
  if (!raw) return "BANK";
  if (!ALLOWED.has(raw)) {
    throw badRequest(
      `accountType must be one of: ${ACCOUNT_TYPES.join(", ")}`,
    );
  }
  return raw as AccountType;
}
