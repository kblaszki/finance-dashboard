import type { PrismaClient } from "@prisma/client";
import { computeBalanceAfter, type TransactionType } from "../src/transactionBalance";
import { computeQuantityAfter, resolveLotPrice } from "../src/holdingLot";
import { findOrCreateHolding, syncHoldingQuantity } from "../src/holdings";

export function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(12, 0, 0, 0);
  return d;
}

export type BankTxTemplate = {
  transactionType: TransactionType;
  amount: number;
  category: string;
  days: number;
  description?: string;
};

export async function seedBankTransactions(
  prisma: PrismaClient,
  accountId: number,
  currency: string,
  openingBalance: number,
  templates: BankTxTemplate[],
): Promise<number> {
  const sorted = [...templates].sort((a, b) => b.days - a.days);
  let cash = openingBalance;
  for (const tx of sorted) {
    cash = computeBalanceAfter(cash, tx.transactionType, tx.amount);
    await prisma.transaction.create({
      data: {
        accountId,
        transactionType: tx.transactionType,
        amount: tx.amount,
        balanceAfter: cash,
        currency,
        category: tx.category,
        date: daysAgo(tx.days),
        description: tx.description ?? tx.category,
      },
    });
  }
  await prisma.account.update({ where: { id: accountId }, data: { cashBalance: cash } });
  return cash;
}

export async function upsertInstrument(
  prisma: PrismaClient,
  data: {
    symbol: string;
    exchange: string;
    instrumentType: string;
    name: string;
    currency: string;
    source?: string;
  },
) {
  return prisma.instrument.upsert({
    where: {
      symbol_exchange_source: {
        symbol: data.symbol,
        exchange: data.exchange,
        source: data.source ?? "manual",
      },
    },
    update: {},
    create: {
      instrumentType: data.instrumentType,
      symbol: data.symbol,
      name: data.name,
      exchange: data.exchange,
      currency: data.currency,
      source: data.source ?? "manual",
    },
  });
}

export async function seedInstrumentValuations(
  prisma: PrismaClient,
  instrumentId: number,
  currency: string,
  startDay: number,
  endDay: number,
  step: number,
  priceFn: (day: number) => number,
): Promise<void> {
  for (let day = startDay; day >= endDay; day -= step) {
    const valuationDate = daysAgo(day);
    const price = priceFn(day);
    await prisma.instrumentValuation.upsert({
      where: {
        instrumentId_valuationDate_source: {
          instrumentId,
          valuationDate,
          source: "manual",
        },
      },
      update: { price },
      create: {
        instrumentId,
        valuationDate,
        price,
        currency,
        source: "manual",
      },
    });
  }
}

export type LotTemplate = {
  side: "BUY" | "SELL";
  quantity: number;
  pricePerUnit: number;
  days: number;
};

export type DemoInstrumentSpec = {
  instrumentType: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  basePrice: number;
  priceDriftPerDay: number;
};

export const BROKERAGE_HISTORY_DAYS = 400;
export const BROKERAGE_TRADES_PER_INSTRUMENT = 12;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Deterministic buy/sell sequence over at least one year; never oversells. */
export function buildBrokerageLotTemplates(
  basePrice: number,
  daysSpan: number,
  tradeCount: number,
  instrumentIndex: number,
): LotTemplate[] {
  if (tradeCount < 10) {
    throw new Error("tradeCount must be at least 10");
  }
  if (daysSpan < 365) {
    throw new Error("daysSpan must be at least 365");
  }

  const lots: LotTemplate[] = [];
  let qty = 0;
  const minDay = 5;
  const step = (daysSpan - minDay) / (tradeCount - 1);
  const buyUnit = basePrice > 200 ? 1 : basePrice > 80 ? 2 : 5;

  for (let i = 0; i < tradeCount; i++) {
    const day = Math.round(daysSpan - i * step);
    const pricePerUnit = round2(
      basePrice + (daysSpan - day) * (0.03 + instrumentIndex * 0.004),
    );
    const isSell = i >= 3 && i % 4 === 3 && qty > 0;

    if (isSell) {
      const sellQty = Math.min(qty, Math.max(1, Math.floor(qty * (0.25 + (i % 3) * 0.1))));
      lots.push({
        side: "SELL",
        quantity: sellQty,
        pricePerUnit: round2(pricePerUnit * (1.01 + (i % 5) * 0.005)),
        days: day,
      });
      qty -= sellQty;
    } else {
      const buyQty = buyUnit + (instrumentIndex % 2) + (i % 2);
      lots.push({ side: "BUY", quantity: buyQty, pricePerUnit, days: day });
      qty += buyQty;
    }
  }

  return lots;
}

