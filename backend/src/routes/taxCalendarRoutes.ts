import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import { buildTaxCalendarResponse, setTaxChecklistItem } from "../tax/taxChecklist";
import { handleRouteError, parseFiniteNumber } from "./httpSupport";
import { parseTaxYear } from "../tax/taxReport";

type TaxCalendarDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

export function createTaxCalendarRouter(deps: TaxCalendarDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get("/api/tax-calendar", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const taxYear = parseTaxYear(req.query.year ?? new Date().getUTCFullYear());
      const data = await buildTaxCalendarResponse(prisma, uid(req), taxYear);
      res.json(data);
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load tax calendar");
    }
  });

  router.put("/api/tax-checklist", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const taxYear = parseFiniteNumber(req.body?.taxYear, "taxYear", { min: 2000 });
      const itemKey = String(req.body?.itemKey ?? "");
      const completed = Boolean(req.body?.completed);
      await setTaxChecklistItem(prisma, uid(req), taxYear, itemKey, completed);
      const data = await buildTaxCalendarResponse(prisma, uid(req), taxYear);
      res.json(data.checklist);
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to update tax checklist");
    }
  });

  return router;
}
