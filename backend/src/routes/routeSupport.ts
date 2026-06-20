import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import { computeCashAsOf, toNumber } from "../accountValuation";
import { buildHoldingSummary } from "../holdings";
import { computeBalanceAfter, isValidTransactionType, type TransactionType } from "../transactionBalance";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export type TransactionDateFilter = (
  from?: unknown,
  to?: unknown,
) => { gte?: Date; lte?: Date } | undefined;

export function uid(req: AuthedRequest): number {
  return req.userId!;
}

export function parseDateBody(value: unknown): Date {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

function parseDateQuery(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function transactionDateFilter(
  from?: unknown,
  to?: unknown,
): { gte?: Date; lte?: Date } | undefined {
  const fromDate = parseDateQuery(from);
  const toDate = parseDateQuery(to);
  if (!fromDate && !toDate) return undefined;
  const date: { gte?: Date; lte?: Date } = {};
  if (fromDate) {
    const gte = new Date(fromDate);
    gte.setHours(0, 0, 0, 0);
    date.gte = gte;
  }
  if (toDate) {
    const lte = new Date(toDate);
    lte.setHours(23, 59, 59, 999);
    date.lte = lte;
  }
  return date;
}

export function serializeAccount(a: {
  id: number;
  userId: number;
  accountType: string;
  name: string;
  currency: string;
  cashBalance: unknown;
  openingBalance: unknown;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: a.id,
    accountType: a.accountType,
    name: a.name,
    currency: a.currency,
    cashBalance: toNumber(a.cashBalance),
    openingBalance: toNumber(a.openingBalance),
    description: a.description,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export function serializeTransaction(t: {
  id: number;
  accountId: number;
  transactionType: string;
  amount: unknown;
  balanceAfter: unknown;
  currency: string;
  category: string;
  date: Date;
  description: string | null;
}) {
  return {
    id: t.id,
    accountId: t.accountId,
    transactionType: t.transactionType,
    amount: toNumber(t.amount),
    balanceAfter: toNumber(t.balanceAfter),
    currency: t.currency,
    category: t.category,
    date: t.date.toISOString(),
    description: t.description,
  };
}

export function serializeHoldingLot(l: {
  id: number;
  holdingId: number;
  side: string;
  quantity: unknown;
  quantityAfter: unknown;
  totalPrice: unknown | null;
  pricePerUnit: unknown | null;
  currency: string;
  tradeDate: Date;
  createdAt: Date;
  holding?: {
    id: number;
    accountId: number;
    instrumentId: number;
    instrument?: {
      id: number;
      symbol: string;
      name: string | null;
      instrumentType: string;
      exchange: string | null;
      currency: string;
    };
  };
}) {
  return {
    id: l.id,
    holdingId: l.holdingId,
    accountId: l.holding?.accountId,
    instrumentId: l.holding?.instrumentId,
    side: l.side,
    quantity: toNumber(l.quantity),
    quantityAfter: toNumber(l.quantityAfter),
    totalPrice: l.totalPrice != null ? toNumber(l.totalPrice) : null,
    pricePerUnit: l.pricePerUnit != null ? toNumber(l.pricePerUnit) : null,
    currency: l.currency,
    tradeDate: l.tradeDate.toISOString(),
    createdAt: l.createdAt.toISOString(),
    instrument: l.holding?.instrument
      ? {
          id: l.holding.instrument.id,
          symbol: l.holding.instrument.symbol,
          name: l.holding.instrument.name,
          instrumentType: l.holding.instrument.instrumentType,
          exchange: l.holding.instrument.exchange,
          currency: l.holding.instrument.currency,
        }
      : undefined,
  };
}

export function serializeHoldingSummary(summary: Awaited<ReturnType<typeof buildHoldingSummary>>) {
  return summary;
}

export async function getAccountForUser(
  db: DbClient,
  userId: number,
  accountId: number,
) {
  return db.account.findFirst({ where: { id: accountId, userId } });
}

export async function recalcTransactionBalances(
  db: DbClient,
  accountId: number,
  fromDate?: Date,
): Promise<void> {
  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account) return;

  const txs = await db.transaction.findMany({
    where: fromDate ? { accountId, date: { gte: fromDate } } : { accountId },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  let running = toNumber(account.openingBalance);
  if (fromDate) {
    const prior = await db.transaction.findFirst({
      where: { accountId, date: { lt: fromDate } },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
    if (prior) running = toNumber(prior.balanceAfter);
  }

  for (const tx of txs) {
    if (!isValidTransactionType(tx.transactionType)) continue;
    running = computeBalanceAfter(running, tx.transactionType as TransactionType, toNumber(tx.amount));
    await db.transaction.update({
      where: { id: tx.id },
      data: { balanceAfter: running },
    });
  }
  await db.account.update({ where: { id: accountId }, data: { cashBalance: running } });
}

export async function syncBrokerageCashBalance(db: DbClient, accountId: number): Promise<number> {
  const cashBalance = await computeCashAsOf(db, accountId, new Date());
  await db.account.update({ where: { id: accountId }, data: { cashBalance } });
  return cashBalance;
}
