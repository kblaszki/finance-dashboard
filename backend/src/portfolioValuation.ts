import { convertAmount } from "./fx";
import { classifyMarketDataStatus, type MarketDataStatus } from "./marketData";

export type TradeLot = {
  portfolioId: number;
  side: string;
  symbol: string;
  quantity: unknown;
  tradePrice?: unknown;
  currency: string;
  tradeDate?: Date;
};

export type PriceSnapshot = {
  close: unknown;
  currency: string;
  priceDate: Date;
};

export type PortfolioMeta = {
  id: number;
  name: string;
  baseCurrency: string;
  cashBalance: unknown;
};

function normalizeSymbol(symbol: unknown): string {
  return String(symbol ?? "").trim().toUpperCase();
}

function normalizeCurrency(code: unknown): string {
  return String(code ?? "").trim().toUpperCase();
}

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

export function quantityForSymbol(trades: TradeLot[]): number {
  let quantity = 0;
  for (const trade of trades) {
    const q = toNumber(trade.quantity);
    quantity += trade.side === "BUY" ? q : -q;
  }
  return Math.max(0, quantity);
}

export function groupTradesByPortfolioAndSymbol(
  trades: TradeLot[],
): Map<number, Map<string, TradeLot[]>> {
  const byPortfolio = new Map<number, Map<string, TradeLot[]>>();
  for (const trade of trades) {
    const portfolioId = trade.portfolioId;
    const symbol = normalizeSymbol(trade.symbol);
    let bySymbol = byPortfolio.get(portfolioId);
    if (!bySymbol) {
      bySymbol = new Map();
      byPortfolio.set(portfolioId, bySymbol);
    }
    const arr = bySymbol.get(symbol) ?? [];
    arr.push(trade);
    bySymbol.set(symbol, arr);
  }
  return byPortfolio;
}

export type PositionValuation = {
  portfolioId: number;
  symbol: string;
  quantity: number;
  marketValue: number;
  marketDataStatus: MarketDataStatus;
  priceDate: Date | null;
};

export type BrokerValuationResult = {
  securitiesValue: number;
  pricedPositionsCount: number;
  stalePositionsCount: number;
  totalPositionsCount: number;
  valuationAsOf: Date | null;
  positions: PositionValuation[];
  byPortfolio: Array<{
    portfolioId: number;
    securitiesValue: number;
    pricedPositionsCount: number;
    stalePositionsCount: number;
    totalPositionsCount: number;
  }>;
};

export function computeBrokerSecuritiesValuation(opts: {
  trades: TradeLot[];
  snapshotsBySymbol: Map<string, PriceSnapshot>;
  displayCurrency: string;
  plnPerUnit: Record<string, number>;
  marketDataExpireDays: number;
}): BrokerValuationResult {
  const { trades, snapshotsBySymbol, displayCurrency, plnPerUnit, marketDataExpireDays } = opts;
  const grouped = groupTradesByPortfolioAndSymbol(trades);
  const positions: PositionValuation[] = [];
  const byPortfolioMap = new Map<
    number,
    {
      securitiesValue: number;
      pricedPositionsCount: number;
      stalePositionsCount: number;
      totalPositionsCount: number;
    }
  >();

  let securitiesValue = 0;
  let pricedPositionsCount = 0;
  let stalePositionsCount = 0;
  let totalPositionsCount = 0;
  let valuationAsOf: Date | null = null;

  for (const [portfolioId, bySymbol] of grouped) {
    let portfolioSecurities = 0;
    let portfolioPriced = 0;
    let portfolioStale = 0;
    let portfolioTotal = 0;

    for (const [symbol, symbolTrades] of bySymbol) {
      const quantity = quantityForSymbol(symbolTrades);
      if (quantity <= 0) continue;

      portfolioTotal += 1;
      totalPositionsCount += 1;

      const snapshot = snapshotsBySymbol.get(symbol);
      const status = classifyMarketDataStatus(
        new Date(),
        snapshot?.priceDate,
        2,
        marketDataExpireDays,
      );

      let marketValue = 0;
      if (status === "stale") {
        stalePositionsCount += 1;
        portfolioStale += 1;
      }

      if (snapshot && status !== "missing" && status !== "expired") {
        pricedPositionsCount += 1;
        portfolioPriced += 1;
        const price = toNumber(snapshot.close);
        const fromCcy = normalizeCurrency(snapshot.currency);
        marketValue = convertAmount(quantity * price, fromCcy, displayCurrency, plnPerUnit);
        securitiesValue += marketValue;
        portfolioSecurities += marketValue;
        if (!valuationAsOf || snapshot.priceDate < valuationAsOf) {
          valuationAsOf = snapshot.priceDate;
        }
      }

      positions.push({
        portfolioId,
        symbol,
        quantity,
        marketValue,
        marketDataStatus: status,
        priceDate: snapshot?.priceDate ?? null,
      });
    }

    byPortfolioMap.set(portfolioId, {
      securitiesValue: portfolioSecurities,
      pricedPositionsCount: portfolioPriced,
      stalePositionsCount: portfolioStale,
      totalPositionsCount: portfolioTotal,
    });
  }

  const byPortfolio = [...byPortfolioMap.entries()].map(([portfolioId, row]) => ({
    portfolioId,
    ...row,
  }));

  return {
    securitiesValue,
    pricedPositionsCount,
    stalePositionsCount,
    totalPositionsCount,
    valuationAsOf,
    positions,
    byPortfolio,
  };
}

