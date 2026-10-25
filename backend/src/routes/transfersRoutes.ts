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
  type TransferInput,
} from "../domain/cashTransfers";
import { expectedCategoryLedgerType } from "../domain/categories";
import {
  buildCategoryPathMap,
} from "../domain/cashLedgerCsv";
import { minorToMajor } from "../domain/money";
import {
  buildTransfersCsv,
  transfersExportFilename,
} from "../domain/transfersCsv";
import {
  commitTransferImport,
  previewTransferImport,
} from "../domain/transfersImportService";
import {
  cursorWhere,
  pageResultFromRows,
  parseListPageQuery,
} from "../domain/listPageQuery";
import { CSV_EXPORT_ROW_CAP, MONTH_LIST_CAP } from "../domain/rowCaps";
import { badRequest, handleRouteError, notFound, parseIdParam } from "./httpSupport";

async function assertOwnedTransferCategory(
  prisma: PrismaClient,
  userId: number,
  categoryId: number | null,
): Promise<number | null> {
  if (categoryId === null) return null;
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true, ledgerType: true },
  });
  if (!category) throw notFound("Category not found");
  if (category.ledgerType !== expectedCategoryLedgerType("TRANSFER")) {
    throw badRequest("category ledgerType must be TRANSFER");
  }
  return category.id;
}

async function parseAndValidateTransferInput(
  prisma: PrismaClient,
  userId: number,
  body: Record<string, unknown>,
  accounts: Map<number, OwnedAccountRef>,
  existing?: TransferInput,
): Promise<TransferInput> {
  const input = parseTransferInput(body, accounts, existing);
  const categoryId = await assertOwnedTransferCategory(
    prisma,
    userId,
    input.categoryId,
  );
  return { ...input, categoryId };
}

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
      const userId = uid(req);
      const page = parseListPageQuery(req.query);
      const where =
        page.mode === "month"
          ? {
              userId,
              occurredAt: { gte: page.start, lt: page.end },
            }
          : {
              userId,
              ...cursorWhere(page.beforeOccurredAt, page.beforeId),
            };
      const take =
        page.mode === "month" ? MONTH_LIST_CAP + 1 : page.limit + 1;
      const rows = await prisma.cashTransfer.findMany({
        where,
        include: {
          fromAccount: { select: { id: true, currency: true, name: true } },
          toAccount: { select: { id: true, currency: true, name: true } },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take,
      });
      if (page.mode === "month" && rows.length > MONTH_LIST_CAP) {
        throw badRequest(
          `Month has more than ${MONTH_LIST_CAP} transfers; use cursor pagination (omit month)`,
        );
      }
      const sliced =
        page.mode === "month"
          ? { items: rows, nextCursor: null as string | null }
          : pageResultFromRows(rows, page.limit);
      res.json({
        items: sliced.items.map(transferPayload),
        nextCursor: sliced.nextCursor,
      });
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to list transfers");
    }
  });

  router.get(
    "/api/transfers/export",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const userId = uid(req);
        const [rows, categories] = await Promise.all([
          prisma.cashTransfer.findMany({
            where: { userId },
            include: {
              fromAccount: { select: { name: true, currency: true } },
              toAccount: { select: { name: true, currency: true } },
            },
            orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
            take: CSV_EXPORT_ROW_CAP + 1,
          }),
          prisma.category.findMany({
            where: { userId, ledgerType: "TRANSFER" },
            select: { id: true, name: true, parentId: true },
          }),
        ]);
        if (rows.length > CSV_EXPORT_ROW_CAP) {
          throw badRequest(
            `Export exceeds ${CSV_EXPORT_ROW_CAP} rows; filter transfers or split exports`,
          );
        }
        const pathById = buildCategoryPathMap(categories);
        const csv = buildTransfersCsv(
          rows.map((row) => ({
            id: row.id,
            occurredAt: row.occurredAt,
            fromAccount: row.fromAccount.name,
            fromCurrency: row.fromAccount.currency,
            toAccount: row.toAccount.name,
            toCurrency: row.toAccount.currency,
            amountFrom: minorToMajor(row.amountFrom),
            amountTo: minorToMajor(row.amountTo),
            description: row.description,
            categoryPath:
              row.categoryId == null
                ? null
                : (pathById.get(row.categoryId) ?? null),
            createdAt: row.createdAt,
          })),
        );
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${transfersExportFilename()}"`,
        );
        res.status(200).send(csv);
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to export transfers");
      }
    },
  );

  router.post(
    "/api/transfers/import/preview",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const userId = uid(req);
        const csv = req.body?.csv;
        if (typeof csv !== "string") throw badRequest("csv string required");
        const body = await previewTransferImport(
          prisma,
          userId,
          csv,
          req.body?.accountMappings,
        );
        res.status(200).json(body);
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to preview transfer import");
      }
    },
  );

  router.post(
    "/api/transfers/import",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const userId = uid(req);
        const csv = req.body?.csv;
        if (typeof csv !== "string") throw badRequest("csv string required");
        const result = await commitTransferImport(
          prisma,
          userId,
          csv,
          req.body?.accountMappings,
          req.body?.skipRows,
        );
        res.status(201).json(result);
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to import transfers");
      }
    },
  );

  router.post("/api/transfers", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const body = req.body ?? {};
      const accounts = await loadOwnedAccountsMap(prisma, userId);
      const input = await parseAndValidateTransferInput(prisma, userId, body, accounts);
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
        "categoryId",
      ].some((key) => body[key] !== undefined);
      if (!hasField) throw badRequest("No updatable fields provided");

      const existing = await findOwnedTransfer(prisma, userId, id);
      const accounts = await loadOwnedAccountsMap(prisma, userId);
      const input = await parseAndValidateTransferInput(
        prisma,
        userId,
        body,
        accounts,
        transferInputFromExisting(existing),
      );
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
