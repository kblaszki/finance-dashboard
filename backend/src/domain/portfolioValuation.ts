import { Prisma, type PrismaClient } from "@prisma/client";
import {
  getLatestValuationsByInstrumentIds,
  sourcePriority,
} from "./instrumentValuations";
import { formatYmdUtc } from "./fx";

type Db = PrismaClient | Prisma.TransactionClient;

export type TradeQtyRow = {
  accountId: number;
  instrumentId: number;
  side: string;
  quantity: Prisma.Decimal | number | string;
  occurredAt: Date;
};

export type ValuationCloseRow = {
  instrumentId: number;
  asOfDate: Date;
  close: Prisma.Decimal | number;
  source: string;
};

/** Open qty per account+instrument from BUY/SELL trades with occurredAt < exclusive. */
export function openQuantitiesAsOf(
  trades: TradeQtyRow[],
  asOfExclusive: Date,
): Map<string, Prisma.Decimal> {
  const out = new Map<string, Prisma.Decimal>();
  for (const trade of trades) {
    if (trade.occurredAt >= asOfExclusive) continue;
    const key = `${trade.accountId}:${trade.instrumentId}`;
    const qty = new Prisma.Decimal(trade.quantity);
    const side = String(trade.side).trim().toUpperCase();
    const prev = out.get(key) ?? new Prisma.Decimal(0);
    if (side === "BUY") out.set(key, prev.add(qty));
    else if (side === "SELL") out.set(key, prev.sub(qty));
  }
  return out;
}

/** Latest collapsed close per instrument with asOfDate < exclusive. */
export function closesAsOf(
  rows: ValuationCloseRow[],
  asOfExclusive: Date,
): Map<number, { asOf: string; close: number }> {
  const filtered = rows.filter((r) => r.asOfDate < asOfExclusive);
  const byInstrument = new Map<number, ValuationCloseRow[]>();
  for (const row of filtered) {
    const list = byInstrument.get(row.instrumentId) ?? [];
    list.push(row);
    byInstrument.set(row.instrumentId, list);
  }
  const out = new Map<number, { asOf: string; close: number }>();
  for (const [instrumentId, list] of byInstrument) {
    const picked = pickLatestCollapsedClose(list);
    if (picked) out.set(instrumentId, picked);
  }
  return out;
}

/**
 * Holdings MTM in account currency for each account as of exclusive bound
 * (trade occurredAt < exclusive; valuation asOfDate < exclusive).
 */
export function holdingsValuesAsOf(
  accountIds: number[],
  trades: TradeQtyRow[],
  valuations: ValuationCloseRow[],
  asOfExclusive: Date,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const id of accountIds) out.set(id, 0);

  const qtyMap = openQuantitiesAsOf(trades, asOfExclusive);
  const closeMap = closesAsOf(valuations, asOfExclusive);

  const totals = new Map<number, Prisma.Decimal>();
  for (const [key, qty] of qtyMap) {
    if (qty.lte(0)) continue;
    const [accountIdRaw, instrumentIdRaw] = key.split(":");
    const accountId = Number(accountIdRaw);
    const instrumentId = Number(instrumentIdRaw);
    const close = closeMap.get(instrumentId);
    if (!close) continue;
    const mv = qty
      .mul(close.close)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    totals.set(accountId, (totals.get(accountId) ?? new Prisma.Decimal(0)).add(mv));
  }
  for (const [accountId, total] of totals) {
    out.set(accountId, total.toDecimalPlaces(2).toNumber());
  }
  return out;
}

export type HoldingMtm = {
  holdingId: number;
  accountId: number;
  instrumentId: number;
  quantity: Prisma.Decimal;
  lastClose: number | null;
  lastCloseAsOf: string | null;
  marketValue: number | null;
  currency: string;
};

/**
 * Prefer the highest-priority source on the newest asOfDate among candidate rows.
 */
