import type { PrismaClient } from "@prisma/client";
import {
  backfillAccountValuations,
  recalcTransactionBalances,
  recomputeAccountValuationsFrom,
} from "../../src/accountValuation";
import { computeBalanceAfter, type TransactionType } from "../../src/transactionBalance";
import { computeQuantityAfter, resolveLotPrice } from "../../src/holdingLot";
import { findOrCreateHolding, syncHoldingQuantity } from "../../src/holdings";
import { revalueManualAccount } from "../../src/manualAccountRevalue";
import type { EodBar } from "../../src/marketData";
import {
  BANK_HISTORY_MONTHS,
  BROKER_CASH_RESERVE_FRACTION,
  BROKERAGE_TRADES_PER_INSTRUMENT,
  DEMO_HISTORY_DAYS,
  DEMO_MONTHLY_EXPENSE_PLN,
  DEMO_QUARTERLY_INVESTMENT_PLN,
  DEMO_SALARY_BASE_PLN,
  DEMO_SALARY_STEP_PLN,
  DEMO_SALARY_VARIETY,
  type DemoInstrumentSpec,
  METAL_GRAMS,
  TROY_OZ_GRAMS,
} from "./seedConfig";
import { closeOnDate, persistInstrumentEodBars, utcDateOnly } from "./marketHistory";
import { daysAgo, planBrokerageTrades, type PlannedLot } from "./tradePlanner";

export { daysAgo };

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

export async function seedHoldingLots(
  prisma: PrismaClient,
  accountId: number,
  instrumentId: number,
  currency: string,
  lots: PlannedLot[],
  initialCash: number,
): Promise<number> {
  const sorted = [...lots].sort(
    (a, b) => a.tradeDate.getTime() - b.tradeDate.getTime(),
  );
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
        tradeDate: lot.tradeDate,
      },
    });
  }

  await syncHoldingQuantity(prisma, holding.id);
  await prisma.account.update({ where: { id: accountId }, data: { cashBalance: cash } });
  return cash;
}

export async function seedBrokerageFromMarket(
  prisma: PrismaClient,
  accountId: number,
  funding: number,
  currency: string,
  fundingDays: number,
  instruments: DemoInstrumentSpec[],
  barsByProviderSymbol: Map<string, EodBar[]>,
  providerSymbolFor: (spec: DemoInstrumentSpec) => string | null,
): Promise<void> {
  await seedTransferIn(prisma, accountId, funding, currency, fundingDays);
  let cash = funding;

  for (let i = 0; i < instruments.length; i++) {
    const spec = instruments[i]!;
    const providerSymbol = providerSymbolFor(spec);
    if (!providerSymbol) {
      throw new Error(`Unmapped instrument ${spec.symbol} (${spec.exchange})`);
    }
    const bars = barsByProviderSymbol.get(providerSymbol);
    if (!bars?.length) {
      throw new Error(`No EOD bars for ${providerSymbol}`);
    }

    const instrument = await upsertInstrument(prisma, spec);
    await persistInstrumentEodBars(prisma, instrument.id, spec.currency, bars);

    const lots = planBrokerageTrades(
      bars,
      DEMO_HISTORY_DAYS,
      BROKERAGE_TRADES_PER_INSTRUMENT,
      i,
      { investHeavy: true },
    );
    if (!lots.length) {
      throw new Error(`No trades planned for ${spec.symbol}`);
    }
    cash = await seedHoldingLots(prisma, accountId, instrument.id, spec.currency, lots, cash);
  }

  if (instruments.length > 0) {
    const primary = instruments[0]!;
    const providerSymbol = providerSymbolFor(primary);
    const bars = providerSymbol ? barsByProviderSymbol.get(providerSymbol) : undefined;
    const instrument = await prisma.instrument.findFirst({
      where: { symbol: primary.symbol, exchange: primary.exchange },
    });
    if (bars?.length && instrument) {
      cash = await sweepBrokerCashIntoHoldings(
        prisma,
        accountId,
        instrument.id,
        currency,
        bars,
        cash,
      );
    }
  }
}

export type BankTxTemplate = {
  transactionType: TransactionType;
  amount: number;
  categoryName: string;
  days: number;
  description?: string;
};

const MONTHLY_EXPENSE_LINES: Array<{ categoryName: string; share: number }> = [
  { categoryName: "Food", share: 0.18 },
  { categoryName: "Transport", share: 0.12 },
  { categoryName: "Shopping", share: 0.2 },
  { categoryName: "Utilities", share: 0.15 },
  { categoryName: "Entertainment", share: 0.1 },
  { categoryName: "Healthcare", share: 0.09 },
  { categoryName: "Other", share: 0.16 },
];

