import type { PrismaClient } from "@prisma/client";
import { convertAmount } from "./fx";
import { computeFifoRealizedEvents, type RealizedGainEvent } from "./fifoRealizedPnl";
import { isBelkaIncomeEvent } from "./incomeEvents";
import {
  accountIncludedInPit38,
  fetchWithdrawalsForTaxYear,
  isTaxAdvantagedWrapper,
} from "./taxWrapper";
import {
  applyLossCarryforward,
  listTaxLossCarryforwards,
  remainingLoss,
  suggestLossRowForYear,
} from "./taxLossCarryforward";
import { computeRentalTaxableBase, parseRentalTaxMethod, type RentalTaxMethod } from "./propertySales";
import { toNumber } from "./accountValuation";

const BELKA_RATE = 0.19;
const DERIVATIVE_TYPES = new Set(["FUTURES", "OPTION", "OPTIONS", "CFD", "CFDS"]);

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
  instrumentType: string;
  pitZgCountry: string;
};

export type TaxReportWarning = {
  accountId: number;
  accountName: string;
  symbol: string;
  holdingId: number;
  message: string;
};

export type BelkaTaxRow = {
  occurredOn: string;
  accountName: string;
  eventType: string;
  amount: number;
  withheldTax: number;
  currency: string;
};

export type BelkaSection = {
  interestGross: number;
  withheldTax: number;
  estimatedBelkaDue: number;
  rows: BelkaTaxRow[];
};

export type PitZgRow = {
  country: string;
  symbol: string | null;
  incomeGross: number;
  withheldTax: number;
  foreignTaxPaid: number;
};

export type DerivativesSection = {
  sellCount: number;
  message: string;
};

export type RentalAccountRow = {
  accountId: number;
  accountName: string;
  rentalTaxMethod: RentalTaxMethod;
  rentalIncome: number;
  maintenanceCosts: number;
  taxableBase: number;
};

export type RentalSection = {
  available: boolean;
  rentalIncome: number;
  maintenanceCosts: number;
  taxableBase: number;
  byAccount: RentalAccountRow[];
  message: string;
};

export type LossCarryforwardSection = {
  rows: Array<{
    taxYear: number;
    lossAmount: number;
    usedAmount: number;
    remainingAmount: number;
    note: string | null;
  }>;
  appliedThisYear: Array<{ taxYear: number; amount: number }>;
  remainingTotal: number;
  suggestedNewLoss: { taxYear: number; lossAmount: number } | null;
};

