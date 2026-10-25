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
  resolveLedgerTypeForCreate,
} from "../domain/categories";
import {
  buildCategoriesCsv,
  categoriesExportFilename,
  parseCategoriesCsv,
} from "../domain/categoriesCsv";
import {
  applyCategoriesImport,
  previewCategoriesImport,
} from "../domain/categoriesImport";
import { buildCategoryPathMap } from "../domain/cashLedgerCsv";
import { formatImportErrors } from "../domain/cashLedgerCsvImport";
import {
  assertExportRowCap,
  CSV_EXPORT_ROW_CAP,
} from "../domain/rowCaps";
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

  router.get(
    "/api/categories/export",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const rows = await prisma.category.findMany({
          where: { userId: uid(req) },
          take: CSV_EXPORT_ROW_CAP + 1,
          select: { id: true, name: true, parentId: true, ledgerType: true },
        });
        assertExportRowCap(rows.length, "categories");
        const pathById = buildCategoryPathMap(rows);
        const csvRows = rows
          .map((row) => {
            const path = pathById.get(row.id);
            if (!path) return null;
            if (
              row.ledgerType !== "INCOME" &&
              row.ledgerType !== "EXPENSE" &&
              row.ledgerType !== "TRANSFER"
            ) {
              return null;
            }
            return {
              path,
              ledgerType: row.ledgerType as
                | "INCOME"
                | "EXPENSE"
                | "TRANSFER",
            };
          })
          .filter(
            (
              r,
            ): r is {
              path: string;
              ledgerType: "INCOME" | "EXPENSE" | "TRANSFER";
            } => r != null,
          );
        const csv = buildCategoriesCsv(csvRows);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${categoriesExportFilename()}"`,
        );
        res.status(200).send(csv);
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to export categories");
      }
    },
  );

  router.post(
    "/api/categories/import/preview",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const userId = uid(req);
        const csv = req.body?.csv;
        if (typeof csv !== "string") throw badRequest("csv string required");

        const parsed = parseCategoriesCsv(csv);
        if (!parsed.ok) {
          res.status(400).json({
            error: formatImportErrors(parsed.errors),
            details: parsed.errors,
          });
          return;
        }

        const owned = await prisma.category.findMany({
          where: { userId },
          select: { id: true, name: true, parentId: true, ledgerType: true },
        });
        const preview = previewCategoriesImport(parsed.drafts, owned);
        if (!preview.ok) {
          throw badRequest(preview.message);
        }
        res.status(200).json(preview.preview);
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to preview categories import");
      }
    },
  );

  router.post(
    "/api/categories/import",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const userId = uid(req);
        const csv = req.body?.csv;
        if (typeof csv !== "string") throw badRequest("csv string required");

        const parsed = parseCategoriesCsv(csv);
        if (!parsed.ok) {
          res.status(400).json({
            error: formatImportErrors(parsed.errors),
            details: parsed.errors,
          });
          return;
        }

        const owned = await prisma.category.findMany({
          where: { userId },
          select: { id: true, name: true, parentId: true, ledgerType: true },
        });
        const result = await prisma.$transaction(async (tx) =>
          applyCategoriesImport(tx, userId, parsed.drafts, owned),
        );
        res.status(201).json(result);
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to import categories");
      }
    },
  );

  router.post("/api/categories", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const body = req.body ?? {};
      const name = parseCategoryName(body.name);
      const parentId = parseOptionalParentId(body.parentId) ?? null;
      const created = await prisma.$transaction(async (tx) => {
        const ledgerType = await resolveLedgerTypeForCreate(
          tx,
          userId,
          parentId,
          body.ledgerType,
        );
        await assertSiblingNameUnique(tx, userId, name, parentId);
        return tx.category.create({
          data: {
            userId,
            name,
            parentId,
            ledgerType,
            nameKey: categoryNameKey(parentId, name),
          },
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
      if (Object.prototype.hasOwnProperty.call(body, "ledgerType")) {
        throw badRequest("ledgerType cannot be changed");
      }

      const updated = await prisma.$transaction(async (tx) => {
        const existing = await findOwnedCategory(tx, userId, id);
        const name = nameProvided ? parseCategoryName(body.name) : existing.name;
        const parentId = parentProvided
          ? (parseOptionalParentId(body.parentId) ?? null)
          : existing.parentId;

        if (parentProvided) {
          const parent = await assertParentOwned(tx, userId, parentId);
          if (parent != null && parent.ledgerType !== existing.ledgerType) {
            throw badRequest("cannot reparent across ledgerType");
          }
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
