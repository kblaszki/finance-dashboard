import type { PrismaClient } from "@prisma/client";
import { toNumber } from "./accountValuation";
import { BENCHMARKS, type BenchmarkId } from "./benchmarks";
import { convertAmount } from "./fx";
import { priceAsOf } from "./holdingLot";
import { getAccountHoldings } from "./holdings";

export type AllocationRow = {
  type: string;
  value: number;
  pct: number;
};

export type PortfolioSummary = {
  asOf: string;
  displayCurrency: string;
  totalValue: number;
  cashValue: number;
  securitiesValue: number;
  unrealizedPnl: number | null;
  realizedPnlClosed: number;
  returnPct: number | null;
  allocation: AllocationRow[];
};

export type PortfolioHistoryPoint = {
  date: string;
  totalValue: number;
  cashValue: number;
  securitiesValue: number;
};

export type BenchmarkComparison = {
  benchmark: BenchmarkId;
  benchmarkLabel: string;
  portfolioReturnPct: number | null;
  benchmarkReturnPct: number | null;
  displayCurrency: string;
};

/** Simple money-weighted return (not TWR). Returns percentage, e.g. 5.25 for +5.25%. */
export function computeSimpleReturnPct(
  startValue: number,
  endValue: number,
  netContributions: number,
): number | null {
  const base = startValue + netContributions;
  if (!Number.isFinite(base) || base <= 0) return null;
  return ((endValue - startValue - netContributions) / base) * 100;
}

function utcEndOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeOpenCostBasis(
  lots: Array<{ side: string; totalPrice: unknown | null; currency: string }>,
  accountCurrency: string,
  plnPerUnit: Record<string, number>,
): number {
  let buyTotal = 0;
  let sellTotal = 0;
  for (const lot of lots) {
    const amount = convertAmount(
      toNumber(lot.totalPrice ?? 0),
      lot.currency,
      accountCurrency,
      plnPerUnit,
    );
    if (lot.side === "BUY") buyTotal += amount;
    else if (lot.side === "SELL") sellTotal += amount;
  }
  return buyTotal - sellTotal;
}

async function getBrokerageAccounts(prisma: PrismaClient, userId: number) {
  return prisma.account.findMany({
    where: { userId, accountType: "BROKERAGE" },
    orderBy: { id: "asc" },
  });
}

async function getValuationSnapshotAsOf(
  prisma: PrismaClient,
  accountId: number,
  asOf: Date,
): Promise<{ totalValue: number; cashValue: number; securitiesValue: number; currency: string; valuationDate: Date } | null> {
  const row = await prisma.accountValuationDaily.findFirst({
    where: { accountId, valuationDate: { lte: asOf } },
    orderBy: { valuationDate: "desc" },
  });
  if (!row) return null;
  return {
    totalValue: toNumber(row.totalValue),
    cashValue: toNumber(row.cashValue),
    securitiesValue: toNumber(row.securitiesValue),
    currency: row.currency,
    valuationDate: row.valuationDate,
  };
}

async function sumBrokerageSnapshotAsOf(
  prisma: PrismaClient,
  accountIds: number[],
  accounts: Array<{ id: number; currency: string }>,
  asOf: Date,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): Promise<{ totalValue: number; cashValue: number; securitiesValue: number; asOf: Date | null }> {
  let totalValue = 0;
  let cashValue = 0;
  let securitiesValue = 0;
  let latestAsOf: Date | null = null;

  for (const account of accounts) {
    if (!accountIds.includes(account.id)) continue;
    const snap = await getValuationSnapshotAsOf(prisma, account.id, asOf);
    if (!snap) continue;
    totalValue += convertAmount(snap.totalValue, snap.currency, displayCurrency, plnPerUnit);
    cashValue += convertAmount(snap.cashValue, snap.currency, displayCurrency, plnPerUnit);
    securitiesValue += convertAmount(
      snap.securitiesValue,
      snap.currency,
      displayCurrency,
      plnPerUnit,
    );
    if (!latestAsOf || snap.valuationDate.getTime() > latestAsOf.getTime()) {
      latestAsOf = snap.valuationDate;
    }
  }

  return { totalValue, cashValue, securitiesValue, asOf: latestAsOf };
}

