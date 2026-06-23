export type TransactionType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "DIVIDEND"
  | "INTEREST";

const CREDIT_TYPES = new Set<TransactionType>([
  "INCOME",
  "TRANSFER_IN",
  "DIVIDEND",
  "INTEREST",
]);
const DEBIT_TYPES = new Set<TransactionType>(["EXPENSE", "TRANSFER_OUT"]);

export function validateTransactionForAccount(
  transactionType: TransactionType,
  accountType: string,
): string | null {
  if (transactionType === "DIVIDEND" && accountType !== "BROKERAGE") {
    return "Dividends are only allowed on brokerage accounts";
  }
  if (
    transactionType === "INTEREST" &&
    accountType !== "BROKERAGE" &&
    accountType !== "BANK"
  ) {
    return "Interest is only allowed on bank or brokerage accounts";
  }
  return null;
}

export function isValidTransactionType(type: string): type is TransactionType {
  return CREDIT_TYPES.has(type as TransactionType) || DEBIT_TYPES.has(type as TransactionType);
}

export function computeBalanceAfter(
  previousCash: number,
  transactionType: TransactionType,
  amount: number,
  allowOverdraft = false,
): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number");
  }
  const delta = CREDIT_TYPES.has(transactionType) ? amount : -amount;
  const next = previousCash + delta;
  if (!allowOverdraft && next < 0) {
    throw new Error("Insufficient cash balance");
  }
  return next;
}

export function cashDelta(transactionType: TransactionType, amount: number): number {
  return CREDIT_TYPES.has(transactionType) ? amount : -amount;
}
