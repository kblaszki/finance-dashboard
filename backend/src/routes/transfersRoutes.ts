import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  createTransfer,
  deleteTransfer,
  findOwnedTransfer,
  parseTransferInput,
  transferInputFromExisting,
  transferPayload,
  updateTransfer,
  type OwnedAccountRef,
} from "../domain/cashTransfers";
import { badRequest, handleRouteError, parseIdParam } from "./httpSupport";

type TransfersDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

async function loadOwnedAccountsMap(
  prisma: PrismaClient,
  userId: number,
): Promise<Map<number, OwnedAccountRef>> {
  const rows = await prisma.account.findMany({
    where: { userId },
    select: { id: true, currency: true },
  });
  return new Map(rows.map((row) => [row.id, row]));
}

export function createTransfersRouter(deps: TransfersDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get("/api/transfers", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const rows = await prisma.cashTransfer.findMany({
        where: { userId: uid(req) },
        include: {
          fromAccount: { select: { id: true, currency: true, name: true } },
          toAccount: { select: { id: true, currency: true, name: true } },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      });
      res.json(rows.map(transferPayload));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to list transfers");
    }
  });

  router.post("/api/transfers", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const body = req.body ?? {};
      const accounts = await loadOwnedAccountsMap(prisma, userId);
      const input = parseTransferInput(body, accounts);
      const created = await prisma.$transaction((tx) => createTransfer(tx, userId, input));
      res.status(201).json(transferPayload(created));
    } catch (e: unknown) {
      handleRouteError(res, e, "Create transfer failed");
    }
  });

  router.patch("/api/transfers/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const id = parseIdParam(req.params.id);
      const body = req.body ?? {};
      const hasField = [
        "fromAccountId",
        "toAccountId",
        "amountFrom",
        "amountTo",
        "occurredAt",
        "description",
      ].some((key) => body[key] !== undefined);
      if (!hasField) throw badRequest("No updatable fields provided");

      const existing = await findOwnedTransfer(prisma, userId, id);
      const accounts = await loadOwnedAccountsMap(prisma, userId);
      const input = parseTransferInput(body, accounts, transferInputFromExisting(existing));
      const updated = await prisma.$transaction((tx) =>
        updateTransfer(tx, userId, existing, input),
      );
      res.json(transferPayload(updated));
    } catch (e: unknown) {
      handleRouteError(res, e, "Update transfer failed");
    }
  });

  router.delete("/api/transfers/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const id = parseIdParam(req.params.id);
      const existing = await findOwnedTransfer(prisma, userId, id);
      await prisma.$transaction((tx) => deleteTransfer(tx, existing));
      res.status(204).send();
    } catch (e: unknown) {
      handleRouteError(res, e, "Delete transfer failed");
    }
  });

  return router;
}