export function pickLatestCollapsedClose(
  rows: Array<{ asOfDate: Date; close: Prisma.Decimal | number; source: string }>,
): { asOf: string; close: number } | null {
  if (rows.length === 0) return null;
  let best: { asOf: string; close: number; priority: number; asOfMs: number } | null =
    null;
  for (const row of rows) {
    const asOf = formatYmdUtc(row.asOfDate);
    const close = Number(row.close);
    if (!Number.isFinite(close)) continue;
    const asOfMs = row.asOfDate.getTime();
    const priority = sourcePriority(row.source);
    if (
      !best ||
      asOfMs > best.asOfMs ||
      (asOfMs === best.asOfMs && priority > best.priority)
    ) {
      best = { asOf, close, priority, asOfMs };
    }
  }
  return best ? { asOf: best.asOf, close: best.close } : null;
}

/** MTM for holdings on one account (quote currency = instrument currency). */
export async function valueHoldingsForAccount(
  db: Db,
  accountId: number,
): Promise<{ holdings: HoldingMtm[]; holdingsValue: number }> {
  const holdings = await db.holding.findMany({
    where: { accountId, quantity: { gt: 0 } },
    include: { instrument: { select: { id: true, currency: true } } },
  });
  const ids = holdings.map((h) => h.instrumentId);
  const latestById = await getLatestValuationsByInstrumentIds(db, ids);

  // getLatestValuationsByInstrumentIds returns first row by asOfDate desc without
  // source collapse when multiple sources share the same day. Re-fetch candidates
  // for those instruments to collapse.
  const result: HoldingMtm[] = [];
  let total = new Prisma.Decimal(0);

  for (const h of holdings) {
    const qty = new Prisma.Decimal(h.quantity);
    const currency = h.instrument.currency;
    const candidates = await db.instrumentValuation.findMany({
      where: { instrumentId: h.instrumentId },
      orderBy: { asOfDate: "desc" },
      take: 8,
      select: { asOfDate: true, close: true, source: true },
    });
    const picked =
      pickLatestCollapsedClose(candidates) ??
      (latestById.get(h.instrumentId)
        ? {
            asOf: formatYmdUtc(latestById.get(h.instrumentId)!.asOfDate),
            close: Number(latestById.get(h.instrumentId)!.close),
          }
        : null);

    const marketValue =
      picked != null
        ? qty.mul(picked.close).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        : null;
    if (marketValue) total = total.add(marketValue);

    result.push({
      holdingId: h.id,
      accountId: h.accountId,
      instrumentId: h.instrumentId,
      quantity: qty,
      lastClose: picked?.close ?? null,
      lastCloseAsOf: picked?.asOf ?? null,
      marketValue: marketValue?.toNumber() ?? null,
      currency,
    });
  }

  return {
    holdings: result,
    holdingsValue: total.toDecimalPlaces(2).toNumber(),
  };
}

/** Sum MTM across many accounts (account currency; caller converts FX). */
export async function holdingsValueByAccountIds(
  db: Db,
  accountIds: number[],
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  for (const id of accountIds) {
    out.set(id, 0);
  }
  if (accountIds.length === 0) return out;

  const holdings = await db.holding.findMany({
    where: { accountId: { in: accountIds }, quantity: { gt: 0 } },
  });
  if (holdings.length === 0) return out;

  const byAccount = new Map<number, typeof holdings>();
  for (const h of holdings) {
    const list = byAccount.get(h.accountId) ?? [];
    list.push(h);
    byAccount.set(h.accountId, list);
  }

  for (const [accountId, list] of byAccount) {
    let total = new Prisma.Decimal(0);
    for (const h of list) {
      const candidates = await db.instrumentValuation.findMany({
        where: { instrumentId: h.instrumentId },
        orderBy: { asOfDate: "desc" },
        take: 8,
        select: { asOfDate: true, close: true, source: true },
      });
      const picked = pickLatestCollapsedClose(candidates);
      if (!picked) continue;
      total = total.add(
        new Prisma.Decimal(h.quantity)
          .mul(picked.close)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
      );
    }
    out.set(accountId, total.toDecimalPlaces(2).toNumber());
  }
  return out;
}
