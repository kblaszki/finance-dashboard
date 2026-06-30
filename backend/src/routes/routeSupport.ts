import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import { toNumber } from "../accountValuation";
import { buildHoldingSummary } from "../holdings";
import { badRequest } from "./httpSupport";

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
  if (Number.isNaN(d.getTime())) throw badRequest("Invalid date");
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

export function serializeAccount(
  a: {
    id: number;
    userId: number;
    accountType: string;
    name: string;
    currency: string;
    cashBalance: unknown;
    openingBalance: unknown;
    openingCashAsOf: Date | null;
    metalGrams?: unknown | null;
    taxWrapperType?: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  totalBalance?: number,
) {
  return {
    id: a.id,
    accountType: a.accountType,
    name: a.name,
    currency: a.currency,
    cashBalance: toNumber(a.cashBalance),
    totalBalance: totalBalance ?? toNumber(a.cashBalance),
    openingBalance: toNumber(a.openingBalance),
    openingCashAsOf: a.openingCashAsOf?.toISOString() ?? null,
    metalGrams: a.metalGrams != null ? toNumber(a.metalGrams) : null,
    taxWrapperType: a.taxWrapperType ?? "standard",
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
  categoryId?: number | null;
  date: Date;
  description: string | null;
  splits?: Array<{
    id: number;
    categoryId: number;
    amount: unknown;
    category?: { name: string };
  }>;
}) {
  return {
    id: t.id,
    accountId: t.accountId,
    transactionType: t.transactionType,
    amount: toNumber(t.amount),
    balanceAfter: toNumber(t.balanceAfter),
    currency: t.currency,
    category: t.category,
    categoryId: t.categoryId ?? null,
    date: t.date.toISOString(),
    description: t.description,
    splits: (t.splits ?? []).map((s) => ({
      id: s.id,
      categoryId: s.categoryId,
      categoryName: s.category?.name ?? null,
      amount: toNumber(s.amount),
    })),
  };
}

export function serializeHoldingLot(l: {
  id: number;
  holdingId: number;
  side: string;
  quantity: unknown;
  quantityAfter: unknown;
  totalPrice: unknown | null;
  commission?: unknown | null;
  pricePerUnit: unknown | null;
  currency: string;
  tradeDate: Date;
  settlementDate?: Date | null;
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
    account?: {
      id: number;
      name: string;
      currency: string;
    };
  };
}) {
  return {
    id: l.id,
    holdingId: l.holdingId,
    accountId: l.holding?.accountId,
    accountName: l.holding?.account?.name,
    instrumentId: l.holding?.instrumentId,
    side: l.side,
    quantity: toNumber(l.quantity),
    quantityAfter: toNumber(l.quantityAfter),
    totalPrice: l.totalPrice != null ? toNumber(l.totalPrice) : null,
    commission: toNumber(l.commission ?? 0),
    pricePerUnit: l.pricePerUnit != null ? toNumber(l.pricePerUnit) : null,
    currency: l.currency,
    tradeDate: l.tradeDate.toISOString(),
    settlementDate: l.settlementDate?.toISOString() ?? null,
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

export function serializeInstrument(i: {
  id: number;
  instrumentType: string;
  symbol: string;
  name: string | null;
  exchange: string | null;
  currency: string;
  pitZgCountry?: string | null;
  source: string;
  createdAt: Date;
}) {
  return {
    id: i.id,
    instrumentType: i.instrumentType,
    symbol: i.symbol,
    name: i.name,
    exchange: i.exchange,
    currency: i.currency,
    pitZgCountry: i.pitZgCountry ?? "PL",
    source: i.source,
    createdAt: i.createdAt.toISOString(),
  };
}

export function serializeInstrumentValuation(r: {
  id: number;
  instrumentId: number;
  valuationDate: Date;
  price: unknown;
  currency: string;
  source: string;
}) {
  return {
    id: r.id,
    instrumentId: r.instrumentId,
    valuationDate: r.valuationDate.toISOString(),
    price: toNumber(r.price),
    currency: r.currency,
    source: r.source,
  };
}

export async function getAccountForUser(
  db: DbClient,
  userId: number,
  accountId: number,
) {
  return db.account.findFirst({ where: { id: accountId, userId } });
}