export type TaxReport = {
  taxYear: number;
  displayCurrency: string;
  realizedGains: number;
  realizedLosses: number;
  netRealized: number;
  netRealizedAfterLosses: number;
  lossAppliedTotal: number;
  estimatedPit38Tax: number;
  estimatedBelka: number;
  dividendsGross: number;
  byAccount: Array<{ accountId: number; name: string; netRealized: number }>;
  byInstrument: Array<{ symbol: string; netRealized: number }>;
  sellRows: TaxSellRow[];
  warnings: TaxReportWarning[];
  belka: BelkaSection;
  pitZg: PitZgRow[];
  derivatives: DerivativesSection;
  rental: RentalSection;
  lossCarryforward: LossCarryforwardSection;
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

function isDerivativeInstrumentType(value: string): boolean {
  return DERIVATIVE_TYPES.has(value.trim().toUpperCase());
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
  const header =
    "saleDate,symbol,account,quantity,proceeds,cost,gainLoss,currency,instrumentType,pitZgCountry";
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
      r.instrumentType,
      r.pitZgCountry,
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

function buildBelkaSection(
  incomeRows: Array<{
    occurredOn: Date;
    eventType: string;
    taxType: string | null;
    amount: unknown;
    currency: string;
    withheldTax: unknown;
    account: { name: string };
  }>,
  interestTransactions: Array<{
    date: Date;
    amount: unknown;
    currency: string;
    account: { name: string };
  }>,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): BelkaSection {
  const rows: BelkaTaxRow[] = [];
  let interestGross = 0;
  let withheldTax = 0;

  for (const row of incomeRows) {
    if (!isBelkaIncomeEvent(row.eventType, row.taxType)) continue;
    const amount = convertGain(toNumber(row.amount), row.currency, displayCurrency, plnPerUnit);
    const withheld = convertGain(
      toNumber(row.withheldTax ?? 0),
      row.currency,
      displayCurrency,
      plnPerUnit,
    );
    interestGross += amount;
    withheldTax += withheld;
    rows.push({
      occurredOn: row.occurredOn.toISOString(),
      accountName: row.account.name,
      eventType: row.eventType,
      amount,
      withheldTax: withheld,
      currency: displayCurrency,
    });
  }

  if (rows.length === 0) {
    for (const row of interestTransactions) {
      const amount = convertGain(toNumber(row.amount), row.currency, displayCurrency, plnPerUnit);
      interestGross += amount;
      rows.push({
        occurredOn: row.date.toISOString(),
        accountName: row.account.name,
        eventType: "interest",
        amount,
        withheldTax: 0,
        currency: displayCurrency,
      });
    }
  }

  const estimatedBelkaDue = Math.max(0, interestGross * BELKA_RATE - withheldTax);
  return { interestGross, withheldTax, estimatedBelkaDue, rows };
}

function buildPitZgRows(
  incomeRows: Array<{
    eventType: string;
    amount: unknown;
    currency: string;
    withheldTax: unknown;
    foreignTaxPaid: unknown;
    sourceCountry: string | null;
    instrument: { symbol: string; pitZgCountry: string } | null;
  }>,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): PitZgRow[] {
  const byKey = new Map<string, PitZgRow>();
  for (const row of incomeRows) {
    const country = (
      row.sourceCountry ??
      row.instrument?.pitZgCountry ??
      "PL"
    ).toUpperCase();
    if (country === "PL") continue;
    const symbol = row.instrument?.symbol ?? null;
    const key = `${country}|${symbol ?? ""}`;
    const amount = convertGain(toNumber(row.amount), row.currency, displayCurrency, plnPerUnit);
    const withheld = convertGain(
      toNumber(row.withheldTax ?? 0),
      row.currency,
      displayCurrency,
      plnPerUnit,
    );
    const foreignPaid = convertGain(
      toNumber(row.foreignTaxPaid ?? 0),
      row.currency,
      displayCurrency,
      plnPerUnit,
    );
    const existing = byKey.get(key) ?? {
      country,
      symbol,
      incomeGross: 0,
      withheldTax: 0,
      foreignTaxPaid: 0,
    };
    existing.incomeGross += amount;
    existing.withheldTax += withheld;
    existing.foreignTaxPaid += foreignPaid;
    byKey.set(key, existing);
  }
  return [...byKey.values()].sort((a, b) => a.country.localeCompare(b.country));
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

  const withdrawalsByAccount = await fetchWithdrawalsForTaxYear(prisma, userId, taxYear);

  const sellRows: TaxSellRow[] = [];
  const warnings: TaxReportWarning[] = [];
  const byAccountMap = new Map<number, { name: string; net: number }>();
  const byInstrumentMap = new Map<string, number>();
  let derivativeSellCount = 0;

  for (const account of accounts) {
    const withdrawals = withdrawalsByAccount.get(account.id) ?? [];
    const includeAccount = accountIncludedInPit38(account.taxWrapperType, withdrawals);
    if (!includeAccount) {
      if (isTaxAdvantagedWrapper(account.taxWrapperType) && account.holdings.length > 0) {
        warnings.push({
          accountId: account.id,
          accountName: account.name,
          symbol: "*",
          holdingId: 0,
          message: `Account excluded from PIT-38 (${account.taxWrapperType.toUpperCase()}) — no qualifying withdrawal in ${taxYear}`,
        });
      }
      byAccountMap.set(account.id, { name: account.name, net: 0 });
      continue;
    }

    let accountNet = 0;
    for (const holding of account.holdings) {
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
        const settlementDate = settlementByLotId.get(event.lotId);
        const taxDate = settlementDate ?? event.tradeDate;
        if (!inTaxYear(taxDate, taxYear)) continue;
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

        if (isDerivativeInstrumentType(holding.instrument.instrumentType)) {
          derivativeSellCount++;
        }

        sellRows.push({
          saleDate: taxDate.toISOString(),
          symbol,
          accountId: account.id,
          accountName: account.name,
          quantity: event.quantity,
          proceeds: proceedsDisplay,
          cost: costDisplay,
          gainLoss: gainDisplay,
          currency: displayCurrency,
          instrumentType: holding.instrument.instrumentType,
          pitZgCountry: holding.instrument.pitZgCountry ?? "PL",
        });
      }
    }
    byAccountMap.set(account.id, { name: account.name, net: accountNet });
  }

  sellRows.sort((a, b) => a.saleDate.localeCompare(b.saleDate));

  const { start, end } = taxYearBounds(taxYear);
  const incomeEvents = await prisma.incomeEvent.findMany({
    where: {
      userId,
      occurredOn: { gte: start, lte: end },
    },
    include: {
      account: { select: { name: true } },
      instrument: { select: { symbol: true, pitZgCountry: true } },
    },
  });

  const dividendEvents = incomeEvents.filter((row) => row.eventType === "dividend");
  let dividendsGross = 0;
  if (dividendEvents.length > 0) {
    for (const row of dividendEvents) {
      dividendsGross += convertGain(
        toNumber(row.amount),
        row.currency,
        displayCurrency,
        plnPerUnit,
      );
    }
  } else {
    const dividendRows = await prisma.transaction.findMany({
      where: {
        transactionType: "DIVIDEND",
        date: { gte: start, lte: end },
        account: { userId },
      },
    });
    for (const row of dividendRows) {
      dividendsGross += convertGain(
        toNumber(row.amount),
        row.currency,
        displayCurrency,
        plnPerUnit,
      );
    }
  }

  const interestTransactions = await prisma.transaction.findMany({
    where: {
      transactionType: "INTEREST",
      date: { gte: start, lte: end },
      account: { userId },
    },
    include: { account: { select: { name: true } } },
  });

  const belka = buildBelkaSection(
    incomeEvents,
    interestTransactions,
    displayCurrency,
    plnPerUnit,
  );
  const pitZg = buildPitZgRows(incomeEvents, displayCurrency, plnPerUnit);

  const propertyFlows = await prisma.propertyCashFlow.findMany({
    where: {
      userId,
      occurredOn: { gte: start, lte: end },
      account: { accountType: "REAL_ESTATE" },
    },
    include: { account: { select: { id: true, name: true, rentalTaxMethod: true } } },
  });
  const rentalByAccount = new Map<
    number,
    { accountName: string; method: RentalTaxMethod; rent: number; maintenance: number }
  >();
  for (const flow of propertyFlows) {
    const amount = convertGain(toNumber(flow.amount), flow.currency, displayCurrency, plnPerUnit);
    const method = parseRentalTaxMethod(flow.account.rentalTaxMethod ?? "scale");
    const entry = rentalByAccount.get(flow.accountId) ?? {
      accountName: flow.account.name,
      method,
      rent: 0,
      maintenance: 0,
    };
    if (flow.flowType === "rent") entry.rent += amount;
    else if (flow.flowType === "maintenance") entry.maintenance += amount;
    rentalByAccount.set(flow.accountId, entry);
  }
  const rentalByAccountRows: RentalAccountRow[] = [...rentalByAccount.entries()].map(
    ([accountId, row]) => {
      const taxableBase = computeRentalTaxableBase(row.method, row.rent, row.maintenance);
      return {
        accountId,
        accountName: row.accountName,
        rentalTaxMethod: row.method,
        rentalIncome: row.rent,
        maintenanceCosts: row.maintenance,
        taxableBase,
      };
    },
  );
  let rentalIncome = 0;
  let maintenanceCosts = 0;
  let rentalTaxableBase = 0;
  for (const row of rentalByAccountRows) {
    rentalIncome += row.rentalIncome;
    maintenanceCosts += row.maintenanceCosts;
    rentalTaxableBase += row.taxableBase;
  }
  const hasRentalData = propertyFlows.length > 0;

  const totals = aggregateRealizedAmounts(sellRows.map((r) => r.gainLoss));

  const lossRows = await listTaxLossCarryforwards(prisma, userId);
  const lossInputs = lossRows.map((row) => ({
    taxYear: row.taxYear,
    lossAmount: toNumber(row.lossAmount),
    usedAmount: toNumber(row.usedAmount),
  }));
  const { taxableGain: netRealizedAfterLosses, applied } = applyLossCarryforward(
    totals.netRealized,
    lossInputs,
  );
  const lossAppliedTotal = applied.reduce((sum, row) => sum + row.amount, 0);
  const remainingTotal = lossInputs.reduce(
    (sum, row) => sum + remainingLoss(row.lossAmount, row.usedAmount),
    0,
  );
  const estimatedPit38Tax = Math.max(0, netRealizedAfterLosses) * BELKA_RATE;

  return {
    taxYear,
    displayCurrency,
    ...totals,
    netRealizedAfterLosses,
    lossAppliedTotal,
    estimatedPit38Tax,
    estimatedBelka: estimatedPit38Tax,
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
    belka,
    pitZg,
    derivatives: {
      sellCount: derivativeSellCount,
      message:
        derivativeSellCount > 0
          ? "Derivative instruments detected — review PIT-38 mapping manually (FR-025)."
          : "No derivative sells in this year.",
    },
    rental: {
      available: hasRentalData,
      rentalIncome,
      maintenanceCosts,
      taxableBase: rentalTaxableBase,
      byAccount: rentalByAccountRows,
      message: hasRentalData
        ? "PIT-36 rental helper — respects rental tax method per property (FR-026, FR-044)."
        : "Add rental/maintenance flows on real estate accounts (FR-030).",
    },
    lossCarryforward: {
      rows: lossRows.map((row) => ({
        taxYear: row.taxYear,
        lossAmount: toNumber(row.lossAmount),
        usedAmount: toNumber(row.usedAmount),
        remainingAmount: remainingLoss(toNumber(row.lossAmount), toNumber(row.usedAmount)),
        note: row.note,
      })),
      appliedThisYear: applied,
      remainingTotal,
      suggestedNewLoss: suggestLossRowForYear(taxYear, totals.netRealized),
    },
  };
}

export function parseTaxYear(value: unknown): number {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("year must be an integer between 2000 and 2100");
  }
  return year;
}
