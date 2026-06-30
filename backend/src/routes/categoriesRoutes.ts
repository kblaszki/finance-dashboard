import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  buildCategoryTree,
  createUserCategory,
  deleteUserCategory,
  ensureDefaultCategories,
  listUserCategories,
  serializeCategory,
  updateUserCategory,
} from "../categories";
import { handleRouteError, parseFiniteNumber, parseIdParam } from "./httpSupport";

type CategoriesDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

export function createCategoriesRouter(deps: CategoriesDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get("/api/categories", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      await ensureDefaultCategories(prisma, userId);
      const rows = await listUserCategories(prisma, userId);
      const flat = rows.map(serializeCategory);
      const tree = buildCategoryTree(rows).map(function mapNode(node): unknown {
        return {
          ...serializeCategory(node),
          children: node.children.map(mapNode),
        };
      });
      res.json({ flat, tree });
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load categories");
    }
  });

  router.post("/api/categories", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const name = String(req.body?.name ?? "").trim();
      const parentId =
        req.body?.parentId != null
          ? parseFiniteNumber(req.body.parentId, "parentId", { min: 1 })
          : null;
      const sortOrder =
        req.body?.sortOrder != null
          ? parseFiniteNumber(req.body.sortOrder, "sortOrder")
          : undefined;
      const row = await createUserCategory(prisma, uid(req), {
        name,
        parentId,
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      });
      res.status(201).json(serializeCategory(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create category");
    }
  });

  router.put("/api/categories/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const categoryId = parseIdParam(req.params.id);
      const input: {
        name?: string;
        parentId?: number | null;
        sortOrder?: number;
      } = {};
      if (req.body?.name != null) input.name = String(req.body.name);
      if (req.body?.parentId !== undefined) {
        input.parentId =
          req.body.parentId == null
            ? null
            : parseFiniteNumber(req.body.parentId, "parentId", { min: 1 });
      }
      if (req.body?.sortOrder != null) {
        input.sortOrder = parseFiniteNumber(req.body.sortOrder, "sortOrder");
      }
      const row = await updateUserCategory(prisma, uid(req), categoryId, input);
      res.json(serializeCategory(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to update category");
    }
  });

  router.delete("/api/categories/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      await deleteUserCategory(prisma, uid(req), parseIdParam(req.params.id));
      res.status(204).end();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete category");
    }
  });

  return router;
}
