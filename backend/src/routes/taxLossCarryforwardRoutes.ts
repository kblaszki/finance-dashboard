import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  deleteTaxLossCarryforward,
  listTaxLossCarryforwards,
  serializeTaxLossCarryforward,
  upsertTaxLossCarryforward,
} from "../taxLossCarryforward";
import { invalidateTaxReportSnapshots } from "../taxReportCache";
import { handleRouteError, parseFiniteNumber, parseIdParam } from "./httpSupport";

type TaxLossDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

export function createTaxLossCarryforwardRouter(deps: TaxLossDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get("/api/tax-loss-carryforward", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const rows = await listTaxLossCarryforwards(prisma, uid(req));
      res.json(rows.map(serializeTaxLossCarryforward));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load loss carryforward");
    }
  });

  router.put("/api/tax-loss-carryforward", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const taxYear = parseFiniteNumber(req.body?.taxYear, "taxYear", { min: 2000 });
      const row = await upsertTaxLossCarryforward(prisma, userId, {
        taxYear,
        lossAmount: parseFiniteNumber(req.body?.lossAmount, "lossAmount", { min: 0 }),
        ...(req.body?.usedAmount != null
          ? { usedAmount: parseFiniteNumber(req.body.usedAmount, "usedAmount", { min: 0 }) }
          : {}),
        note: req.body?.note != null ? String(req.body.note) : null,
      });
      await invalidateTaxReportSnapshots(prisma, userId, taxYear);
      res.json(serializeTaxLossCarryforward(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to save loss carryforward");
    }
  });

  router.delete("/api/tax-loss-carryforward/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const id = parseIdParam(req.params.id, "id");
      const existing = await prisma.taxLossCarryforward.findFirst({ where: { id, userId } });
      await deleteTaxLossCarryforward(prisma, userId, id);
      if (existing) {
        await invalidateTaxReportSnapshots(prisma, userId, existing.taxYear);
      }
      res.status(204).send();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete loss carryforward");
    }
  });

  return router;
}
