import type { Prisma, PrismaClient } from "@prisma/client";
type DbClient = PrismaClient | Prisma.TransactionClient;

import { convertAmount } from "./fx";
import { priceAsOf } from "./holdingLot";
import {
  computeBalanceAfter,
  isValidTransactionType,
  type TransactionType,
} from "./transactionBalance";

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (v && typeof v === "object") {
    const anyV = v as { toNumber?: () => number; toString?: () => string };
    if (typeof anyV.toNumber === "function") return anyV.toNumber();
    if (typeof anyV.toString === "function") return Number(anyV.toString());
  }
  return Number(v);
}

function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export type CashReplayTx = {
  kind: "tx";
  at: Date;
  id: number;
  transactionType: TransactionType;
  amount: number;
};

export type CashReplayLot = {
  kind: "lot";
  at: Date;
  id: number;
  side: "BUY" | "SELL";
  totalPrice: number;
};

export type CashReplayEvent = CashReplayTx | CashReplayLot;

export function replayCashBalance(
  openingBalance: number,
  events: CashReplayEvent[],
  asOf: Date,
): number {
  const asOfMs = asOf.getTime();
  const sorted = [...events]
    .filter((e) => e.at.getTime() <= asOfMs)
    .sort((a, b) => {
      const t = a.at.getTime() - b.at.getTime();
      if (t !== 0) return t;
      const kindOrder = (e: CashReplayEvent) => (e.kind === "tx" ? 0 : 1);
      const k = kindOrder(a) - kindOrder(b);
      if (k !== 0) return k;
      return a.id - b.id;
    });

  let cash = openingBalance;
  for (const e of sorted) {
    if (e.kind === "tx") {
      if (!isValidTransactionType(e.transactionType)) continue;
      cash = computeBalanceAfter(cash, e.transactionType, e.amount, true);
    } else if (e.side === "BUY") {
      cash -= e.totalPrice;
    } else {
      cash += e.totalPrice;
    }
  }
  return cash;
}

