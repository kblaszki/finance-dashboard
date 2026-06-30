import type { PrismaClient } from "@prisma/client";
import { convertAmount } from "./fx";
import { computeFifoRealizedEvents } from "./fifoRealizedPnl";
import { toNumber } from "./accountValuation";

export type CryptoSellRow = {
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

export type CryptoTaxSection = {
  realizedGains: number;
  realizedLosses: number;
  netRealized: number;
  sellRows: CryptoSellRow[];
  message: string;
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

function isCryptoHolding(accountType: string, instrumentType: string): boolean {
  return accountType === "CRYPTO" || instrumentType.toUpperCase() === "CRYPTO";
}

export async function computeCryptoTaxSection(
  prisma: PrismaClient,
  userId: number,
  taxYear: number,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): Promise<CryptoTaxSection> {
  const accounts = await prisma.account.findMany({
    where: { userId, accountType: { in: ["CRYPTO", "BROKERAGE"] } },
    include: {
      holdings: {
        include: {
          instrument: true,
          lots: { orderBy: [{ tradeDate: "asc" }, { id: "asc" }] },
        },
      },
    },
  });

  const sellRows: CryptoSellRow[] = [];

  for (const account of accounts) {
    for (const holding of account.holdings) {
      if (!isCryptoHolding(account.accountType, holding.instrument.instrumentType)) continue;

      const settlementByLotId = new Map(
        holding.lots.map((lot) => [lot.id, lot.settlementDate ?? null]),
      );
      const fifoLots = holding.lots.map((lot) => {
        const mapped = {
          id: lot.id,
          side: lot.side,
          quantity: toNumber(lot.quantity),
          pricePerUnit: toNumber(lot.pricePerUnit ?? 0),
          commission: toNumber(lot.commission ?? 0),
          currency: lot.currency,
          tradeDate: lot.tradeDate,
        };
        if (lot.totalPrice != null) {
          return { ...mapped, totalPrice: toNumber(lot.totalPrice) };
        }
        return mapped;
      });

      let events;
      try {
        events = computeFifoRealizedEvents(fifoLots);
      } catch {
        continue;
      }

      for (const event of events) {
        const taxDate = settlementByLotId.get(event.lotId) ?? event.tradeDate;
        if (!inTaxYear(taxDate, taxYear)) continue;
        const gainDisplay = convertAmount(
          event.gainLoss,
          event.currency,
          displayCurrency,
          plnPerUnit,
        );
        const proceedsDisplay = convertAmount(
          event.proceeds,
          event.currency,
          displayCurrency,
          plnPerUnit,
        );
        const costDisplay = convertAmount(event.cost, event.currency, displayCurrency, plnPerUnit);
        sellRows.push({
          saleDate: taxDate.toISOString(),
          symbol: holding.instrument.symbol,
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
  }

  let realizedGains = 0;
  let realizedLosses = 0;
  for (const row of sellRows) {
    if (row.gainLoss > 0) realizedGains += row.gainLoss;
    else if (row.gainLoss < 0) realizedLosses += Math.abs(row.gainLoss);
  }

  return {
    realizedGains,
    realizedLosses,
    netRealized: realizedGains - realizedLosses,
    sellRows: sellRows.sort((a, b) => a.saleDate.localeCompare(b.saleDate)),
    message:
      sellRows.length > 0
        ? "Crypto disposals taxed on PIT scale (art. 30f), not PIT-38 (FR-043)."
        : "No crypto disposals in this year.",
  };
}
