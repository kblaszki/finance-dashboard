import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  createUserLiability,
  deleteUserLiability,
  listUserLiabilities,
  parseLiabilityType,
  serializeLiability,
  updateUserLiability,
} from "../liabilities";
import { handleRouteError, parseFiniteNumber, parseIdParam } from "./httpSupport";

type LiabilitiesDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

export function createLiabilitiesRouter(deps: LiabilitiesDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get("/api/liabilities", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const rows = await listUserLiabilities(prisma, uid(req));
      res.json(rows.map(serializeLiability));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load liabilities");
    }
  });

  router.post("/api/liabilities", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const createInput: Parameters<typeof createUserLiability>[2] = {
        name: String(req.body?.name ?? ""),
        liabilityType: parseLiabilityType(req.body?.liabilityType),
        balance: parseFiniteNumber(req.body?.balance, "balance", { min: 0 }),
        currency: String(req.body?.currency ?? "PLN"),
        accountId:
          req.body?.accountId != null
            ? parseFiniteNumber(req.body.accountId, "accountId", { min: 1 })
            : null,
      };
      const row = await createUserLiability(prisma, uid(req), createInput);
      res.status(201).json(serializeLiability(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create liability");
    }
  });

  router.put("/api/liabilities/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id, "id");
      const patch: Parameters<typeof updateUserLiability>[3] = {};
      if (req.body?.name != null) patch.name = String(req.body.name);
      if (req.body?.liabilityType != null) {
        patch.liabilityType = parseLiabilityType(req.body.liabilityType);
      }
      if (req.body?.balance != null) {
        patch.balance = parseFiniteNumber(req.body.balance, "balance", { min: 0 });
      }
      if (req.body?.currency != null) patch.currency = String(req.body.currency);
      if (req.body?.accountId !== undefined) {
        patch.accountId =
          req.body.accountId == null
            ? null
            : parseFiniteNumber(req.body.accountId, "accountId", { min: 1 });
      }
      const row = await updateUserLiability(prisma, uid(req), id, patch);
      res.json(serializeLiability(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to update liability");
    }
  });

  router.delete("/api/liabilities/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id, "id");
      await deleteUserLiability(prisma, uid(req), id);
      res.status(204).send();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete liability");
    }
  });

  return router;
}