export async function computeCashAsOf(
  prisma: DbClient,
  accountId: number,
  asOf: Date,
): Promise<number> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return 0;

  const [txs, lots] = await Promise.all([
    prisma.transaction.findMany({
      where: { accountId, date: { lte: asOf } },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.holdingLot.findMany({
      where: { holding: { accountId }, tradeDate: { lte: asOf } },
      orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
    }),
  ]);

  const events: CashReplayEvent[] = [
    ...txs.map((t) => ({
      kind: "tx" as const,
      at: t.date,
      id: t.id,
      transactionType: t.transactionType as TransactionType,
      amount: toNumber(t.amount),
    })),
    ...lots.map((l) => ({
      kind: "lot" as const,
      at: l.tradeDate,
      id: l.id,
      side: l.side as "BUY" | "SELL",
      totalPrice: toNumber(l.totalPrice ?? 0),
    })),
  ];

  return replayCashBalance(toNumber(account.openingBalance), events, asOf);
}

type PreloadedLot = {
  id: number;
  instrumentId: number;
  quantityAfter: number;
  tradeDate: Date;
};

function netQuantityAsOfFromPreloaded(
  lots: PreloadedLot[],
  instrumentId: number,
  asOf: Date,
): number {
  let best: PreloadedLot | null = null;
  for (const lot of lots) {
    if (lot.instrumentId !== instrumentId) continue;
    if (lot.tradeDate.getTime() > asOf.getTime()) continue;
    if (
      !best ||
      lot.tradeDate.getTime() > best.tradeDate.getTime() ||
      (lot.tradeDate.getTime() === best.tradeDate.getTime() && lot.id > best.id)
    ) {
      best = lot;
    }
  }
  return best ? toNumber(best.quantityAfter) : 0;
}

type ValuationPoint = { valuationDate: Date; price: number };

function groupValuationsByInstrument(
  rows: Array<{ instrumentId: number; valuationDate: Date; price: unknown }>,
): Map<number, ValuationPoint[]> {
  const map = new Map<number, ValuationPoint[]>();
  for (const row of rows) {
    const points = map.get(row.instrumentId) ?? [];
    points.push({ valuationDate: row.valuationDate, price: toNumber(row.price) });
    map.set(row.instrumentId, points);
  }
  for (const points of map.values()) {
    points.sort((a, b) => a.valuationDate.getTime() - b.valuationDate.getTime());
  }
  return map;
}

export async function recomputeAccountValuationsFrom(
  prisma: DbClient,
  accountId: number,
  fromDate: Date,
  plnPerUnit: Record<string, number>,
): Promise<void> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return;

  const from = utcDateOnly(fromDate);
  await prisma.accountValuationDaily.deleteMany({
    where: { accountId, valuationDate: { gte: from } },
  });
  await prisma.holdingValuationDaily.deleteMany({
    where: { accountId, valuationDate: { gte: from } },
  });

  const dates = new Set<string>();
  const pushDate = (d: Date) => dates.add(utcDateOnly(d).toISOString());

  const txs = await prisma.transaction.findMany({
    where: { accountId, date: { gte: from } },
  });
  for (const t of txs) pushDate(t.date);

  const lots = await prisma.holdingLot.findMany({
    where: { holding: { accountId }, tradeDate: { gte: from } },
  });
  for (const l of lots) pushDate(l.tradeDate);

  const instrumentIds = (
    await prisma.holding.findMany({
      where: { accountId },
      select: { instrumentId: true },
    })
  ).map((r) => r.instrumentId);

  for (const instrumentId of instrumentIds) {
    const valuations = await prisma.instrumentValuation.findMany({
      where: { instrumentId, valuationDate: { gte: from } },
    });
    for (const v of valuations) pushDate(v.valuationDate);
  }

  if (!dates.size) {
    pushDate(from);
  }

  const sorted = [...dates].map((s) => new Date(s)).sort((a, b) => a.getTime() - b.getTime());
  const displayCurrency = account.currency;
  const openingBalance = toNumber(account.openingBalance);

  const [holdings, allTxs, allLots, allInstrumentValuations] = await Promise.all([
    prisma.holding.findMany({
      where: { accountId },
      include: { instrument: true },
    }),
    prisma.transaction.findMany({
      where: { accountId },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.holdingLot.findMany({
      where: { holding: { accountId } },
      include: { holding: { select: { instrumentId: true } } },
      orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
    }),
    instrumentIds.length
      ? prisma.instrumentValuation.findMany({
          where: { instrumentId: { in: instrumentIds } },
          orderBy: { valuationDate: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const cashEvents: CashReplayEvent[] = [
    ...allTxs.map((t) => ({
      kind: "tx" as const,
      at: t.date,
      id: t.id,
      transactionType: t.transactionType as TransactionType,
      amount: toNumber(t.amount),
    })),
    ...allLots.map((l) => ({
      kind: "lot" as const,
      at: l.tradeDate,
      id: l.id,
      side: l.side as "BUY" | "SELL",
      totalPrice: toNumber(l.totalPrice ?? 0),
    })),
  ];
  const preloadedLots: PreloadedLot[] = allLots.map((lot) => ({
    id: lot.id,
    instrumentId: lot.holding.instrumentId,
    quantityAfter: toNumber(lot.quantityAfter),
    tradeDate: lot.tradeDate,
  }));
  const valuationsByInstrument = groupValuationsByInstrument(allInstrumentValuations);
  const heldInstrumentIds = holdings.map((holding) => holding.instrumentId);
  const instrumentsById = new Map(holdings.map((holding) => [holding.instrumentId, holding.instrument]));

  for (const day of sorted) {
    const end = new Date(day);
    end.setUTCHours(23, 59, 59, 999);

    const cashValue = replayCashBalance(openingBalance, cashEvents, end);
    let securitiesValue = 0;

    for (const instrumentId of heldInstrumentIds) {
      const qty = netQuantityAsOfFromPreloaded(preloadedLots, instrumentId, end);
      if (qty <= 0) continue;

      const instrument = instrumentsById.get(instrumentId);
      if (!instrument) continue;

      const rawPrice = priceAsOf(valuationsByInstrument.get(instrumentId) ?? [], end);
      let marketValue = 0;
      if (rawPrice != null) {
        const inInstrumentCcy = qty * rawPrice;
        marketValue = convertAmount(inInstrumentCcy, instrument.currency, displayCurrency, plnPerUnit);
      }

      securitiesValue += marketValue;

      await prisma.holdingValuationDaily.upsert({
        where: {
          accountId_instrumentId_valuationDate: {
            accountId,
            instrumentId,
            valuationDate: day,
          },
        },
        create: {
          accountId,
          instrumentId,
          valuationDate: day,
          quantity: qty,
          marketValue,
          currency: displayCurrency,
        },
        update: { quantity: qty, marketValue },
      });
    }

    const totalValue = cashValue + securitiesValue;
    await prisma.accountValuationDaily.upsert({
      where: { accountId_valuationDate: { accountId, valuationDate: day } },
      create: {
        accountId,
        valuationDate: day,
        totalValue,
        cashValue,
        securitiesValue,
        currency: displayCurrency,
      },
      update: { totalValue, cashValue, securitiesValue },
    });
  }
}

export async function backfillAccountValuations(
  prisma: DbClient,
  accountId: number,
  plnPerUnit: Record<string, number>,
): Promise<void> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return;
  await recomputeAccountValuationsFrom(prisma, accountId, account.createdAt, plnPerUnit);
}

export async function getLatestAccountTotalValue(
  prisma: DbClient,
  accountId: number,
): Promise<number | null> {
  const values = await getLatestAccountTotalValues(prisma, [accountId]);
  return values.get(accountId) ?? null;
}

export async function getLatestAccountTotalValues(
  prisma: DbClient,
  accountIds: number[],
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (!accountIds.length) return result;

  const rows = await prisma.accountValuationDaily.findMany({
    where: { accountId: { in: accountIds } },
    orderBy: [{ accountId: "asc" }, { valuationDate: "desc" }],
  });
  for (const row of rows) {
    if (!result.has(row.accountId)) {
      result.set(row.accountId, toNumber(row.totalValue));
    }
  }
  return result;
}

export { utcDateOnly, toNumber };
