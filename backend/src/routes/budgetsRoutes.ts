import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  deleteUserBudget,
  listUserBudgets,
  parseBudgetMonth,
  serializeBudget,
  upsertUserBudget,
} from "../budgets";
import { computeBudgetAlerts } from "../budgetAlerts";
import { getCategoryForUser } from "../categories";
import { computeCategoryBreakdown, fetchUserTransactions } from "../stats";
import { handleRouteError, parseFiniteNumber, parseIdParam, parsePositiveNumber } from "./httpSupport";

type BudgetsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  normalizeCurrency: (value: unknown) => string;
  convertAmount: (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    plnPerUnit: Record<string, number>,
  ) => number;
  getFxRatesPlnPerUnit: () => Promise<{ plnPerUnit: Record<string, number> }>;
  toNumber: (value: unknown) => number;
};

export function createBudgetsRouter(deps: BudgetsDeps): Router {
  const router = Router();
  const {
    prisma,
    requireAuth,
    uid,
    normalizeCurrency,
    convertAmount,
    getFxRatesPlnPerUnit,
    toNumber,
  } = deps;

  router.get("/api/budgets", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const budgetMonth =
        req.query.month != null ? parseBudgetMonth(String(req.query.month)) : undefined;
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      const rows = await listUserBudgets(prisma, userId, budgetMonth);

      let spentByCategory = new Map<number, number>();
      if (budgetMonth) {
        const monthEnd = new Date(
          Date.UTC(budgetMonth.getUTCFullYear(), budgetMonth.getUTCMonth() + 1, 0, 23, 59, 59, 999),
        );
        const { plnPerUnit } = await getFxRatesPlnPerUnit();
        const txRows = await fetchUserTransactions(
          prisma,
          userId,
          { gte: budgetMonth, lte: monthEnd },
          ["EXPENSE"],
        );
        const breakdown = computeCategoryBreakdown(
          txRows,
          currency,
          convertAmount,
          toNumber,
          plnPerUnit,
        );
        const categories = await prisma.category.findMany({ where: { userId } });
        const nameToId = new Map(categories.map((c) => [c.name, c.id]));
        for (const row of breakdown) {
          const id = nameToId.get(row.category);
          if (id != null) spentByCategory.set(id, row.amount);
        }
      }

      const categories = await prisma.category.findMany({ where: { userId } });
      const nameById = new Map(categories.map((c) => [c.id, c.name]));

      res.json(
        rows.map((row) =>
          serializeBudget(row, nameById.get(row.categoryId), spentByCategory.get(row.categoryId)),
        ),
      );
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load budgets");
    }
  });

  router.put("/api/budgets", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const categoryId = parseFiniteNumber(req.body?.categoryId, "categoryId", { min: 1 });
      const budgetMonth = parseBudgetMonth(req.body?.budgetMonth);
      const amount = parsePositiveNumber(req.body?.amount, "amount");
      const currency = normalizeCurrency(req.body?.currency ?? "PLN");
      const row = await upsertUserBudget(prisma, userId, {
        categoryId,
        budgetMonth,
        amount,
        currency,
      });
      const cat = await getCategoryForUser(prisma, userId, categoryId);
      res.json(serializeBudget(row, cat?.name));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to save budget");
    }
  });

  router.get("/api/budgets/alerts", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const now = new Date();
      const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      const budgetMonth = parseBudgetMonth(
        req.query.month != null ? String(req.query.month) : defaultMonth,
      );
      const currency = normalizeCurrency(req.query.currency ?? "PLN");
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const alerts = await computeBudgetAlerts(
        prisma,
        userId,
        budgetMonth,
        currency,
        plnPerUnit,
        convertAmount,
        toNumber,
      );
      res.json(alerts);
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load budget alerts");
    }
  });

  router.delete("/api/budgets/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      await deleteUserBudget(prisma, uid(req), parseIdParam(req.params.id));
      res.status(204).end();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete budget");
    }
  });

  return router;
}
