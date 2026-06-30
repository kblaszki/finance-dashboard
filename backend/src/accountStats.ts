import type { PrismaClient } from "@prisma/client";
import { toNumber } from "./accountValuation";
import { convertAmount } from "./fx";
import { getAccountHoldings } from "./holdings";
import { computeCashflowStats } from "./stats";

export type AccountDetailStats = {
  currency: string;
  ytdIncome: number;
  ytdExpense: number;
  ytdNet: number;
  yoyChangeAbs: number | null;
  yoyChangePct: number | null;
  currentTotal: number;
  breakdown?: {
    cashValue: number;
    securitiesValue: number;
    cashPct: number;
    securitiesPct: number;
  };
};

function valuationTotalOnDate(
  rows: Array<{ valuationDate: Date; totalValue: unknown }>,
  asOf: Date,
): number | null {
  let best: { valuationDate: Date; totalValue: unknown } | null = null;
  for (const row of rows) {
    if (row.valuationDate.getTime() > asOf.getTime()) continue;
    if (!best || row.valuationDate.getTime() > best.valuationDate.getTime()) {
      best = row;
    }
  }
  return best ? toNumber(best.totalValue) : null;
}

export async function computeAccountDetailStats(
  prisma: PrismaClient,
  account: {
    id: number;
    accountType: string;
    currency: string;
    cashBalance: unknown;
  },
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): Promise<AccountDetailStats> {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const transactions = await prisma.transaction.findMany({
    where: {
      accountId: account.id,
      date: { gte: yearStart, lte: yearEnd },
    },
    select: {
      amount: true,
      currency: true,
      transactionType: true,
      category: true,
    },
  });

  const ytd = computeCashflowStats(
    transactions,
    displayCurrency,
    convertAmount,
    toNumber,
    plnPerUnit,
  );

  const valuations = await prisma.accountValuationDaily.findMany({
    where: { accountId: account.id },
    orderBy: { valuationDate: "asc" },
    select: { valuationDate: true, totalValue: true },
  });

  const latestNative =
    valuations.length > 0
      ? toNumber(valuations[valuations.length - 1]!.totalValue)
      : toNumber(account.cashBalance);
  const pastNative = valuationTotalOnDate(valuations, oneYearAgo);

  const currentTotal = convertAmount(latestNative, account.currency, displayCurrency, plnPerUnit);
  const pastTotal =
    pastNative != null
      ? convertAmount(pastNative, account.currency, displayCurrency, plnPerUnit)
      : null;
  const yoyChangeAbs = pastTotal != null ? currentTotal - pastTotal : null;
  const yoyChangePct =
    pastTotal != null && pastTotal > 0 && yoyChangeAbs != null
      ? (yoyChangeAbs / pastTotal) * 100
      : null;

  const result: AccountDetailStats = {
    currency: displayCurrency,
    ytdIncome: ytd.income,
    ytdExpense: ytd.expense,
    ytdNet: ytd.net,
    yoyChangeAbs,
    yoyChangePct,
    currentTotal,
  };

  if (account.accountType === "BROKERAGE") {
    const holdings = await getAccountHoldings(prisma, account.id, account.currency, plnPerUnit);
    const cashValue = convertAmount(
      toNumber(account.cashBalance),
      account.currency,
      displayCurrency,
      plnPerUnit,
    );
    const securitiesValue = holdings.open.reduce((sum, holding) => {
      if (holding.marketValue == null) return sum;
      return (
        sum +
        convertAmount(holding.marketValue, account.currency, displayCurrency, plnPerUnit)
      );
    }, 0);
    const total = cashValue + securitiesValue;
    result.breakdown = {
      cashValue,
      securitiesValue,
      cashPct: total > 0 ? (cashValue / total) * 100 : 0,
      securitiesPct: total > 0 ? (securitiesValue / total) * 100 : 0,
    };
  }

  return result;
}
