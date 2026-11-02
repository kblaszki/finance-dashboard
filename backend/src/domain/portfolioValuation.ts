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
  symbol: string;
  name: string;
  quantity: Prisma.Decimal;
  lastClose: number | null;
  lastCloseAsOf: string | null;
  marketValue: number | null;
  /** Open-lot cost: Σ qtyOpen×unitCost + remaining commissionOpen. */
  costBasis: number;
  /** costBasis / quantity when quantity > 0. */
  averageCost: number | null;
  /** marketValue − costBasis when a quote exists; else null. */
  unrealizedPnl: number | null;
  currency: string;
};

export type OpenLotCostRow = {
  quantityOpen: Prisma.Decimal | number | string;
  unitCost: Prisma.Decimal | number | string;
  commissionOpen: Prisma.Decimal | number | string;
};

/** FIFO open-lot cost basis including remaining open commission. */
export function costBasisFromOpenLots(lots: OpenLotCostRow[]): Prisma.Decimal {
  let total = new Prisma.Decimal(0);
  for (const lot of lots) {
    const qty = new Prisma.Decimal(lot.quantityOpen);
    if (qty.lte(0)) continue;
    total = total
      .add(qty.mul(lot.unitCost))
      .add(new Prisma.Decimal(lot.commissionOpen));
  }
  return total;
}

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

/**
 * One batched valuation read for many instruments via SQL latest-per-id
 * (source priority already applied in getLatestValuationsByInstrumentIds).
 */
async function latestCollapsedClosesByInstrumentIds(
  db: Db,
  instrumentIds: number[],
): Promise<Map<number, { asOf: string; close: number }>> {
  const out = new Map<number, { asOf: string; close: number }>();
  const latestById = await getLatestValuationsByInstrumentIds(db, instrumentIds);
  for (const [id, row] of latestById) {
    out.set(id, {
      asOf: formatYmdUtc(row.asOfDate),
      close: Number(row.close),
    });
  }
  return out;
}

/** MTM for holdings on one account (quote currency = instrument currency). */
export async function valueHoldingsForAccount(
  db: Db,
  accountId: number,
): Promise<{ holdings: HoldingMtm[]; holdingsValue: number }> {
  const holdings = await db.holding.findMany({
    where: { accountId, quantity: { gt: 0 } },
    include: {
      instrument: {
        select: { id: true, currency: true, symbol: true, name: true },
      },
      lots: {
        where: { quantityOpen: { gt: 0 } },
        select: {
          quantityOpen: true,
          unitCost: true,
          commissionOpen: true,
        },
      },
    },
  });
  const closeById = await latestCollapsedClosesByInstrumentIds(
    db,
    holdings.map((h) => h.instrumentId),
  );

  const result: HoldingMtm[] = [];
  let total = new Prisma.Decimal(0);

  for (const h of holdings) {
    const qty = new Prisma.Decimal(h.quantity);
    const currency = h.instrument.currency;
    const picked = closeById.get(h.instrumentId) ?? null;

    const marketValue =
      picked != null
        ? qty.mul(picked.close).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        : null;
    if (marketValue) total = total.add(marketValue);

    const costBasis = costBasisFromOpenLots(h.lots).toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
    );
    const averageCost = qty.gt(0)
      ? costBasis.div(qty).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP)
      : null;
    const unrealizedPnl =
      marketValue != null
        ? marketValue.sub(costBasis).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        : null;

    result.push({
      holdingId: h.id,
      accountId: h.accountId,
      instrumentId: h.instrumentId,
      symbol: h.instrument.symbol,
      name: h.instrument.name,
      quantity: qty,
      lastClose: picked?.close ?? null,
      lastCloseAsOf: picked?.asOf ?? null,
      marketValue: marketValue?.toNumber() ?? null,
      costBasis: costBasis.toNumber(),
      averageCost: averageCost?.toNumber() ?? null,
      unrealizedPnl: unrealizedPnl?.toNumber() ?? null,
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

  const closeById = await latestCollapsedClosesByInstrumentIds(
    db,
    holdings.map((h) => h.instrumentId),
  );

  const totals = new Map<number, Prisma.Decimal>();
  for (const h of holdings) {
    const picked = closeById.get(h.instrumentId);
    if (!picked) continue;
    const mv = new Prisma.Decimal(h.quantity)
      .mul(picked.close)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    totals.set(
      h.accountId,
      (totals.get(h.accountId) ?? new Prisma.Decimal(0)).add(mv),
    );
  }
  for (const [accountId, total] of totals) {
    out.set(accountId, total.toDecimalPlaces(2).toNumber());
  }
  return out;
}
