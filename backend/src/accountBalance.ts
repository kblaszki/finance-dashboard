import type { PrismaClient } from "@prisma/client";
import { convertAmount } from "./fx";
import { computeBrokerSecuritiesValuation, tradesActiveOnOrBefore, type TradeLot } from "./portfolioValuation";
import { computePortfolioCashBalance } from "./portfolioCash";
import { getLatestPricesBySymbols } from "./assets";

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

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export async function computeBankBalanceAsOf(
  prisma: PrismaClient,
  userId: number,
  accountId: number,
  asOf: Date,
): Promise<number> {
  const details = await prisma.bankAccountDetails.findFirst({
    where: { accountId, account: { userId, type: "BANK" } },
  });
  if (!details) return 0;
  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      accountId,
      type: { in: ["INCOME", "EXPENSE"] },
      date: { lte: asOf },
    },
  });
  let balance = toNumber(details.openingBalance);
  for (const t of txs) {
    const amount = toNumber(t.amount);
    if (t.type === "INCOME") balance += amount;
    if (t.type === "EXPENSE") balance -= amount;
  }
  return balance;
}

export async function computeBrokerageBalanceAsOf(
  prisma: PrismaClient,
  userId: number,
  accountId: number,
  asOf: Date,
  plnPerUnit: Record<string, number>,
): Promise<{ total: number; cash: number; securities: number; currency: string }> {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId, type: "BROKERAGE" },
    include: { brokerageDetails: true },
  });
  if (!account?.brokerageDetails) {
    return { total: 0, cash: 0, securities: 0, currency: "PLN" };
  }
  const currency = account.currency;
  const transfers = await prisma.transaction.findMany({
    where: { userId, accountId, type: "TRANSFER_TO_PORTFOLIO", date: { lte: asOf } },
  });
  const trades = await prisma.portfolioTrade.findMany({
    where: { userId, accountId, tradeDate: { lte: asOf } },
  });
  const cash = computePortfolioCashBalance(
    transfers.map((t) => ({ amount: toNumber(t.amount) })),
    trades.map((t) => ({
      side: t.side,
      quantity: toNumber(t.quantity),
      tradePrice: toNumber(t.tradePrice),
    })),
  );
  const activeTrades: TradeLot[] = tradesActiveOnOrBefore(
    trades.map((t) => ({
      side: t.side,
      symbol: t.symbol,
      quantity: t.quantity,
      tradePrice: t.tradePrice,
      tradeDate: t.tradeDate,
      currency: t.currency,
      portfolioId: accountId,
    })),
    asOf,
  );
  const symbols = [...new Set(activeTrades.map((t) => t.symbol))];
  const latestBySymbol = await getLatestPricesBySymbols(prisma, symbols);
  const snapshots = new Map<string, { priceDate: Date; close: unknown; currency: string }>();
  for (const [sym, row] of latestBySymbol) {
    if (new Date(row.priceDate) <= asOf) {
      snapshots.set(sym, { priceDate: row.priceDate, close: row.close, currency: row.currency });
    }
  }
  const valuation = computeBrokerSecuritiesValuation({
    trades: activeTrades,
    snapshotsBySymbol: snapshots,
    displayCurrency: currency,
    plnPerUnit,
    marketDataExpireDays: 365,
  });
  const securities = Number.isFinite(valuation.securitiesValue)
    ? valuation.securitiesValue
    : 0;
  return { total: cash + securities, cash, securities, currency };
}

