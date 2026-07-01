import type { PrismaClient } from "@prisma/client";
import { toNumber } from "../accountValuation";
import { convertAmount } from "../fx";
import { computeCryptoTaxSection } from "./cryptoTax";
import { aggregatePropertySalesForYear } from "../propertySales";
import { computeTaxReport, type TaxReport } from "./taxReport";
import {
  correctionBannerMessage,
  getLatestTaxReportSnapshot,
  hasInvalidatedTaxYear,
  saveTaxReportSnapshot,
} from "./taxReportCache";
import { listTaxWrapperWithdrawals, serializeTaxWrapperWithdrawal } from "./taxWrapper";

const BELKA_RATE = 0.19;

export type TaxOverview = {
  taxYear: number;
  displayCurrency: string;
  pit38: TaxReport;
  crypto: Awaited<ReturnType<typeof computeCryptoTaxSection>>;
  propertySales: Awaited<ReturnType<typeof aggregatePropertySalesForYear>>;
  wrapperWithdrawals: ReturnType<typeof serializeTaxWrapperWithdrawal>[];
  taxLiabilities: {
    advancesPaid: number;
    provisions: number;
    netAdvances: number;
  };
  estimatedTotalTaxDue: number;
  correction: {
    needed: boolean;
    message: string | null;
    previousSnapshotAt: string | null;
  };
};

function taxYearBounds(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

export async function computeTaxOverview(
  prisma: PrismaClient,
  userId: number,
  taxYear: number,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
  options?: { persistSnapshot?: boolean },
): Promise<TaxOverview> {
  const pit38 = await computeTaxReport(prisma, userId, taxYear, displayCurrency, plnPerUnit);
  const crypto = await computeCryptoTaxSection(prisma, userId, taxYear, displayCurrency, plnPerUnit);
  const propertySales = await aggregatePropertySalesForYear(
    prisma,
    userId,
    taxYear,
    displayCurrency,
    plnPerUnit,
  );

  const { start, end } = taxYearBounds(taxYear);
  const [withdrawalRows, liabilities, correctionNeeded, previousSnapshot] = await Promise.all([
    listTaxWrapperWithdrawals(prisma, userId, { from: start, to: end }),
    prisma.liability.findMany({ where: { userId } }),
    hasInvalidatedTaxYear(prisma, userId, taxYear),
    getLatestTaxReportSnapshot(prisma, userId, taxYear),
  ]);

  let advancesPaid = 0;
  let provisions = 0;
  for (const row of liabilities) {
    const balance = convertAmount(toNumber(row.balance), row.currency, displayCurrency, plnPerUnit);
    if (row.liabilityType === "tax_advance") advancesPaid += balance;
    else if (row.liabilityType === "tax_provision") provisions += balance;
  }

  const pit38Tax = pit38.estimatedPit38Tax;
  const belkaTax = pit38.belka.estimatedBelkaDue;
  const propertyTaxEstimate = Math.max(0, propertySales.totalTaxableGain) * BELKA_RATE;
  const estimatedTotalTaxDue = Math.max(
    0,
    pit38Tax + belkaTax + propertyTaxEstimate - advancesPaid,
  );

  const overview: TaxOverview = {
    taxYear,
    displayCurrency,
    pit38,
    crypto,
    propertySales,
    wrapperWithdrawals: withdrawalRows.map(serializeTaxWrapperWithdrawal),
    taxLiabilities: {
      advancesPaid,
      provisions,
      netAdvances: advancesPaid,
    },
    estimatedTotalTaxDue,
    correction: {
      needed: correctionNeeded,
      message: correctionNeeded ? correctionBannerMessage(taxYear) : null,
      previousSnapshotAt: previousSnapshot?.computedAt.toISOString() ?? null,
    },
  };

  if (options?.persistSnapshot) {
    await saveTaxReportSnapshot(prisma, userId, taxYear, {
      estimatedTotalTaxDue,
      netRealizedAfterLosses: pit38.netRealizedAfterLosses,
      cryptoNet: crypto.netRealized,
      propertySalesGain: propertySales.totalTaxableGain,
    });
  }

  return overview;
}

export function formatCryptoTaxCsv(
  rows: TaxOverview["crypto"]["sellRows"],
): string {
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