export function sumBrokerCash(
  portfolios: PortfolioMeta[],
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): number {
  return portfolios.reduce((acc, p) => {
    return (
      acc +
      convertAmount(toNumber(p.cashBalance), normalizeCurrency(p.baseCurrency), displayCurrency, plnPerUnit)
    );
  }, 0);
}

export type PortfolioValuePeriodPoint = {
  period: string;
  securitiesValue: number;
  cashValue: number;
  totalValue: number;
};

export function tradesActiveOnOrBefore(trades: TradeLot[], asOf: Date): TradeLot[] {
  return trades.filter((t) => {
    if (!t.tradeDate) return true;
    return new Date(t.tradeDate) <= asOf;
  });
}

export function computePortfolioValueOverTime(opts: {
  trades: TradeLot[];
  transfers: Array<{ portfolioId: number; amount: unknown; date: Date }>;
  portfolios: PortfolioMeta[];
  historyBySymbol: Map<string, Array<{ priceDate: Date; close: unknown; currency: string }>>;
  periods: string[];
  displayCurrency: string;
  plnPerUnit: Record<string, number>;
  marketDataExpireDays: number;
}): PortfolioValuePeriodPoint[] {
  const {
    trades,
    transfers,
    portfolios,
    historyBySymbol,
    periods,
    displayCurrency,
    plnPerUnit,
    marketDataExpireDays,
  } = opts;

  return periods.map((period) => {
    const [yStr, mStr] = period.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

    const activeTrades = tradesActiveOnOrBefore(trades, monthEnd);
    const snapshotsAtMonth = new Map<string, PriceSnapshot>();

    for (const [symbol, rows] of historyBySymbol) {
      const eligible = rows.filter((r) => new Date(r.priceDate) <= monthEnd);
      if (!eligible.length) continue;
      const latest = eligible.reduce((a, b) =>
        new Date(a.priceDate) >= new Date(b.priceDate) ? a : b,
      );
      snapshotsAtMonth.set(symbol, latest);
    }

    const valuation = computeBrokerSecuritiesValuation({
      trades: activeTrades,
      snapshotsBySymbol: snapshotsAtMonth,
      displayCurrency,
      plnPerUnit,
      marketDataExpireDays,
    });

    let cashValue = 0;
    for (const portfolio of portfolios) {
      const pid = portfolio.id;
      const portfolioTransfers = transfers.filter(
        (t) => t.portfolioId === pid && new Date(t.date) <= monthEnd,
      );
      const portfolioTrades = activeTrades.filter((t) => t.portfolioId === pid);
      let balance = portfolioTransfers.reduce((acc, t) => acc + toNumber(t.amount), 0);
      for (const t of portfolioTrades) {
        const value = toNumber(t.quantity) * toNumber(t.tradePrice ?? 0);
        balance += t.side === "BUY" ? -value : value;
      }
      cashValue += convertAmount(
        balance,
        normalizeCurrency(portfolio.baseCurrency),
        displayCurrency,
        plnPerUnit,
      );
    }

    return {
      period,
      securitiesValue: valuation.securitiesValue,
      cashValue,
      totalValue: valuation.securitiesValue + cashValue,
    };
  });
}