export function buildBankMonthTemplates(months: number): BankTxTemplate[] {
  const templates: BankTxTemplate[] = [];

  for (let m = 0; m < months; m++) {
    const salary =
      DEMO_SALARY_BASE_PLN + (m % (DEMO_SALARY_VARIETY + 1)) * DEMO_SALARY_STEP_PLN;
    templates.push({
      transactionType: "INCOME",
      amount: salary,
      categoryName: "Salary",
      days: m * 30 + 3,
      description: "Wynagrodzenie netto",
    });

    const monthExpenseTotal =
      DEMO_MONTHLY_EXPENSE_PLN + (m % 4) * 150 + (m % 3) * 100;
    const expenseAmounts = MONTHLY_EXPENSE_LINES.map((line, i) =>
      i < MONTHLY_EXPENSE_LINES.length - 1
        ? Math.round(monthExpenseTotal * line.share)
        : 0,
    );
    const allocated = expenseAmounts.reduce((s, v) => s + v, 0);
    expenseAmounts[MONTHLY_EXPENSE_LINES.length - 1] = monthExpenseTotal - allocated;

    let dayInMonth = 5;
    for (let i = 0; i < MONTHLY_EXPENSE_LINES.length; i++) {
      const line = MONTHLY_EXPENSE_LINES[i]!;
      templates.push({
        transactionType: "EXPENSE",
        amount: expenseAmounts[i]!,
        categoryName: line.categoryName,
        days: m * 30 + dayInMonth,
        description: `Wydatek — ${line.categoryName}`,
      });
      dayInMonth += 4;
    }
  }

  const quarters = Math.floor(months / 3);
  for (let q = 0; q < quarters; q++) {
    const amount = DEMO_QUARTERLY_INVESTMENT_PLN + (q % 3) * 2_000;
    templates.push({
      transactionType: "TRANSFER_OUT",
      amount,
      categoryName: "Other",
      days: q * 90 + 26,
      description: "Kwartalna alokacja oszczędności — giełda i obligacje",
    });
  }

  return templates;
}

export type QuarterlyBrokerAllocation = {
  accountId: number;
  currency: string;
  amount: number;
  instrument: DemoInstrumentSpec;
};

export async function seedQuarterlyBrokerInvestments(
  prisma: PrismaClient,
  quarterIndex: number,
  daysAgoOffset: number,
  allocations: QuarterlyBrokerAllocation[],
  barsByProviderSymbol: Map<string, EodBar[]>,
  providerSymbolFor: (spec: DemoInstrumentSpec) => string | null,
): Promise<void> {
  for (const alloc of allocations) {
    if (alloc.amount <= 0) continue;

    const account = await prisma.account.findUniqueOrThrow({ where: { id: alloc.accountId } });
    let cash = Number(account.cashBalance) + alloc.amount;

    await prisma.transaction.create({
      data: {
        accountId: alloc.accountId,
        transactionType: "TRANSFER_IN",
        amount: alloc.amount,
        balanceAfter: cash,
        currency: alloc.currency,
        category: "INVESTMENT",
        date: daysAgo(daysAgoOffset),
        description: `Kwartalna wpłata — Q${quarterIndex + 1}`,
      },
    });

    const tradeDate = daysAgo(daysAgoOffset);
    const instrument = await upsertInstrument(prisma, alloc.instrument);

    if (alloc.instrument.instrumentType.toUpperCase() === "BOND") {
      const pricePerUnit = 100 + quarterIndex * 0.15;
      const qty = Math.floor((alloc.amount * 0.96) / pricePerUnit);
      if (qty > 0) {
        await seedHoldingLots(
          prisma,
          alloc.accountId,
          instrument.id,
          alloc.currency,
          [{ side: "BUY", quantity: qty, pricePerUnit, tradeDate }],
          cash,
        );
      }
      continue;
    }

    const providerSymbol = providerSymbolFor(alloc.instrument);
    const bars = providerSymbol ? barsByProviderSymbol.get(providerSymbol) : undefined;
    if (!bars?.length) continue;

    const close = closeOnDate(bars, tradeDate) ?? bars[bars.length - 1]?.close;
    if (close == null) continue;

    const deployCash = alloc.amount * (1 - BROKER_CASH_RESERVE_FRACTION);
    const qty = Math.max(1, Math.floor(deployCash / close));
    await seedHoldingLots(
      prisma,
      alloc.accountId,
      instrument.id,
      alloc.currency,
      [{ side: "BUY", quantity: qty, pricePerUnit: close, tradeDate }],
      cash,
    );
  }
}

