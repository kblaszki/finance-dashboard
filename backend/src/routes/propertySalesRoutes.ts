import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  createPropertySale,
  deletePropertySale,
  listPropertySales,
  serializePropertySale,
} from "../propertySales";
import { invalidateTaxYearsForDate } from "../tax/taxReportCache";
import { handleRouteError, parseFiniteNumber, parseIdParam, parsePositiveNumber } from "./httpSupport";

type PropertySalesDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  parseDateBody: (value: unknown) => Date;
  transactionDateFilter: (from?: unknown, to?: unknown) => { gte?: Date; lte?: Date } | undefined;
};

export function createPropertySalesRouter(deps: PropertySalesDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid, parseDateBody, transactionDateFilter } = deps;

  router.get("/api/property-sales", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountId =
        req.query.accountId != null
          ? parseFiniteNumber(req.query.accountId, "accountId", { min: 1 })
          : undefined;
      const range = transactionDateFilter(req.query.from, req.query.to);
      const filters: { accountId?: number; from?: Date; to?: Date } = {};
      if (accountId != null) filters.accountId = accountId;
      if (range?.gte) filters.from = range.gte;
      if (range?.lte) filters.to = range.lte;
      const rows = await listPropertySales(prisma, uid(req), filters);
      res.json(rows.map(serializePropertySale));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load property sales");
    }
  });

  router.post("/api/property-sales", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const soldOn = parseDateBody(req.body?.soldOn ?? req.body?.date);
      const row = await createPropertySale(prisma, userId, {
        accountId: parseFiniteNumber(req.body?.accountId, "accountId", { min: 1 }),
        soldOn,
        proceeds: parsePositiveNumber(req.body?.proceeds, "proceeds"),
        acquisitionCost: parseFiniteNumber(req.body?.acquisitionCost, "acquisitionCost", { min: 0 }),
        improvementsCost:
          req.body?.improvementsCost != null
            ? parseFiniteNumber(req.body.improvementsCost, "improvementsCost", { min: 0 })
            : 0,
        fiveYearExemption: Boolean(req.body?.fiveYearExemption),
        currency: String(req.body?.currency ?? "PLN"),
        description: req.body?.description != null ? String(req.body.description) : null,
      });
      await invalidateTaxYearsForDate(prisma, userId, soldOn);
      res.status(201).json(serializePropertySale(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create property sale");
    }
  });

  router.delete("/api/property-sales/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const id = parseIdParam(req.params.id, "id");
      const existing = await prisma.propertySale.findFirst({ where: { id, userId } });
      await deletePropertySale(prisma, userId, id);
      if (existing) {
        await invalidateTaxYearsForDate(prisma, userId, existing.soldOn);
      }
      res.status(204).send();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete property sale");
    }
  });

  return router;
}
