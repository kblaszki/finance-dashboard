import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import type { TransactionDateFilter } from "./routeSupport";
import {
  computeCashflowStats,
  computeCategoryBreakdown,
  fetchUserTransactions,
  requireTransactionDateFilter,
} from "../stats";
import {
  computeBenchmarkComparison,
  computePortfolioHistory,
  computePortfolioSummary,
} from "../portfolioStats";
import { parseBenchmarkId } from "../benchmarks";
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

  router.get("/api/stats/expenses-by-category", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const date = requireTransactionDateFilter(transactionDateFilter, req.query.from, req.query.to);
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const rows = await fetchUserTransactions(prisma, uid(req), date, [
        "EXPENSE",
        "TRANSFER_OUT",
      ]);
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
        "TRANSFER_IN",
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

  return router;
}
