import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import type { TransactionDateFilter } from "./routeSupport";
import {
  computeCashflowStats,
  computeCashflowHistory,
  computeCategoryBreakdown,
  computeRollingMonthlyAverages,
  enumerateCalendarMonths,
  fetchUserTransactions,
  last12CompleteCalendarMonths,
  requireTransactionDateFilter,
} from "../stats";
import {
  computeBenchmarkComparison,
  computePortfolioHistory,
  computePortfolioSummary,
  computeUserAverageHoldingReturn,
} from "../portfolioStats";
import { parseBenchmarkId } from "../benchmarks";
import {
  computeTaxReport,
  formatTaxReportCsv,
  parseTaxYear,
} from "../tax/taxReport";
import { computeTaxOverview, formatCryptoTaxCsv } from "../tax/taxOverview";
import { simulatePreSellTax } from "../tax/preSellSimulator";
import { badRequest, handleRouteError } from "./httpSupport";

type StatsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  normalizeCurrency: (value: unknown) => string;
  transactionDateFilter: TransactionDateFilter;
  toNumber: (value: unknown) => number;
  convertAmount: (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    plnPerUnit: Record<string, number>,
  ) => number;
  getFxRatesPlnPerUnit: () => Promise<{ asOf: string; plnPerUnit: Record<string, number> }>;
  computeNetWorth: (
    prisma: PrismaClient,
    userId: number,
    displayCurrency: string,
  ) => Promise<{
    total: number;
    currency: string;
    byAccountType: Record<string, number>;
    byBucket: Array<{ bucket: string; value: number; pct: number }>;
    accounts: Array<{ id: number; name: string; accountType: string; value: number }>;
  }>;
};

