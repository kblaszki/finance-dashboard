import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  aggregateCategoryBreakdown,
  parseMonthParam,
} from "../domain/categoryBreakdown";
import {
  aggregateCashflowHistory,
  aggregatePeriodSummary,
  aggregateRollingCashflow12m,
  completeMonthsBefore,
  listMonthsEndingAt,
  parseCurrencyParam,
  parseMonthsParam,
} from "../domain/cashflowStats";
import { minorToDecimal } from "../domain/money";
import { aggregateNetWorth } from "../domain/netWorth";
import { handleRouteError } from "./httpSupport";

type StatisticsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

export function createStatisticsRouter(deps: StatisticsDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get(
    "/api/statistics/category-breakdown",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const { month, start, end } = parseMonthParam(req.query.month);
        const rows = await prisma.cashTransaction.findMany({
          where: {
            occurredAt: { gte: start, lt: end },
            account: { userId: uid(req) },
          },
          include: {
            account: { select: { currency: true } },
            category: { select: { id: true, name: true } },
          },
        });
        res.json(
          aggregateCategoryBreakdown(
            month,
            rows.map((row) => ({ ...row, amount: minorToDecimal(row.amount) })),
          ),
        );
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to load category breakdown");
      }
    },
  );

  router.get(
    "/api/statistics/period-summary",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const { month, start, end } = parseMonthParam(req.query.month);
        const currency = parseCurrencyParam(req.query.currency);
        const rows = await prisma.cashTransaction.findMany({
          where: {
            occurredAt: { gte: start, lt: end },
            account: { userId: uid(req), currency },
          },
          include: {
            account: { select: { currency: true } },
          },
        });
        res.json(
          aggregatePeriodSummary(
            month,
            currency,
            rows.map((row) => ({ ...row, amount: minorToDecimal(row.amount) })),
          ),
        );
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to load period summary");
      }
    },
  );

  router.get(
    "/api/statistics/cashflow-history",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const { month, end } = parseMonthParam(req.query.month);
        const currency = parseCurrencyParam(req.query.currency);
        const monthCount = parseMonthsParam(req.query.months);
        const months = listMonthsEndingAt(month, monthCount);
        const { start } = parseMonthParam(months[0]!);
        const rows = await prisma.cashTransaction.findMany({
          where: {
            occurredAt: { gte: start, lt: end },
            account: { userId: uid(req), currency },
          },
          include: {
            account: { select: { currency: true } },
          },
        });
        res.json(
          aggregateCashflowHistory(
            months,
            currency,
            rows.map((row) => ({ ...row, amount: minorToDecimal(row.amount) })),
          ),
        );
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to load cashflow history");
      }
    },
  );

  router.get(
    "/api/statistics/net-worth",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const currency = parseCurrencyParam(req.query.currency);
        const accounts = await prisma.account.findMany({
          where: { userId: uid(req), currency },
          select: {
            accountType: true,
            currency: true,
            cashBalance: true,
          },
        });
        res.json(
          aggregateNetWorth(
            currency,
            accounts.map((account) => ({
              accountType: account.accountType,
              currency: account.currency,
              cashBalance: minorToDecimal(account.cashBalance),
            })),
          ),
        );
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to load net worth");
      }
    },
  );

  router.get(
    "/api/statistics/cashflow-rolling-12m",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const currency = parseCurrencyParam(req.query.currency);
        const asOf = new Date();
        const months = completeMonthsBefore(asOf, 12);
        const { start } = parseMonthParam(months[0]!);
        const { start: currentStart } = parseMonthParam(
          `${asOf.getUTCFullYear()}-${String(asOf.getUTCMonth() + 1).padStart(2, "0")}`,
        );
        const rows = await prisma.cashTransaction.findMany({
          where: {
            occurredAt: { gte: start, lt: currentStart },
            account: { userId: uid(req), currency },
          },
          include: {
            account: { select: { currency: true } },
          },
        });
        res.json(
          aggregateRollingCashflow12m(
            currency,
            rows.map((row) => ({ ...row, amount: minorToDecimal(row.amount) })),
            asOf,
          ),
        );
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to load rolling cashflow");
      }
    },
  );

  return router;
}
