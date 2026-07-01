import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  authorizeBankConnectionStub,
  createBankConnection,
  deleteBankConnection,
  listBankConnections,
  serializeBankConnection,
} from "../bankConnections";
import { handleRouteError, parseFiniteNumber, parseIdParam } from "./httpSupport";

type BankConnectionsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

export function createBankConnectionsRouter(deps: BankConnectionsDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get("/api/bank-connections", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const rows = await listBankConnections(prisma, uid(req));
      res.json(rows.map(serializeBankConnection));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load bank connections");
    }
  });

  router.post("/api/bank-connections", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const row = await createBankConnection(prisma, uid(req), {
        accountId: parseFiniteNumber(req.body?.accountId, "accountId", { min: 1 }),
        bankCode: String(req.body?.bankCode ?? ""),
      });
      res.status(201).json(serializeBankConnection(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create bank connection");
    }
  });

  router.post("/api/bank-connections/:id/authorize", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id, "id");
      const row = await authorizeBankConnectionStub(prisma, uid(req), id);
      res.json(serializeBankConnection(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to authorize bank connection");
    }
  });

  router.delete("/api/bank-connections/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      await deleteBankConnection(prisma, uid(req), parseIdParam(req.params.id, "id"));
      res.status(204).end();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete bank connection");
    }
  });

  return router;
}