async function computeNetExternalContributions(
  prisma: PrismaClient,
  accountIds: number[],
  from: Date,
  to: Date,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): Promise<number> {
  if (!accountIds.length) return 0;

  const txs = await prisma.transaction.findMany({
    where: {
      accountId: { in: accountIds },
      date: { gte: from, lte: to },
      transactionType: { in: ["TRANSFER_IN", "TRANSFER_OUT"] },
    },
  });

  let net = 0;
  for (const tx of txs) {
    const amount = convertAmount(toNumber(tx.amount), tx.currency, displayCurrency, plnPerUnit);
    if (tx.transactionType === "TRANSFER_IN") net += amount;
    else net -= amount;
  }
  return net;
}

function buildAllocation(
  typeValues: Map<string, number>,
  cashValue: number,
): AllocationRow[] {
  const rows: AllocationRow[] = [];
  let total = cashValue;
  for (const value of typeValues.values()) total += value;

  if (total <= 0) return [];

  if (cashValue > 0) {
    rows.push({ type: "CASH", value: cashValue, pct: (cashValue / total) * 100 });
  }
  for (const [type, value] of [...typeValues.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (value <= 0) continue;
    rows.push({ type, value, pct: (value / total) * 100 });
  }
  return rows;
}

export async function computePortfolioSummary(
  prisma: PrismaClient,
  userId: number,
  from: Date,
  to: Date,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): Promise<PortfolioSummary> {
  const accounts = await getBrokerageAccounts(prisma, userId);
  const accountIds = accounts.map((a) => a.id);
  const fromEnd = utcEndOfDay(from);
  const toEnd = utcEndOfDay(to);

  const start = await sumBrokerageSnapshotAsOf(
    prisma,
    accountIds,
    accounts,
    fromEnd,
    displayCurrency,
    plnPerUnit,
  );
  const end = await sumBrokerageSnapshotAsOf(
    prisma,
    accountIds,
    accounts,
    toEnd,
    displayCurrency,
    plnPerUnit,
  );

  const netContributions = await computeNetExternalContributions(
    prisma,
    accountIds,
    from,
    toEnd,
    displayCurrency,
    plnPerUnit,
  );

  const returnPct = computeSimpleReturnPct(start.totalValue, end.totalValue, netContributions);

  let unrealizedPnl: number | null = null;
  let realizedPnlClosed = 0;
  const typeValues = new Map<string, number>();

  for (const account of accounts) {
    const holdings = await getAccountHoldings(prisma, account.id, account.currency, plnPerUnit);

    for (const holding of holdings.open) {
      if (holding.marketValue == null) continue;
      const mvDisplay = convertAmount(
        holding.marketValue,
        account.currency,
        displayCurrency,
        plnPerUnit,
      );
      const type = holding.instrument.instrumentType || "OTHER";
      typeValues.set(type, (typeValues.get(type) ?? 0) + mvDisplay);

      const row = await prisma.holding.findUnique({
        where: { id: holding.id },
        include: { lots: true },
      });
      if (!row) continue;
      const costBasis = computeOpenCostBasis(row.lots, account.currency, plnPerUnit);
      const unrealizedNative = holding.marketValue - costBasis;
      const unrealizedDisplay = convertAmount(
        unrealizedNative,
        account.currency,
        displayCurrency,
        plnPerUnit,
      );
      unrealizedPnl = (unrealizedPnl ?? 0) + unrealizedDisplay;
    }

    for (const holding of holdings.closed) {
      if (holding.realizedPnl == null || !holding.lastTradeDate) continue;
      const closedAt = new Date(holding.lastTradeDate);
      if (closedAt.getTime() < from.getTime() || closedAt.getTime() > toEnd.getTime()) continue;
      realizedPnlClosed += convertAmount(
        holding.realizedPnl,
        account.currency,
        displayCurrency,
        plnPerUnit,
      );
    }
  }

  const allocation = buildAllocation(typeValues, end.cashValue);

  return {
    asOf: (end.asOf ?? toEnd).toISOString(),
    displayCurrency,
    totalValue: end.totalValue,
    cashValue: end.cashValue,
    securitiesValue: end.securitiesValue,
    unrealizedPnl,
    realizedPnlClosed,
    returnPct,
    allocation,
  };
}

export async function computePortfolioHistory(
  prisma: PrismaClient,
  userId: number,
  from: Date,
  to: Date,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): Promise<{ points: PortfolioHistoryPoint[] }> {
  const accounts = await getBrokerageAccounts(prisma, userId);
  if (!accounts.length) return { points: [] };

  const accountIds = accounts.map((a) => a.id);
  const currencyByAccount = new Map(accounts.map((a) => [a.id, a.currency]));
  const toEnd = utcEndOfDay(to);

  const rows = await prisma.accountValuationDaily.findMany({
    where: {
      accountId: { in: accountIds },
      valuationDate: { gte: from, lte: toEnd },
    },
    orderBy: { valuationDate: "asc" },
  });

  const byDate = new Map<string, { total: number; cash: number; securities: number }>();
  for (const row of rows) {
    const key = dateKey(row.valuationDate);
    const accCurrency = currencyByAccount.get(row.accountId) ?? row.currency;
    const bucket = byDate.get(key) ?? { total: 0, cash: 0, securities: 0 };
    bucket.total += convertAmount(toNumber(row.totalValue), accCurrency, displayCurrency, plnPerUnit);
    bucket.cash += convertAmount(toNumber(row.cashValue), accCurrency, displayCurrency, plnPerUnit);
    bucket.securities += convertAmount(
      toNumber(row.securitiesValue),
      accCurrency,
      displayCurrency,
      plnPerUnit,
    );
    byDate.set(key, bucket);
  }

  const points = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      totalValue: v.total,
      cashValue: v.cash,
      securitiesValue: v.securities,
    }));

  return { points };
}

