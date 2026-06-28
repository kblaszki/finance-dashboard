import type { PrismaClient } from "@prisma/client";
import { convertAmount } from "./fx";
import { computeFifoRealizedEvents, type RealizedGainEvent } from "./fifoRealizedPnl";
import { toNumber } from "./accountValuation";

const BELKA_RATE = 0.19;

export type TaxSellRow = {
  saleDate: string;
  symbol: string;
  accountId: number;
  accountName: string;
  quantity: number;
  proceeds: number;
  cost: number;
  gainLoss: number;
  currency: string;
};

export type TaxReportWarning = {
  accountId: number;
  accountName: string;
  symbol: string;
  holdingId: number;
  message: string;
};

export type TaxReport = {
  taxYear: number;
  displayCurrency: string;
  realizedGains: number;
  realizedLosses: number;
  netRealized: number;
  estimatedBelka: number;
  dividendsGross: number;
  byAccount: Array<{ accountId: number; name: string; netRealized: number }>;
  byInstrument: Array<{ symbol: string; netRealized: number }>;
  sellRows: TaxSellRow[];
  warnings: TaxReportWarning[];
};

function taxYearBounds(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

function inTaxYear(date: Date, year: number): boolean {
  return date.getUTCFullYear() === year;
}

function convertGain(
  amount: number,
  fromCurrency: string,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): number {
  return convertAmount(amount, fromCurrency, displayCurrency, plnPerUnit);
}

export function aggregateRealizedAmounts(netRows: number[]): {
  realizedGains: number;
  realizedLosses: number;
  netRealized: number;
  estimatedBelka: number;
} {
  let realizedGains = 0;
  let realizedLosses = 0;
  for (const value of netRows) {
    if (value > 0) realizedGains += value;
    else if (value < 0) realizedLosses += Math.abs(value);
  }
  const netRealized = realizedGains - realizedLosses;
  const estimatedBelka = Math.max(0, netRealized) * BELKA_RATE;
  return { realizedGains, realizedLosses, netRealized, estimatedBelka };
}

export function formatTaxReportCsv(rows: TaxSellRow[]): string {
  const header = "saleDate,symbol,account,quantity,proceeds,cost,gainLoss,currency";
  const lines = rows.map((r) =>
    [
      r.saleDate.slice(0, 10),
      r.symbol,
      `"${r.accountName.replace(/"/g, '""')}"`,
      r.quantity,
      r.proceeds.toFixed(2),
      r.cost.toFixed(2),
      r.gainLoss.toFixed(2),
      r.currency,
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export async function computeTaxReport(
  prisma: PrismaClient,
  userId: number,
  taxYear: number,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): Promise<TaxReport> {
  const accounts = await prisma.account.findMany({
    where: { userId, accountType: "BROKERAGE" },
    include: {
      holdings: {
        include: {
          instrument: true,
          lots: { orderBy: [{ tradeDate: "asc" }, { id: "asc" }] },
        },
      },
    },
  });

  const sellRows: TaxSellRow[] = [];
  const warnings: TaxReportWarning[] = [];
  const byAccountMap = new Map<number, { name: string; net: number }>();
  const byInstrumentMap = new Map<string, number>();

  for (const account of accounts) {
    let accountNet = 0;
    for (const holding of account.holdings) {
      const fifoLots = holding.lots.map((lot) => ({
        id: lot.id,
        side: lot.side,
        quantity: toNumber(lot.quantity),
        pricePerUnit: toNumber(lot.pricePerUnit ?? 0),
        currency: lot.currency,
        tradeDate: lot.tradeDate,
      }));

      let events: RealizedGainEvent[] = [];
      try {
        events = computeFifoRealizedEvents(fifoLots);
      } catch (e) {
        const message = e instanceof Error ? e.message : "FIFO calculation failed";
        warnings.push({
          accountId: account.id,
          accountName: account.name,
          symbol: holding.instrument.symbol,
          holdingId: holding.id,
          message,
        });
        continue;
      }

      for (const event of events) {
        if (!inTaxYear(event.tradeDate, taxYear)) continue;
        const gainDisplay = convertGain(
          event.gainLoss,
          event.currency,
          displayCurrency,
          plnPerUnit,
        );
        const proceedsDisplay = convertGain(
          event.proceeds,
          event.currency,
          displayCurrency,
          plnPerUnit,
        );
        const costDisplay = convertGain(event.cost, event.currency, displayCurrency, plnPerUnit);

        accountNet += gainDisplay;
        const symbol = holding.instrument.symbol;
        byInstrumentMap.set(symbol, (byInstrumentMap.get(symbol) ?? 0) + gainDisplay);

        sellRows.push({
          saleDate: event.tradeDate.toISOString(),
          symbol,
          accountId: account.id,
          accountName: account.name,
          quantity: event.quantity,
          proceeds: proceedsDisplay,
          cost: costDisplay,
          gainLoss: gainDisplay,
          currency: displayCurrency,
        });
      }
    }
    byAccountMap.set(account.id, { name: account.name, net: accountNet });
  }

  sellRows.sort((a, b) => a.saleDate.localeCompare(b.saleDate));

  const { start, end } = taxYearBounds(taxYear);
  const dividendRows = await prisma.transaction.findMany({
    where: {
      transactionType: "DIVIDEND",
      date: { gte: start, lte: end },
      account: { userId },
    },
  });
  let dividendsGross = 0;
  for (const row of dividendRows) {
    dividendsGross += convertGain(
      toNumber(row.amount),
      row.currency,
      displayCurrency,
      plnPerUnit,
    );
  }

  const totals = aggregateRealizedAmounts(sellRows.map((r) => r.gainLoss));

  return {
    taxYear,
    displayCurrency,
    ...totals,
    dividendsGross,
    byAccount: [...byAccountMap.entries()].map(([accountId, { name, net }]) => ({
      accountId,
      name,
      netRealized: net,
    })),
    byInstrument: [...byInstrumentMap.entries()]
      .map(([symbol, netRealized]) => ({ symbol, netRealized }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol)),
    sellRows,
    warnings,
  };
}

export function parseTaxYear(value: unknown): number {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("year must be an integer between 2000 and 2100");
  }
  return year;
}
