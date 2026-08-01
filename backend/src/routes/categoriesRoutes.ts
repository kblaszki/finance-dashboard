import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  assertCanDeleteCategory,
  assertNoCycle,
  assertParentOwned,
  assertSiblingNameUnique,
  categoryPayload,
  findOwnedCategory,
  parseCategoryName,
  parseOptionalParentId,
} from "../domain/categories";
import { badRequest, handleRouteError, parseIdParam } from "./httpSupport";

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
      const rows = await prisma.category.findMany({
        where: { userId: uid(req) },
        orderBy: { name: "asc" },
      });
      res.json(rows.map(categoryPayload));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to list categories");
    }
  });

  router.post("/api/categories", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const body = req.body ?? {};
      const name = parseCategoryName(body.name);
      const parentId = parseOptionalParentId(body.parentId) ?? null;
      await assertParentOwned(prisma, userId, parentId);
      await assertSiblingNameUnique(prisma, userId, name, parentId);

      const created = await prisma.category.create({
        data: { userId, name, parentId },
      });
      res.status(201).json(categoryPayload(created));
    } catch (e: unknown) {
      handleRouteError(res, e, "Create category failed");
    }
  });

  router.patch("/api/categories/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const id = parseIdParam(req.params.id);
      const existing = await findOwnedCategory(prisma, userId, id);
      const body = req.body ?? {};

      const nameProvided = Object.prototype.hasOwnProperty.call(body, "name");
      const parentProvided = Object.prototype.hasOwnProperty.call(body, "parentId");
      if (!nameProvided && !parentProvided) {
        throw badRequest("name or parentId required");
      }

      const name = nameProvided ? parseCategoryName(body.name) : existing.name;
      const parentId = parentProvided
        ? (parseOptionalParentId(body.parentId) ?? null)
        : existing.parentId;

      if (parentProvided) {
        await assertParentOwned(prisma, userId, parentId);
        await assertNoCycle(prisma, userId, id, parentId);
      }
      await assertSiblingNameUnique(prisma, userId, name, parentId, id);

      const updated = await prisma.category.update({
        where: { id },
        data: { name, parentId },
      });
      res.json(categoryPayload(updated));
    } catch (e: unknown) {
      handleRouteError(res, e, "Update category failed");
    }
  });

  router.delete("/api/categories/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const id = parseIdParam(req.params.id);
      await findOwnedCategory(prisma, userId, id);
      await assertCanDeleteCategory(prisma, id);
      await prisma.category.delete({ where: { id } });
      res.status(204).send();
    } catch (e: unknown) {
      handleRouteError(res, e, "Delete category failed");
    }
  });

  return router;
}