export function createStatsRouter(deps: StatsDeps): Router {
  const router = Router();
  const {
    prisma,
    requireAuth,
    uid,
    normalizeCurrency,
    transactionDateFilter,
    toNumber,
    convertAmount,
    getFxRatesPlnPerUnit,
    computeNetWorth,
  } = deps;

  router.get("/api/stats/net-worth", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      const data = await computeNetWorth(prisma, uid(req), currency);
      res.json(data);
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load net worth");
    }
  });

  router.get("/api/stats/average-holding-return", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const data = await computeUserAverageHoldingReturn(prisma, uid(req), currency, plnPerUnit);
      res.json(data);
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load average holding return");
    }
  });

  router.get("/api/stats/cashflow", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const date = requireTransactionDateFilter(transactionDateFilter, req.query.from, req.query.to);
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const rows = await fetchUserTransactions(prisma, uid(req), date);
      res.json(computeCashflowStats(rows, currency, convertAmount, toNumber, plnPerUnit));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load cashflow");
    }
  });

  router.get("/api/stats/cashflow-history", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const date = requireTransactionDateFilter(transactionDateFilter, req.query.from, req.query.to);
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const rows = await fetchUserTransactions(prisma, uid(req), date);
      const months =
        date.gte && date.lte ? enumerateCalendarMonths(date.gte, date.lte) : [];
      const points = computeCashflowHistory(
        rows,
        months,
        currency,
        convertAmount,
        toNumber,
        plnPerUnit,
      );
      res.json({ currency, points });
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load cashflow history");
    }
  });

  router.get("/api/stats/cashflow-rolling-12m", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const { from, to, months } = last12CompleteCalendarMonths();
      const rows = await fetchUserTransactions(prisma, uid(req), { gte: from, lte: to });
      const points = computeCashflowHistory(
        rows,
        months,
        currency,
        convertAmount,
        toNumber,
        plnPerUnit,
      );
      const averages = computeRollingMonthlyAverages(points);
      res.json({ currency, months: months.length, ...averages });
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load rolling cashflow averages");
    }
  });

  router.get("/api/stats/expenses-by-category", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const date = requireTransactionDateFilter(transactionDateFilter, req.query.from, req.query.to);
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const rows = await fetchUserTransactions(prisma, uid(req), date, ["EXPENSE"]);
      res.json(computeCategoryBreakdown(rows, currency, convertAmount, toNumber, plnPerUnit));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load expenses by category");
    }
  });

  router.get("/api/stats/income-by-category", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const date = requireTransactionDateFilter(transactionDateFilter, req.query.from, req.query.to);
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const rows = await fetchUserTransactions(prisma, uid(req), date, [
        "INCOME",
        "DIVIDEND",
        "INTEREST",
      ]);
      res.json(computeCategoryBreakdown(rows, currency, convertAmount, toNumber, plnPerUnit));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load income by category");
    }
  });

  router.get("/api/stats/portfolio-summary", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const date = requireTransactionDateFilter(transactionDateFilter, req.query.from, req.query.to);
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const summary = await computePortfolioSummary(
        prisma,
        uid(req),
        date.gte!,
        date.lte!,
        currency,
        plnPerUnit,
      );
      res.json(summary);
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load portfolio summary");
    }
  });

  router.get("/api/stats/portfolio-history", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const date = requireTransactionDateFilter(transactionDateFilter, req.query.from, req.query.to);
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const history = await computePortfolioHistory(
        prisma,
        uid(req),
        date.gte!,
        date.lte!,
        currency,
        plnPerUnit,
      );
      res.json(history);
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load portfolio history");
    }
  });

  router.get("/api/stats/benchmark-comparison", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const date = requireTransactionDateFilter(transactionDateFilter, req.query.from, req.query.to);
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      let benchmarkId;
      try {
        benchmarkId = parseBenchmarkId(req.query.benchmark ?? "SP500");
      } catch {
        throw badRequest("benchmark must be WIG or SP500");
      }
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const comparison = await computeBenchmarkComparison(
        prisma,
        uid(req),
        benchmarkId,
        date.gte!,
        date.lte!,
        currency,
        plnPerUnit,
      );
      res.json(comparison);
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load benchmark comparison");
    }
  });

  router.get("/api/stats/tax-report", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const taxYear = parseTaxYear(req.query.year ?? new Date().getUTCFullYear());
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const report = await computeTaxReport(prisma, uid(req), taxYear, currency, plnPerUnit);
      res.json(report);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.startsWith("year must be")) {
        handleRouteError(res, badRequest(e.message), "Failed to load tax report");
        return;
      }
      handleRouteError(res, e, "Failed to load tax report");
    }
  });

  router.get("/api/stats/tax-report/export", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const taxYear = parseTaxYear(req.query.year ?? new Date().getUTCFullYear());
      const format = String(req.query.format ?? "csv").toLowerCase();
      const reportType = String(req.query.reportType ?? "pit38").toLowerCase();
      if (format !== "csv") {
        throw badRequest("format must be csv");
      }
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      if (reportType === "crypto_pit") {
        const overview = await computeTaxOverview(prisma, uid(req), taxYear, currency, plnPerUnit);
        const csv = formatCryptoTaxCsv(overview.crypto.sellRows);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="crypto-tax-${taxYear}.csv"`,
        );
        res.send(csv);
        return;
      }
      const report = await computeTaxReport(prisma, uid(req), taxYear, currency, plnPerUnit);
      const csv = formatTaxReportCsv(report.sellRows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="tax-report-${taxYear}.csv"`,
      );
      res.send(csv);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.startsWith("year must be")) {
        handleRouteError(res, badRequest(e.message), "Failed to export tax report");
        return;
      }
      handleRouteError(res, e, "Failed to export tax report");
    }
  });

  router.get("/api/stats/tax-overview", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const taxYear = parseTaxYear(req.query.year ?? new Date().getUTCFullYear());
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const persist = String(req.query.snapshot ?? "") === "1";
      const overview = await computeTaxOverview(
        prisma,
        uid(req),
        taxYear,
        currency,
        plnPerUnit,
        { persistSnapshot: persist },
      );
      res.json(overview);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.startsWith("year must be")) {
        handleRouteError(res, badRequest(e.message), "Failed to load tax overview");
        return;
      }
      handleRouteError(res, e, "Failed to load tax overview");
    }
  });

  router.post("/api/stats/pre-sell-simulator", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const currency = normalizeCurrency(req.body?.currency ?? "PLN");
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const holdingId = Number(req.body?.holdingId);
      if (!Number.isFinite(holdingId) || holdingId < 1) {
        throw badRequest("holdingId required");
      }
      const quantity = Number(req.body?.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw badRequest("quantity must be positive");
      }
      const saleDate =
        req.body?.saleDate != null ? new Date(String(req.body.saleDate)) : undefined;
      const salePricePerUnit =
        req.body?.salePricePerUnit != null ? Number(req.body.salePricePerUnit) : undefined;
      const result = await simulatePreSellTax(
        prisma,
        uid(req),
        {
          holdingId,
          quantity,
          ...(saleDate && !Number.isNaN(saleDate.getTime()) ? { saleDate } : {}),
          ...(salePricePerUnit != null && Number.isFinite(salePricePerUnit)
            ? { salePricePerUnit }
            : {}),
        },
        currency,
        plnPerUnit,
      );
      res.json(result);
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to simulate pre-sell tax");
    }
  });

  return router;
}
