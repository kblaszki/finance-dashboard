import { Router } from "express";
import { Prisma as PrismaNS, type PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  assertCanDeleteCategory,
  assertNoCycle,
  assertParentOwned,
  assertSiblingNameUnique,
  categoryNameKey,
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

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof PrismaNS.PrismaClientKnownRequestError && error.code === "P2002";
}

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
      const created = await prisma.$transaction(async (tx) => {
        await assertParentOwned(tx, userId, parentId);
        await assertSiblingNameUnique(tx, userId, name, parentId);
        return tx.category.create({
          data: { userId, name, parentId, nameKey: categoryNameKey(parentId, name) },
        });
      });
      res.status(201).json(categoryPayload(created));
    } catch (e: unknown) {
      if (isUniqueConstraintError(e)) {
        handleRouteError(
          res,
          badRequest("A category with this name already exists under the same parent"),
          "Create category failed",
        );
        return;
      }
      handleRouteError(res, e, "Create category failed");
    }
  });

  router.patch("/api/categories/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const id = parseIdParam(req.params.id);
      const body = req.body ?? {};
      const nameProvided = Object.prototype.hasOwnProperty.call(body, "name");
      const parentProvided = Object.prototype.hasOwnProperty.call(body, "parentId");
      if (!nameProvided && !parentProvided) {
        throw badRequest("name or parentId required");
      }

      const updated = await prisma.$transaction(async (tx) => {
        const existing = await findOwnedCategory(tx, userId, id);
        const name = nameProvided ? parseCategoryName(body.name) : existing.name;
        const parentId = parentProvided
          ? (parseOptionalParentId(body.parentId) ?? null)
          : existing.parentId;

        if (parentProvided) {
          await assertParentOwned(tx, userId, parentId);
          await assertNoCycle(tx, userId, id, parentId);
        }
        await assertSiblingNameUnique(tx, userId, name, parentId, id);
        return tx.category.update({
          where: { id },
          data: { name, parentId, nameKey: categoryNameKey(parentId, name) },
        });
      });
      res.json(categoryPayload(updated));
    } catch (e: unknown) {
      if (isUniqueConstraintError(e)) {
        handleRouteError(
          res,
          badRequest("A category with this name already exists under the same parent"),
          "Update category failed",
        );
        return;
      }
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
