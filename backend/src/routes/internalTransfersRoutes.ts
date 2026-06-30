import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  createInternalTransfer,
  deleteInternalTransfer,
  fetchUserInternalTransfers,
  suggestCrossCurrencyTransfer,
} from "../internalTransfers";
import type { TransactionDateFilter } from "./routeSupport";
import {
  badRequest,
  handleRouteError,
  notFound,
  parseFiniteNumber,
  parseIdParam,
  parsePositiveNumber,
} from "./httpSupport";

type InternalTransfersDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  parseDateBody: (value: unknown) => Date;
  transactionDateFilter: TransactionDateFilter;
  getAccountForUser: (
    prisma: PrismaClient,
    userId: number,
    accountId: number,
  ) => Promise<{ id: number; currency: string; name: string } | null>;
  getFxRatesPlnPerUnit: () => Promise<{ plnPerUnit: Record<string, number> }>;
};

export function createInternalTransfersRouter(deps: InternalTransfersDeps): Router {
  const router = Router();
  const {
    prisma,
    requireAuth,
    uid,
    parseDateBody,
    transactionDateFilter,
    getAccountForUser,
    getFxRatesPlnPerUnit,
  } = deps;

  const transferDeps = { getAccountForUser, getFxRatesPlnPerUnit };

  router.get("/api/internal-transfers", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const filters: { accountId?: number; from?: Date; to?: Date } = {};
      if (req.query.accountId != null && String(req.query.accountId).length > 0) {
        filters.accountId = parseIdParam(String(req.query.accountId), "accountId");
      }
      const date = transactionDateFilter(req.query.from, req.query.to);
      if (date?.gte) filters.from = date.gte;
      if (date?.lte) filters.to = date.lte;

      const transfers = await fetchUserInternalTransfers(prisma, uid(req), filters);
      res.json({ transfers });
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load internal transfers");
    }
  });

  router.get("/api/internal-transfers/fx-suggestion", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const fromCurrency = String(req.query.fromCurrency ?? "").trim().toUpperCase();
      const toCurrency = String(req.query.toCurrency ?? "").trim().toUpperCase();
      const fromAmount = parsePositiveNumber(req.query.fromAmount, "fromAmount");
      if (!fromCurrency || !toCurrency) {
        return res.status(400).json({ error: "fromCurrency and toCurrency are required" });
      }
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const suggestion = suggestCrossCurrencyTransfer(fromCurrency, toCurrency, fromAmount, plnPerUnit);
      res.json({ fromCurrency, toCurrency, fromAmount, ...suggestion });
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to suggest FX rate");
    }
  });

  router.post("/api/internal-transfers", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const fromAccountId = parseFiniteNumber(req.body?.fromAccountId, "fromAccountId", { min: 1 });
      const toAccountId = parseFiniteNumber(req.body?.toAccountId, "toAccountId", { min: 1 });
      const fromAmount = parsePositiveNumber(req.body?.fromAmount, "fromAmount");
      const toAmount = parsePositiveNumber(req.body?.toAmount, "toAmount");
      const exchangeRate =
        req.body?.exchangeRate != null
          ? parsePositiveNumber(req.body.exchangeRate, "exchangeRate")
          : undefined;
      const commission =
        req.body?.commission != null ? parseFiniteNumber(req.body.commission, "commission", { min: 0 }) : undefined;
      const date = parseDateBody(req.body?.date);
      const note = req.body?.note != null ? String(req.body.note) : undefined;

      const transfer = await createInternalTransfer(
        prisma,
        uid(req),
        {
          fromAccountId,
          toAccountId,
          fromAmount,
          toAmount,
          exchangeRate,
          commission,
          date,
          note,
        },
        transferDeps,
      );
      res.status(201).json(transfer);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("must")) {
        handleRouteError(res, badRequest(e.message), "Failed to create internal transfer");
        return;
      }
      if (e instanceof Error && e.message === "Insufficient cash balance") {
        handleRouteError(res, badRequest(e.message), "Failed to create internal transfer");
        return;
      }
      handleRouteError(res, e, "Failed to create internal transfer");
    }
  });

  router.delete("/api/internal-transfers/:groupId", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const groupId = String(req.params.groupId ?? "").trim();
      if (!groupId) return res.status(400).json({ error: "groupId is required" });
      await deleteInternalTransfer(prisma, uid(req), groupId, { getFxRatesPlnPerUnit });
      res.status(204).send();
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "Transfer not found") {
        handleRouteError(res, notFound(e.message), "Failed to delete internal transfer");
        return;
      }
      handleRouteError(res, e, "Failed to delete internal transfer");
    }
  });

  return router;
}