export const US_BROKERAGE_INSTRUMENTS: DemoInstrumentSpec[] = [
  {
    instrumentType: "STOCK",
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    basePrice: 168,
    priceDriftPerDay: 0.04,
  },
  {
    instrumentType: "STOCK",
    symbol: "MSFT",
    name: "Microsoft Corp.",
    exchange: "NASDAQ",
    currency: "USD",
    basePrice: 395,
    priceDriftPerDay: 0.08,
  },
  {
    instrumentType: "STOCK",
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    basePrice: 162,
    priceDriftPerDay: 0.05,
  },
  {
    instrumentType: "STOCK",
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    exchange: "NASDAQ",
    currency: "USD",
    basePrice: 118,
    priceDriftPerDay: 0.12,
  },
  {
    instrumentType: "ETF",
    symbol: "VT",
    name: "Vanguard Total World Stock ETF",
    exchange: "NYSE",
    currency: "USD",
    basePrice: 92,
    priceDriftPerDay: 0.02,
  },
  {
    instrumentType: "ETF",
    symbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    exchange: "NYSE",
    currency: "USD",
    basePrice: 465,
    priceDriftPerDay: 0.06,
  },
  {
    instrumentType: "ETF",
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    exchange: "NASDAQ",
    currency: "USD",
    basePrice: 435,
    priceDriftPerDay: 0.07,
  },
  {
    instrumentType: "ETF",
    symbol: "SCHD",
    name: "Schwab US Dividend Equity ETF",
    exchange: "NYSE",
    currency: "USD",
    basePrice: 26,
    priceDriftPerDay: 0.01,
  },
];

export const EU_BROKERAGE_INSTRUMENTS: DemoInstrumentSpec[] = [
  {
    instrumentType: "ETF",
    symbol: "IWDA",
    name: "iShares MSCI World",
    exchange: "LSE",
    currency: "EUR",
    basePrice: 76,
    priceDriftPerDay: 0.03,
  },
  {
    instrumentType: "ETF",
    symbol: "EUNL",
    name: "iShares Core MSCI World",
    exchange: "XETRA",
    currency: "EUR",
    basePrice: 93,
    priceDriftPerDay: 0.03,
  },
  {
    instrumentType: "STOCK",
    symbol: "ASML",
    name: "ASML Holding",
    exchange: "AEX",
    currency: "EUR",
    basePrice: 660,
    priceDriftPerDay: 0.15,
  },
  {
    instrumentType: "STOCK",
    symbol: "SAP",
    name: "SAP SE",
    exchange: "XETRA",
    currency: "EUR",
    basePrice: 175,
    priceDriftPerDay: 0.05,
  },
  {
    instrumentType: "ETF",
    symbol: "SXR8",
    name: "iShares Core S&P 500",
    exchange: "XETRA",
    currency: "EUR",
    basePrice: 505,
    priceDriftPerDay: 0.06,
  },
  {
    instrumentType: "ETF",
    symbol: "VUSA",
    name: "Vanguard S&P 500 UCITS ETF",
    exchange: "LSE",
    currency: "EUR",
    basePrice: 83,
    priceDriftPerDay: 0.02,
  },
  {
    instrumentType: "STOCK",
    symbol: "ENEL",
    name: "Enel SpA",
    exchange: "MIL",
    currency: "EUR",
    basePrice: 6.8,
    priceDriftPerDay: 0.002,
  },
];

