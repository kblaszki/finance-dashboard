export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER_IN" | "TRANSFER_OUT";

const CREDIT_TYPES = new Set<TransactionType>(["INCOME", "TRANSFER_IN"]);
const DEBIT_TYPES = new Set<TransactionType>(["EXPENSE", "TRANSFER_OUT"]);

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
