import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  aggregateCategoryBreakdown,
  parseMonthParam,
} from "../domain/categoryBreakdown";
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
        res.json(aggregateCategoryBreakdown(month, rows));
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to load category breakdown");
      }
    },
  );

  return router;
}