export async function seedManualBondValuations(
  prisma: PrismaClient,
  instrumentId: number,
  currency: string,
  basePrice: number,
): Promise<void> {
  const step = 45;
  for (let day = DEMO_HISTORY_DAYS; day >= 0; day -= step) {
    const drift = ((DEMO_HISTORY_DAYS - day) / 365) * 2.5;
    const price = Math.round((basePrice + drift) * 100) / 100;
    const valuationDate = daysAgo(day);
    await prisma.instrumentValuation.upsert({
      where: {
        instrumentId_valuationDate_source: {
          instrumentId,
          valuationDate,
          source: "manual",
        },
      },
      create: {
        instrumentId,
        valuationDate,
        price,
        currency,
        source: "manual",
      },
      update: { price },
    });
  }
}

async function sweepBrokerCashIntoHoldings(
  prisma: PrismaClient,
  accountId: number,
  instrumentId: number,
  currency: string,
  bars: EodBar[],
  cash: number,
): Promise<number> {
  const reserve = Math.max(0, cash * BROKER_CASH_RESERVE_FRACTION);
  const deploy = cash - reserve;
  if (deploy < 50) return cash;

  const close = closeOnDate(bars, new Date()) ?? bars[bars.length - 1]?.close;
  if (close == null || close <= 0) return cash;

  const qty = Math.floor(deploy / close);
  if (qty < 1) return cash;

  return seedHoldingLots(
    prisma,
    accountId,
    instrumentId,
    currency,
    [{ side: "BUY", quantity: qty, pricePerUnit: close, tradeDate: daysAgo(3) }],
    cash,
  );
}

export async function loadCategoryIdMap(
  prisma: PrismaClient,
  userId: number,
): Promise<Map<string, number>> {
  const cats = await prisma.category.findMany({ where: { userId } });
  return new Map(cats.map((c) => [c.name, c.id]));
}

export async function seedBankTransactions(
  prisma: PrismaClient,
  accountId: number,
  currency: string,
  openingBalance: number,
  templates: BankTxTemplate[],
  categoryIds: Map<string, number>,
): Promise<number> {
  const sorted = [...templates].sort((a, b) => a.days - b.days);
  let cash = openingBalance;

  for (const tx of sorted) {
    cash = computeBalanceAfter(cash, tx.transactionType, tx.amount);
    const categoryId = categoryIds.get(tx.categoryName) ?? null;
    await prisma.transaction.create({
      data: {
        accountId,
        transactionType: tx.transactionType,
        amount: tx.amount,
        balanceAfter: cash,
        currency,
        category: tx.categoryName.toUpperCase(),
        categoryId,
        date: daysAgo(tx.days),
        description: tx.description ?? tx.categoryName,
      },
    });
  }

  await prisma.account.update({ where: { id: accountId }, data: { cashBalance: cash } });
  return cash;
}

export async function seedRealEstateAccount(
  prisma: PrismaClient,
  userId: number,
  accountId: number,
  plnPerUnit: Record<string, number>,
): Promise<void> {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  const baseValue = 850_000;
  const annualGrowth = 0.03;
  const quarters = Math.floor(DEMO_HISTORY_DAYS / 90);
  let currentAccount = account;

  for (let q = quarters; q >= 0; q--) {
    const daysBack = q * 90 + 5;
    const yearsFromStart = (DEMO_HISTORY_DAYS - daysBack) / 365;
    const value = Math.round(baseValue * (1 + annualGrowth * yearsFromStart));
    const valuedOn = daysAgo(daysBack);

    await prisma.assetValuation.create({
      data: {
        userId,
        accountId,
        valuedOn,
        value,
        currency: "PLN",
        source: "manual",
        description: "Quarterly property valuation",
      },
    });

    currentAccount = await revalueManualAccount(
      prisma,
      currentAccount,
      value,
      valuedOn,
      plnPerUnit,
      {
        recalcTransactionBalances,
        recomputeAccountValuationsFrom,
      },
    );
  }

  for (let m = 0; m < BANK_HISTORY_MONTHS; m++) {
    await prisma.propertyCashFlow.create({
      data: {
        userId,
        accountId,
        flowType: "rent",
        amount: 3_200,
        currency: "PLN",
        occurredOn: daysAgo(m * 30 + 8),
        description: "Monthly rent",
      },
    });
  }

  for (let y = 0; y < 2; y++) {
    await prisma.propertyCashFlow.create({
      data: {
        userId,
        accountId,
        flowType: "maintenance",
        amount: 2_500,
        currency: "PLN",
        occurredOn: daysAgo(y * 365 + 180),
        description: "Annual maintenance",
      },
    });
  }
}

