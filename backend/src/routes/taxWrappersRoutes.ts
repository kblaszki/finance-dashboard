import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  createIkzeContribution,
  createTaxWrapperWithdrawal,
  deleteIkzeContribution,
  deleteTaxWrapperWithdrawal,
  listIkzeContributions,
  listTaxWrapperWithdrawals,
  parseTaxWrapperType,
  parseWithdrawalType,
  serializeIkzeContribution,
  serializeTaxWrapperWithdrawal,
} from "../taxWrapper";
import { handleRouteError, parseFiniteNumber, parseIdParam } from "./httpSupport";

type TaxWrappersDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  parseDateBody: (value: unknown) => Date;
  transactionDateFilter: (from?: unknown, to?: unknown) => { gte?: Date; lte?: Date } | undefined;
};

export function createTaxWrappersRouter(deps: TaxWrappersDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid, parseDateBody, transactionDateFilter } = deps;

  router.get("/api/tax-wrapper-withdrawals", requireAuth, async (req: AuthedRequest, res) => {
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
      const rows = await listTaxWrapperWithdrawals(prisma, uid(req), filters);
      res.json(rows.map(serializeTaxWrapperWithdrawal));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load tax wrapper withdrawals");
    }
  });

  router.post("/api/tax-wrapper-withdrawals", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const createInput: Parameters<typeof createTaxWrapperWithdrawal>[2] = {
        accountId: parseFiniteNumber(req.body?.accountId, "accountId", { min: 1 }),
        withdrawnOn: parseDateBody(req.body?.withdrawnOn ?? req.body?.date),
        amount: parseFiniteNumber(req.body?.amount, "amount", { min: 0.0001 }),
        currency: String(req.body?.currency ?? "PLN"),
        withdrawalType: parseWithdrawalType(req.body?.withdrawalType),
        description: req.body?.description != null ? String(req.body.description) : null,
      };
      if (req.body?.includeInPit38 != null) {
        createInput.includeInPit38 = Boolean(req.body.includeInPit38);
      }
      const row = await createTaxWrapperWithdrawal(prisma, uid(req), createInput);
      res.status(201).json(serializeTaxWrapperWithdrawal(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create tax wrapper withdrawal");
    }
  });

  router.delete("/api/tax-wrapper-withdrawals/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id, "id");
      await deleteTaxWrapperWithdrawal(prisma, uid(req), id);
      res.status(204).send();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete tax wrapper withdrawal");
    }
  });

  router.get("/api/ikze-contributions", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountId =
        req.query.accountId != null
          ? parseFiniteNumber(req.query.accountId, "accountId", { min: 1 })
          : undefined;
      const taxYear =
        req.query.taxYear != null
          ? parseFiniteNumber(req.query.taxYear, "taxYear", { min: 2000 })
          : undefined;
      const filters: { accountId?: number; taxYear?: number } = {};
      if (accountId != null) filters.accountId = accountId;
      if (taxYear != null) filters.taxYear = taxYear;
      const rows = await listIkzeContributions(prisma, uid(req), filters);
      res.json(rows.map(serializeIkzeContribution));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load IKZE contributions");
    }
  });

  router.post("/api/ikze-contributions", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const row = await createIkzeContribution(prisma, uid(req), {
        accountId: parseFiniteNumber(req.body?.accountId, "accountId", { min: 1 }),
        taxYear: parseFiniteNumber(req.body?.taxYear, "taxYear", { min: 2000 }),
        amount: parseFiniteNumber(req.body?.amount, "amount", { min: 0.0001 }),
        currency: String(req.body?.currency ?? "PLN"),
        contributedOn: parseDateBody(req.body?.contributedOn ?? req.body?.date),
      });
      res.status(201).json(serializeIkzeContribution(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create IKZE contribution");
    }
  });

  router.delete("/api/ikze-contributions/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id, "id");
      await deleteIkzeContribution(prisma, uid(req), id);
      res.status(204).send();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete IKZE contribution");
    }
  });

  return router;
}

export { parseTaxWrapperType };
