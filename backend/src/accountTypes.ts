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

/** Legacy alias — MANUAL maps to OTHER in spec; kept for existing rows. */
export const HOLDINGS_ACCOUNT_TYPES = new Set<AccountType>(["BROKERAGE", "CRYPTO", "PRECIOUS_METAL"]);

export const REVALUE_ACCOUNT_TYPES = new Set<AccountType>(["MANUAL", "REAL_ESTATE", "OTHER"]);

export const CASH_BALANCE_ACCOUNT_TYPES = new Set<AccountType>([
  "BANK",
  "BROKERAGE",
  "CRYPTO",
  "PRECIOUS_METAL",
]);

export function isValidAccountType(value: string): value is AccountType {
  return (ACCOUNT_TYPES as readonly string[]).includes(value);
}

export function isHoldingsAccountType(accountType: string): boolean {
  return HOLDINGS_ACCOUNT_TYPES.has(accountType as AccountType);
}

export function isRevalueAccountType(accountType: string): boolean {
  return REVALUE_ACCOUNT_TYPES.has(accountType as AccountType);
}