async function getBenchmarkPriceAsOf(
  prisma: PrismaClient,
  benchmarkId: BenchmarkId,
  asOf: Date,
): Promise<number | null> {
  const def = BENCHMARKS[benchmarkId];
  const instrument = await prisma.instrument.findFirst({
    where: { symbol: def.symbol, exchange: def.exchange },
    orderBy: { id: "asc" },
  });
  if (!instrument) return null;

  const rows = await prisma.instrumentValuation.findMany({
    where: { instrumentId: instrument.id, valuationDate: { lte: asOf } },
    orderBy: { valuationDate: "asc" },
  });
  return priceAsOf(
    rows.map((r) => ({ valuationDate: r.valuationDate, price: toNumber(r.price) })),
    asOf,
  );
}

export async function computeBenchmarkComparison(
  prisma: PrismaClient,
  userId: number,
  benchmarkId: BenchmarkId,
  from: Date,
  to: Date,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): Promise<BenchmarkComparison> {
  const def = BENCHMARKS[benchmarkId];
  const fromEnd = utcEndOfDay(from);
  const toEnd = utcEndOfDay(to);

  const accounts = await getBrokerageAccounts(prisma, userId);
  const accountIds = accounts.map((a) => a.id);

  const start = await sumBrokerageSnapshotAsOf(
    prisma,
    accountIds,
    accounts,
    fromEnd,
    displayCurrency,
    plnPerUnit,
  );
  const end = await sumBrokerageSnapshotAsOf(
    prisma,
    accountIds,
    accounts,
    toEnd,
    displayCurrency,
    plnPerUnit,
  );
  const netContributions = await computeNetExternalContributions(
    prisma,
    accountIds,
    from,
    toEnd,
    displayCurrency,
    plnPerUnit,
  );
  const portfolioReturnPct = computeSimpleReturnPct(
    start.totalValue,
    end.totalValue,
    netContributions,
  );

  const startPrice = await getBenchmarkPriceAsOf(prisma, benchmarkId, fromEnd);
  const endPrice = await getBenchmarkPriceAsOf(prisma, benchmarkId, toEnd);
  const benchmarkReturnPct =
    startPrice != null && endPrice != null && startPrice > 0
      ? ((endPrice - startPrice) / startPrice) * 100
      : null;

  return {
    benchmark: benchmarkId,
    benchmarkLabel: def.label,
    portfolioReturnPct,
    benchmarkReturnPct,
    displayCurrency,
  };
}