export async function backfillAccountBalanceHistory(
  prisma: PrismaClient,
  userId: number,
  accountId: number,
  plnPerUnit: Record<string, number>,
): Promise<void> {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) return;

  const dates = new Set<string>();
  const pushDate = (d: Date) => dates.add(utcDateOnly(d).toISOString());

  if (account.type === "BANK") {
    const txs = await prisma.transaction.findMany({
      where: { userId, accountId, type: { in: ["INCOME", "EXPENSE"] } },
      orderBy: { date: "asc" },
    });
    for (const t of txs) pushDate(t.date);
    if (txs.length === 0) {
      pushDate(account.createdAt);
    }
  } else {
    const txs = await prisma.transaction.findMany({
      where: { userId, accountId, type: "TRANSFER_TO_PORTFOLIO" },
    });
    const trades = await prisma.portfolioTrade.findMany({ where: { userId, accountId } });
    for (const t of txs) pushDate(t.date);
    for (const t of trades) pushDate(t.tradeDate);
    if (!txs.length && !trades.length) pushDate(account.createdAt);
  }

  const sorted = [...dates].map((s) => new Date(s)).sort((a, b) => a.getTime() - b.getTime());
  if (!sorted.length) return;

  await prisma.accountBalanceDaily.deleteMany({ where: { accountId } });

  const rows: Array<{
    accountId: number;
    balanceDate: Date;
    balance: number;
    cashComponent: number | null;
    securitiesComponent: number | null;
    currency: string;
  }> = [];

  if (account.type === "BANK") {
    for (const day of sorted) {
      const end = new Date(day);
      end.setUTCHours(23, 59, 59, 999);
      const balance = await computeBankBalanceAsOf(prisma, userId, accountId, end);
      rows.push({
        accountId,
        balanceDate: day,
        balance,
        cashComponent: null,
        securitiesComponent: null,
        currency: account.currency,
      });
    }
  } else {
    for (const day of sorted) {
      const end = new Date(day);
      end.setUTCHours(23, 59, 59, 999);
      const parts = await computeBrokerageBalanceAsOf(prisma, userId, accountId, end, plnPerUnit);
      rows.push({
        accountId,
        balanceDate: day,
        balance: parts.total,
        cashComponent: parts.cash,
        securitiesComponent: parts.securities,
        currency: parts.currency,
      });
    }
  }

  if (rows.length) {
    await prisma.accountBalanceDaily.createMany({
      data: rows.map((r) => ({
        accountId: r.accountId,
        balanceDate: r.balanceDate,
        balance: r.balance,
        cashComponent: r.cashComponent ?? null,
        securitiesComponent: r.securitiesComponent ?? null,
        currency: r.currency,
      })),
    });
  }
}

export async function recomputeAccountBalancesFrom(
  prisma: PrismaClient,
  userId: number,
  accountId: number,
  fromDate: Date,
  plnPerUnit: Record<string, number>,
): Promise<void> {
  const from = utcDateOnly(fromDate);
  await prisma.accountBalanceDaily.deleteMany({
    where: { accountId, balanceDate: { gte: from } },
  });
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) return;

  const eventDates: Date[] = [];
  if (account.type === "BANK") {
    const txs = await prisma.transaction.findMany({
      where: {
        userId,
        accountId,
        type: { in: ["INCOME", "EXPENSE"] },
        date: { gte: from },
      },
    });
    eventDates.push(...txs.map((t) => utcDateOnly(t.date)));
  } else {
    const txs = await prisma.transaction.findMany({
      where: { userId, accountId, type: "TRANSFER_TO_PORTFOLIO", date: { gte: from } },
    });
    const trades = await prisma.portfolioTrade.findMany({
      where: { userId, accountId, tradeDate: { gte: from } },
    });
    eventDates.push(...txs.map((t) => utcDateOnly(t.date)), ...trades.map((t) => utcDateOnly(t.tradeDate)));
  }

  const today = utcDateOnly(new Date());
  let cursor = from;
  const allDays: Date[] = [];
  while (cursor <= today) {
    if (eventDates.some((e) => e.getTime() === cursor.getTime()) || cursor.getTime() === from.getTime()) {
      allDays.push(new Date(cursor));
    }
    cursor = addDays(cursor, 1);
  }
  for (const d of [...new Set(eventDates.map((x) => x.toISOString()))].map((s) => new Date(s))) {
    if (!allDays.some((x) => x.getTime() === d.getTime())) allDays.push(d);
  }
  allDays.sort((a, b) => a.getTime() - b.getTime());

  for (const day of allDays) {
    const end = new Date(day);
    end.setUTCHours(23, 59, 59, 999);
    if (account.type === "BANK") {
      const balance = await computeBankBalanceAsOf(prisma, userId, accountId, end);
      await prisma.accountBalanceDaily.upsert({
        where: { accountId_balanceDate: { accountId, balanceDate: day } },
        create: { accountId, balanceDate: day, balance, currency: account.currency },
        update: { balance },
      });
    } else {
      const parts = await computeBrokerageBalanceAsOf(prisma, userId, accountId, end, plnPerUnit);
      await prisma.accountBalanceDaily.upsert({
        where: { accountId_balanceDate: { accountId, balanceDate: day } },
        create: {
          accountId,
          balanceDate: day,
          balance: parts.total,
          cashComponent: parts.cash,
          securitiesComponent: parts.securities,
          currency: parts.currency,
        },
        update: {
          balance: parts.total,
          cashComponent: parts.cash,
          securitiesComponent: parts.securities,
        },
      });
    }
  }
}

export async function getLatestAccountBalance(
  prisma: PrismaClient,
  accountId: number,
): Promise<number | null> {
  const row = await prisma.accountBalanceDaily.findFirst({
    where: { accountId },
    orderBy: { balanceDate: "desc" },
  });
  return row ? toNumber(row.balance) : null;
}
