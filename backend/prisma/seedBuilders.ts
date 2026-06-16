import type { PrismaClient } from "@prisma/client";
import { computeBalanceAfter, type TransactionType } from "../src/transactionBalance";
import { computeQuantityAfter, resolveLotPrice } from "../src/holdingLot";

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
        accountId,
        instrumentId,
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
