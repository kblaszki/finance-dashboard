import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  createCategorizationRule,
  deleteCategorizationRule,
  listCategorizationRules,
  parseMatchType,
  serializeCategorizationRule,
  updateCategorizationRule,
} from "../categorizationRules";
import { handleRouteError, parseFiniteNumber, parseIdParam } from "./httpSupport";

type CategorizationRulesDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

export function createCategorizationRulesRouter(deps: CategorizationRulesDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get("/api/categorization-rules", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const rows = await listCategorizationRules(prisma, uid(req));
      res.json(rows.map(serializeCategorizationRule));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load categorization rules");
    }
  });

  router.post("/api/categorization-rules", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const row = await createCategorizationRule(prisma, uid(req), {
        categoryId: parseFiniteNumber(req.body?.categoryId, "categoryId", { min: 1 }),
        pattern: String(req.body?.pattern ?? ""),
        matchType: req.body?.matchType != null ? parseMatchType(req.body.matchType) : "contains",
        priority: req.body?.priority != null ? parseFiniteNumber(req.body.priority, "priority") : 0,
        active: req.body?.active !== false,
      });
      res.status(201).json(serializeCategorizationRule(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create categorization rule");
    }
  });

  router.put("/api/categorization-rules/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id, "id");
      const patch: Parameters<typeof updateCategorizationRule>[3] = {};
      if (req.body?.categoryId != null) {
        patch.categoryId = parseFiniteNumber(req.body.categoryId, "categoryId", { min: 1 });
      }
      if (req.body?.pattern != null) patch.pattern = String(req.body.pattern);
      if (req.body?.matchType != null) patch.matchType = parseMatchType(req.body.matchType);
      if (req.body?.priority != null) patch.priority = parseFiniteNumber(req.body.priority, "priority");
      if (req.body?.active != null) patch.active = Boolean(req.body.active);
      const row = await updateCategorizationRule(prisma, uid(req), id, patch);
      res.json(serializeCategorizationRule(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to update categorization rule");
    }
  });

  router.delete("/api/categorization-rules/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      await deleteCategorizationRule(prisma, uid(req), parseIdParam(req.params.id, "id"));
      res.status(204).end();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete categorization rule");
    }
  });

  return router;
}
