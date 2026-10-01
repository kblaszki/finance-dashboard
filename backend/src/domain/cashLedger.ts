import { Prisma, type CashTransaction, type PrismaClient } from "@prisma/client";
import { badRequest } from "../lib/errors";
import { decimalToMinor, parsePositiveAmount } from "./money";

export { parsePositiveAmount };

export const CASH_TX_TYPES = ["INCOME", "EXPENSE"] as const;

export type CashTxType = (typeof CASH_TX_TYPES)[number];

const ALLOWED = new Set<string>(CASH_TX_TYPES);

type Db = PrismaClient | Prisma.TransactionClient;

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

/** INCOME → +amount, EXPENSE → −amount. Amount is a major-unit Decimal. */
export function signedDelta(type: CashTxType, amount: Prisma.Decimal): Prisma.Decimal {
  return type === "INCOME" ? amount : amount.negated();
}

export function signedMinor(type: CashTxType, amountMinor: number): number {
  return type === "INCOME" ? amountMinor : -amountMinor;
}

export type CashPostInput = {
  accountId: number;
  type: CashTxType;
  amount: Prisma.Decimal;
  occurredAt: Date;
  description: string | null;
  categoryId: number | null;
};

/** Insert one ledger row and apply its signed minor-unit delta to cashBalance. */
export async function postCashTransaction(
  db: Db,
  input: CashPostInput,
): Promise<CashTransaction> {
  const amountMinor = decimalToMinor(input.amount, "amount");
  const row = await db.cashTransaction.create({
    data: {
      accountId: input.accountId,
      type: input.type,
      amount: amountMinor,
      occurredAt: input.occurredAt,
      description: input.description,
      categoryId: input.categoryId,
    },
  });
  await db.account.update({
    where: { id: input.accountId },
    data: { cashBalance: { increment: signedMinor(input.type, amountMinor) } },
  });
  return row;
}

export async function postCashTransactionBatch(
  db: Db,
  accountId: number,
  rows: Array<Omit<CashPostInput, "accountId">>,
): Promise<number> {
  if (rows.length === 0) return 0;
  let totalMinor = 0;
  const data = rows.map((row) => {
    const amountMinor = decimalToMinor(row.amount, "amount");
    totalMinor += signedMinor(row.type, amountMinor);
    return {
      accountId,
      type: row.type,
      amount: amountMinor,
      occurredAt: row.occurredAt,
      description: row.description,
      categoryId: row.categoryId,
    };
  });
  await db.cashTransaction.createMany({ data });
  await db.account.update({
    where: { id: accountId },
    data: { cashBalance: { increment: totalMinor } },
  });
  return data.length;
}

/** Replace a stored row and apply the signed minor-unit difference to cashBalance. */
export async function updateCashTransaction(
  db: Db,
  accountId: number,
  existing: { id: number; type: string; amount: number },
  next: {
    type: CashTxType;
    amount: Prisma.Decimal;
    occurredAt: Date;
    description: string | null;
    categoryId: number | null;
  },
): Promise<CashTransaction> {
  const oldSigned = signedMinor(parseCashTxType(existing.type), existing.amount);
  const amountMinor = decimalToMinor(next.amount, "amount");
  const delta = signedMinor(next.type, amountMinor) - oldSigned;
  const row = await db.cashTransaction.update({
    where: { id: existing.id },
    data: {
      type: next.type,
      amount: amountMinor,
      occurredAt: next.occurredAt,
      description: next.description,
      categoryId: next.categoryId,
    },
  });
  if (delta !== 0) {
    await db.account.update({
      where: { id: accountId },
      data: { cashBalance: { increment: delta } },
    });
  }
  return row;
}

/** Remove a stored row and reverse its minor-unit effect on cashBalance. */
export async function reverseCashTransaction(
  db: Db,
  accountId: number,
  existing: { id: number; type: string; amount: number },
): Promise<void> {
  const type = parseCashTxType(existing.type);
  const reverse = -signedMinor(type, existing.amount);
  await db.account.update({
    where: { id: accountId },
    data: { cashBalance: { increment: reverse } },
  });
  await db.cashTransaction.delete({ where: { id: existing.id } });
}
