import { Router } from "express";
import { Prisma as PrismaNS, type PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  assertOwnedCategoryForDescription,
  categoryDescriptionRulePayload,
  parseRulePattern,
  rulePatternKey,
} from "../domain/categoryDescriptionSuggest";
import { parseLedgerType } from "../domain/categories";
import {
  badRequest,
  handleRouteError,
  notFound,
  parseIdParam,
} from "./httpSupport";

type Deps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof PrismaNS.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function parseRuleLedgerType(value: unknown): "INCOME" | "EXPENSE" {
  const lt = parseLedgerType(value);
  if (lt !== "INCOME" && lt !== "EXPENSE") {
    throw badRequest("ledgerType must be INCOME or EXPENSE");
  }
  return lt;
}

function parseCategoryId(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest("categoryId must be a valid id");
  }
  return n;
}

export function createCategoryDescriptionRulesRouter(deps: Deps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get(
    "/api/category-description-rules",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const rows = await prisma.categoryDescriptionRule.findMany({
          where: { userId: uid(req) },
          orderBy: [{ ledgerType: "asc" }, { pattern: "asc" }],
        });
        res.json(rows.map(categoryDescriptionRulePayload));
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to list description rules");
      }
    },
  );

  router.post(
    "/api/category-description-rules",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const userId = uid(req);
        const pattern = parseRulePattern(req.body?.pattern);
        const ledgerType = parseRuleLedgerType(req.body?.ledgerType);
        const categoryId = parseCategoryId(req.body?.categoryId);
        await assertOwnedCategoryForDescription(
          prisma,
          userId,
          categoryId,
          ledgerType,
        );
        const created = await prisma.categoryDescriptionRule.create({
          data: {
            userId,
            pattern,
            patternKey: rulePatternKey(pattern),
            ledgerType,
            categoryId,
          },
        });
        res.status(201).json(categoryDescriptionRulePayload(created));
      } catch (e: unknown) {
        if (isUniqueConstraintError(e)) {
          handleRouteError(
            res,
            badRequest(
              "A rule with this pattern already exists for this ledger type",
            ),
            "Create description rule failed",
          );
          return;
        }
        handleRouteError(res, e, "Create description rule failed");
      }
    },
  );

  router.patch(
    "/api/category-description-rules/:id",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const id = parseIdParam(req.params.id);
        const userId = uid(req);
        const existing = await prisma.categoryDescriptionRule.findFirst({
          where: { id, userId },
        });
        if (!existing) throw notFound("Description rule not found");

        const data: {
          pattern?: string;
          patternKey?: string;
          ledgerType?: string;
          categoryId?: number;
        } = {};

        const body = req.body ?? {};
        if (Object.prototype.hasOwnProperty.call(body, "pattern")) {
          const pattern = parseRulePattern(body.pattern);
          data.pattern = pattern;
          data.patternKey = rulePatternKey(pattern);
        }
        if (Object.prototype.hasOwnProperty.call(body, "ledgerType")) {
          data.ledgerType = parseRuleLedgerType(body.ledgerType);
        }
        if (Object.prototype.hasOwnProperty.call(body, "categoryId")) {
          data.categoryId = parseCategoryId(body.categoryId);
        }
        if (Object.keys(data).length === 0) {
          throw badRequest("pattern, ledgerType, or categoryId required");
        }

        const nextLedger = (data.ledgerType ??
          existing.ledgerType) as "INCOME" | "EXPENSE";
        const nextCategoryId = data.categoryId ?? existing.categoryId;
        await assertOwnedCategoryForDescription(
          prisma,
          userId,
          nextCategoryId,
          nextLedger,
        );

        const updated = await prisma.categoryDescriptionRule.update({
          where: { id: existing.id },
          data,
        });
        res.json(categoryDescriptionRulePayload(updated));
      } catch (e: unknown) {
        if (isUniqueConstraintError(e)) {
          handleRouteError(
            res,
            badRequest(
              "A rule with this pattern already exists for this ledger type",
            ),
            "Update description rule failed",
          );
          return;
        }
        handleRouteError(res, e, "Update description rule failed");
      }
    },
  );

  router.delete(
    "/api/category-description-rules/:id",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const id = parseIdParam(req.params.id);
        const userId = uid(req);
        const existing = await prisma.categoryDescriptionRule.findFirst({
          where: { id, userId },
          select: { id: true },
        });
        if (!existing) throw notFound("Description rule not found");
        await prisma.categoryDescriptionRule.delete({ where: { id } });
        res.status(204).send();
      } catch (e: unknown) {
        handleRouteError(res, e, "Delete description rule failed");
      }
    },
  );

  return router;
}