export async function seedPreciousMetalAccount(
  prisma: PrismaClient,
  accountId: number,
  xauBars: EodBar[],
  plnPerUnit: Record<string, number>,
): Promise<void> {
  const goldSpec = {
    symbol: "XAU",
    exchange: "COMEX",
    instrumentType: "GOLD",
    name: "Gold spot",
    currency: "USD",
  };
  const instrument = await upsertInstrument(prisma, goldSpec);
  await persistInstrumentEodBars(prisma, instrument.id, "USD", xauBars);

  const buyDate = daysAgo(60);
  const buyPrice = closeOnDate(xauBars, buyDate) ?? xauBars[xauBars.length - 1]?.close;
  if (buyPrice == null) {
    throw new Error("No XAU price for initial buy");
  }

  const troyOz = METAL_GRAMS / TROY_OZ_GRAMS;
  const funding = Math.ceil(buyPrice * troyOz * 1.2);
  await seedTransferIn(prisma, accountId, funding, "USD", 90);
  await seedHoldingLots(
    prisma,
    accountId,
    instrument.id,
    "USD",
    [{ side: "BUY", quantity: troyOz, pricePerUnit: buyPrice, tradeDate: buyDate }],
    funding,
  );

  await prisma.account.update({
    where: { id: accountId },
    data: { metalGrams: METAL_GRAMS },
  });

  await backfillAccountValuations(prisma, accountId, plnPerUnit);
}

export async function seedMvpExtras(
  prisma: PrismaClient,
  userId: number,
  opts: {
    bankAccountId: number;
    usBrokerId: number;
    euBrokerId: number;
    ikzeBrokerId: number;
    realEstateAccountId: number;
    categoryIds: Map<string, number>;
    euInstrumentId: number;
    gpwBondInstrumentId: number;
    gpwBrokerId: number;
  },
): Promise<void> {
  const currentYear = new Date().getUTCFullYear();

  await prisma.liability.createMany({
    data: [
      {
        userId,
        accountId: opts.realEstateAccountId,
        name: "Mortgage — Warsaw apartment",
        liabilityType: "mortgage",
        balance: 420_000,
        currency: "PLN",
      },
      {
        userId,
        name: "Credit card",
        liabilityType: "credit",
        balance: 4_500,
        currency: "PLN",
      },
    ],
  });

  const budgetCategories = ["Food", "Transport", "Shopping"];
  const now = new Date();
  for (let m = 0; m < 12; m++) {
    const budgetMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1));
    for (const catName of budgetCategories) {
      const categoryId = opts.categoryIds.get(catName);
      if (!categoryId) continue;
      const amounts: Record<string, number> = {
        Food: 1_600,
        Transport: 900,
        Shopping: 1_800,
      };
      await prisma.budget.create({
        data: {
          userId,
          categoryId,
          budgetMonth,
          amount: amounts[catName] ?? 500,
          currency: "PLN",
        },
      });
    }
  }

  await prisma.incomeEvent.createMany({
    data: [
      {
        userId,
        accountId: opts.bankAccountId,
        eventType: "interest",
        taxType: "belka",
        amount: 45,
        currency: "PLN",
        occurredOn: daysAgo(60),
        description: "Savings interest",
        withheldTax: 8.55,
      },
      {
        userId,
        accountId: opts.usBrokerId,
        eventType: "dividend",
        taxType: "pit38",
        amount: 120,
        currency: "USD",
        occurredOn: daysAgo(90),
        description: "AAPL dividend",
        sourceCountry: "US",
        foreignTaxPaid: 18,
      },
      {
        userId,
        accountId: opts.usBrokerId,
        eventType: "dividend",
        taxType: "pit38",
        amount: 85,
        currency: "USD",
        occurredOn: daysAgo(200),
        description: "MSFT dividend",
        sourceCountry: "US",
        foreignTaxPaid: 12.75,
      },
    ],
  });

  await prisma.ikzeContribution.create({
    data: {
      userId,
      accountId: opts.ikzeBrokerId,
      taxYear: currentYear - 1,
      amount: 8_000,
      currency: "PLN",
      contributedOn: daysAgo(120),
    },
  });

  await prisma.taxLossCarryforward.create({
    data: {
      userId,
      taxYear: currentYear - 1,
      lossAmount: 3_500,
      usedAmount: 0,
      note: "Carryforward from prior-year equity losses",
    },
  });

  await prisma.couponSchedule.create({
    data: {
      userId,
      accountId: opts.gpwBrokerId,
      instrumentId: opts.gpwBondInstrumentId,
      scheduleType: "coupon",
      paymentOn: daysAgo(50),
      amount: 280,
      currency: "PLN",
      description: "EDO odsetki kwartalne",
    },
  });
}
