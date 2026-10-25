import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  aggregateCategoryBreakdown,
  parseMonthParam,
  sumTransferAmountFrom,
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
import { parseStatsPeriod } from "../domain/statsPeriod";
import { aggregateTagBreakdown } from "../domain/tagBreakdown";
import {
  assertStatsPeriodRowCap,
  STATS_PERIOD_ROW_CAP,
} from "../domain/rowCaps";
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
        const statsPeriod = parseStatsPeriod(req.query.month, req.query.period);
        const { start, end, month, period, label } = statsPeriod;
        const userId = uid(req);
        const [rows, transfers] = await Promise.all([
          prisma.cashTransaction.findMany({
            where: {
              occurredAt: { gte: start, lt: end },
              account: { userId },
            },
            include: {
              account: { select: { currency: true } },
              category: { select: { id: true, name: true } },
            },
            take: STATS_PERIOD_ROW_CAP + 1,
          }),
          prisma.cashTransfer.findMany({
            where: {
              occurredAt: { gte: start, lt: end },
              userId,
            },
            include: {
              fromAccount: { select: { currency: true } },
              category: { select: { id: true, name: true } },
            },
            take: STATS_PERIOD_ROW_CAP + 1,
          }),
        ]);
        assertStatsPeriodRowCap(rows.length, "Cash transactions");
        assertStatsPeriodRowCap(transfers.length, "Transfers");
        res.json(
          aggregateCategoryBreakdown(
            month,
            rows.map((row) => ({ ...row, amount: minorToDecimal(row.amount) })),
            {
              period,
              label,
              transferRows: transfers.map((row) => ({
                amountFrom: minorToDecimal(row.amountFrom),
                categoryId: row.categoryId,
                fromAccount: row.fromAccount,
                category: row.category,
              })),
            },
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
        const statsPeriod = parseStatsPeriod(req.query.month, req.query.period);
        const { start, end, month, period, label } = statsPeriod;
        const currency = parseCurrencyParam(req.query.currency);
        const userId = uid(req);
        const [rows, transfers] = await Promise.all([
          prisma.cashTransaction.findMany({
            where: {
              occurredAt: { gte: start, lt: end },
              account: { userId, currency },
            },
            include: {
              account: { select: { currency: true } },
            },
            take: STATS_PERIOD_ROW_CAP + 1,
          }),
          prisma.cashTransfer.findMany({
            where: {
              occurredAt: { gte: start, lt: end },
              userId,
              fromAccount: { currency },
            },
            include: {
              fromAccount: { select: { currency: true } },
              category: { select: { id: true, name: true } },
            },
            take: STATS_PERIOD_ROW_CAP + 1,
          }),
        ]);
        assertStatsPeriodRowCap(rows.length, "Cash transactions");
        assertStatsPeriodRowCap(transfers.length, "Transfers");
        res.json(
          aggregatePeriodSummary(
            month,
            currency,
            rows.map((row) => ({ ...row, amount: minorToDecimal(row.amount) })),
            {
              period,
              label,
              transfers: sumTransferAmountFrom(
                transfers.map((row) => ({
                  amountFrom: minorToDecimal(row.amountFrom),
                  categoryId: row.categoryId,
                  fromAccount: row.fromAccount,
                  category: row.category,
                })),
                currency,
              ),
            },
          ),
        );
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to load period summary");
      }
    },
  );

  router.get(
    "/api/statistics/tag-breakdown",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const statsPeriod = parseStatsPeriod(req.query.month, req.query.period);
        const { start, end, month, period, label } = statsPeriod;
        const currency = parseCurrencyParam(req.query.currency);
        const rows = await prisma.cashTransaction.findMany({
          where: {
            occurredAt: { gte: start, lt: end },
            account: { userId: uid(req), currency },
          },
          include: {
            account: { select: { currency: true } },
            cashTransactionTags: {
              include: { tag: { select: { id: true, name: true } } },
            },
          },
          take: STATS_PERIOD_ROW_CAP + 1,
        });
        assertStatsPeriodRowCap(rows.length, "Cash transactions");
        res.json(
          aggregateTagBreakdown(
            month,
            currency,
            rows.map((row) => ({
              type: row.type,
              amount: minorToDecimal(row.amount),
              account: row.account,
              cashTransactionTags: row.cashTransactionTags,
            })),
            { period, label },
          ),
        );
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to load tag breakdown");
      }
    },
  );

  router.get(
    "/api/statistics/cashflow-history",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const statsPeriod = parseStatsPeriod(req.query.month, req.query.period);
        const currency = parseCurrencyParam(req.query.currency);
        const monthCount = parseMonthsParam(req.query.months);
        const months = listMonthsEndingAt(statsPeriod.endMonth, monthCount);
        const { start } = parseMonthParam(months[0]!);
        const { end } = parseMonthParam(statsPeriod.endMonth);
        const rows = await prisma.cashTransaction.findMany({
          where: {
            occurredAt: { gte: start, lt: end },
            account: { userId: uid(req), currency },
          },
          include: {
            account: { select: { currency: true } },
          },
          take: STATS_PERIOD_ROW_CAP + 1,
        });
        assertStatsPeriodRowCap(rows.length, "Cash transactions");
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
          take: STATS_PERIOD_ROW_CAP + 1,
        });
        assertStatsPeriodRowCap(rows.length, "Cash transactions");
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