export async function seedBrokerageDemo(
  prisma: PrismaClient,
  accountId: number,
  funding: number,
  currency: string,
  fundingDays: number,
  instruments: DemoInstrumentSpec[],
): Promise<void> {
  await seedTransferIn(prisma, accountId, funding, currency, fundingDays);
  let cash = funding;

  for (let i = 0; i < instruments.length; i++) {
    const spec = instruments[i];
    const instrument = await upsertInstrument(prisma, spec);
    await seedInstrumentValuations(
      prisma,
      instrument.id,
      spec.currency,
      BROKERAGE_HISTORY_DAYS,
      0,
      3,
      (day) => round2(spec.basePrice + (BROKERAGE_HISTORY_DAYS - day) * spec.priceDriftPerDay),
    );
    const lots = buildBrokerageLotTemplates(
      spec.basePrice,
      BROKERAGE_HISTORY_DAYS,
      BROKERAGE_TRADES_PER_INSTRUMENT,
      i,
    );
    cash = await seedHoldingLots(prisma, accountId, instrument.id, spec.currency, lots, cash);
  }
}

export async function seedHoldingLots(
  prisma: PrismaClient,
  accountId: number,
  instrumentId: number,
  currency: string,
  lots: LotTemplate[],
  initialCash: number,
): Promise<number> {
  const sorted = [...lots].sort((a, b) => b.days - a.days);
  let prevQty = 0;
  let cash = initialCash;

  const holding = await findOrCreateHolding(prisma, accountId, instrumentId);

  for (const lot of sorted) {
    const prices = resolveLotPrice({
      quantity: lot.quantity,
      pricePerUnit: lot.pricePerUnit,
    });
    const quantityAfter = computeQuantityAfter(prevQty, lot.side, lot.quantity);
    prevQty = quantityAfter;

    if (lot.side === "BUY") {
      cash = computeBalanceAfter(cash, "EXPENSE", prices.totalPrice);
    } else {
      cash = computeBalanceAfter(cash, "INCOME", prices.totalPrice);
    }

    await prisma.holdingLot.create({
      data: {
        holdingId: holding.id,
        side: lot.side,
        quantity: lot.quantity,
        quantityAfter,
        totalPrice: prices.totalPrice,
        pricePerUnit: prices.pricePerUnit,
        currency,
        tradeDate: daysAgo(lot.days),
      },
    });
  }

  await syncHoldingQuantity(prisma, holding.id);

  await prisma.account.update({ where: { id: accountId }, data: { cashBalance: cash } });
  return cash;
}

export async function seedTransferIn(
  prisma: PrismaClient,
  accountId: number,
  amount: number,
  currency: string,
  days: number,
  category = "INVESTMENT",
): Promise<void> {
  await prisma.transaction.create({
    data: {
      accountId,
      transactionType: "TRANSFER_IN",
      amount,
      balanceAfter: amount,
      currency,
      category,
      date: daysAgo(days),
      description: "Initial funding",
    },
  });
  await prisma.account.update({
    where: { id: accountId },
    data: { cashBalance: amount },
  });
}

export function buildBankMonthTemplates(): BankTxTemplate[] {
  const templates: BankTxTemplate[] = [];
  const expenses = [
    { category: "FOOD", amount: 120 },
    { category: "TRANSPORT", amount: 80 },
    { category: "SHOPPING", amount: 200 },
    { category: "UTILITIES", amount: 150 },
    { category: "FOOD", amount: 95 },
    { category: "ENTERTAINMENT", amount: 60 },
  ];
  for (let day = 88; day >= 3; day -= 7) {
    const exp = expenses[(88 - day) / 7 % expenses.length];
    templates.push({
      transactionType: "EXPENSE",
      amount: exp.amount + (day % 5) * 10,
      category: exp.category,
      days: day,
    });
  }
  templates.push(
    { transactionType: "INCOME", amount: 8000, category: "SALARY", days: 85 },
    { transactionType: "INCOME", amount: 8000, category: "SALARY", days: 55 },
    { transactionType: "INCOME", amount: 8000, category: "SALARY", days: 25 },
    { transactionType: "TRANSFER_IN", amount: 500, category: "TRANSFER", days: 40 },
    { transactionType: "TRANSFER_OUT", amount: 300, category: "TRANSFER", days: 12 },
  );
  return templates;
}
