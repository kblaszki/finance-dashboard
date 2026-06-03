import { convertAmount } from "./fx";
import {
  computeBrokerSecuritiesValuation,
  sumBrokerCash,
  type PortfolioMeta,
  type PriceSnapshot,
  type TradeLot,
} from "./portfolioValuation";

export type FinancialAccountRow = {
  id: number;
  type: string;
  name: string;
  currency: string;
  openingBalance?: unknown;
  manualValue?: unknown | null;
};

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

export type NetWorthBreakdown = {
  currency: string;
  fxAsOf: string;
  netWorth: number;
  brokerSecurities: number;
  brokerCash: number;
  brokerTotal: number;
  bankCash: number;
  manualAssets: number;
  liabilities: number;
  bonds: number;
  portfolioValueMarketDataAsOf: Date | null;
  stalePositionsCount: number;
  pricedPositionsCount: number;
  totalPositionsCount: number;
  portfolios: Array<{
    portfolioId: number;
    name: string;
    cash: number;
    securities: number;
    total: number;
  }>;
  accounts: Array<{
    accountId: number;
    type: string;
    name: string;
    value: number;
  }>;
};

export function computeNetWorth(opts: {
  displayCurrency: string;
  plnPerUnit: Record<string, number>;
  fxAsOf: string;
  marketDataExpireDays: number;
  trades: TradeLot[];
  portfolios: Array<PortfolioMeta & { name: string }>;
  snapshotsBySymbol: Map<string, PriceSnapshot>;
  financialAccounts: FinancialAccountRow[];
  bankBalances: Map<number, number>;
}): NetWorthBreakdown {
  const {
    displayCurrency,
    plnPerUnit,
    fxAsOf,
    marketDataExpireDays,
    trades,
    portfolios,
    snapshotsBySymbol,
    financialAccounts,
    bankBalances,
  } = opts;

  const brokerVal = computeBrokerSecuritiesValuation({
    trades,
    snapshotsBySymbol,
    displayCurrency,
    plnPerUnit,
    marketDataExpireDays,
  });

  const brokerCash = sumBrokerCash(portfolios, displayCurrency, plnPerUnit);
  const brokerSecurities = brokerVal.securitiesValue;
  const brokerTotal = brokerCash + brokerSecurities;

  const portfolioRows = portfolios.map((p) => {
    const row = brokerVal.byPortfolio.find((b) => b.portfolioId === p.id);
    const securities = row?.securitiesValue ?? 0;
    const cash = convertAmount(
      toNumber(p.cashBalance),
      normalizeCurrency(p.baseCurrency),
      displayCurrency,
      plnPerUnit,
    );
    return {
      portfolioId: p.id,
      name: p.name,
      cash,
      securities,
      total: cash + securities,
    };
  });

  let bankCash = 0;
  let manualAssets = 0;
  let liabilities = 0;
  let bonds = 0;
  const accountRows: NetWorthBreakdown["accounts"] = [];

  for (const acc of financialAccounts) {
    const ccy = normalizeCurrency(acc.currency);
    let value = 0;

    if (acc.type === "BANK") {
      value = convertAmount(bankBalances.get(acc.id) ?? 0, ccy, displayCurrency, plnPerUnit);
      bankCash += value;
    } else if (acc.type === "BONDS") {
      value = convertAmount(toNumber(acc.manualValue ?? 0), ccy, displayCurrency, plnPerUnit);
      bonds += value;
    } else if (acc.type === "LIABILITY") {
      value = convertAmount(toNumber(acc.manualValue ?? 0), ccy, displayCurrency, plnPerUnit);
      liabilities += value;
    } else if (acc.type === "REAL_ESTATE" || acc.type === "CRYPTO") {
      value = convertAmount(toNumber(acc.manualValue ?? 0), ccy, displayCurrency, plnPerUnit);
      manualAssets += value;
    }

    accountRows.push({
      accountId: acc.id,
      type: acc.type,
      name: acc.name,
      value: acc.type === "LIABILITY" ? -value : value,
    });
  }

  const netWorth = brokerTotal + bankCash + manualAssets + bonds - liabilities;

  return {
    currency: displayCurrency,
    fxAsOf,
    netWorth,
    brokerSecurities,
    brokerCash,
    brokerTotal,
    bankCash,
    manualAssets,
    liabilities,
    bonds,
    portfolioValueMarketDataAsOf: brokerVal.valuationAsOf,
    stalePositionsCount: brokerVal.stalePositionsCount,
    pricedPositionsCount: brokerVal.pricedPositionsCount,
    totalPositionsCount: brokerVal.totalPositionsCount,
    portfolios: portfolioRows,
    accounts: accountRows,
  };
}
