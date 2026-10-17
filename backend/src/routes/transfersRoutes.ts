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
  formatImportErrors,
  parseTransfersCsv,
  transfersExportFilename,
} from "../domain/transfersCsv";
import {
  buildTransferCategoryPathIndex,
  collectUsedAccounts,
  findDuplicateRows,
  parseAccountMappings,
  parseSkipRows,
  resolveTransferDrafts,
  suggestAccountMatches,
} from "../domain/transfersImport";
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

async function loadOwnedAccountsForImport(prisma: PrismaClient, userId: number) {
  return prisma.account.findMany({
    where: { userId },
    select: { id: true, name: true, currency: true },
  });
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
          }),
          prisma.category.findMany({
            where: { userId, ledgerType: "TRANSFER" },
            select: { id: true, name: true, parentId: true },
          }),
        ]);
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

        const parsed = parseTransfersCsv(csv);
        if (!parsed.ok) {
          res.status(400).json({
            error: formatImportErrors(parsed.errors),
            details: parsed.errors,
          });
          return;
        }

        const owned = await loadOwnedAccountsForImport(prisma, userId);
        const used = collectUsedAccounts(parsed.drafts);
        const accounts = suggestAccountMatches(used, owned);
        const body: {
          rowCount: number;
          accounts: typeof accounts;
          rows?: Array<{
            row: number;
            occurredAt: string;
            fromAccountId: number;
            toAccountId: number;
            amountFrom: number;
            amountTo: number;
            description: string | null;
            duplicate: boolean;
          }>;
        } = {
          rowCount: parsed.drafts.length,
          accounts,
        };

        if (req.body?.accountMappings !== undefined) {
          const mappings = parseAccountMappings(
            req.body.accountMappings,
            used,
            owned,
          );
          if (!mappings.ok) {
            res.status(400).json({
              error: formatImportErrors(mappings.errors),
              details: mappings.errors,
            });
            return;
          }
          const transferCategories = await prisma.category.findMany({
            where: { userId, ledgerType: "TRANSFER" },
            select: {
              id: true,
              name: true,
              parentId: true,
              ledgerType: true,
            },
          });
          const resolved = resolveTransferDrafts(
            parsed.drafts,
            mappings.byKey,
            buildTransferCategoryPathIndex(transferCategories),
          );
          if (!resolved.ok) {
            res.status(400).json({
              error: formatImportErrors(resolved.errors),
              details: resolved.errors,
            });
            return;
          }
          const existing = await prisma.cashTransfer.findMany({
            where: { userId },
            select: {
              fromAccountId: true,
              toAccountId: true,
              amountFrom: true,
              amountTo: true,
              occurredAt: true,
              description: true,
            },
          });
          const marked = findDuplicateRows(resolved.rows, existing);
          body.rows = marked.map((r) => ({
            row: r.row,
            occurredAt: r.input.occurredAt.toISOString(),
            fromAccountId: r.input.fromAccountId,
            toAccountId: r.input.toAccountId,
            amountFrom: Number(r.input.amountFrom),
            amountTo: Number(r.input.amountTo),
            description: r.input.description,
            duplicate: r.duplicate,
          }));
        }

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

        const parsed = parseTransfersCsv(csv);
        if (!parsed.ok) {
          res.status(400).json({
            error: formatImportErrors(parsed.errors),
            details: parsed.errors,
          });
          return;
        }

        const owned = await loadOwnedAccountsForImport(prisma, userId);
        const used = collectUsedAccounts(parsed.drafts);
        const mappings = parseAccountMappings(
          req.body?.accountMappings,
          used,
          owned,
        );
        if (!mappings.ok) {
          res.status(400).json({
            error: formatImportErrors(mappings.errors),
            details: mappings.errors,
          });
          return;
        }

        const transferCategories = await prisma.category.findMany({
          where: { userId, ledgerType: "TRANSFER" },
          select: { id: true, name: true, parentId: true, ledgerType: true },
        });
        const categoryPathIndex =
          buildTransferCategoryPathIndex(transferCategories);
        const resolved = resolveTransferDrafts(
          parsed.drafts,
          mappings.byKey,
          categoryPathIndex,
        );
        if (!resolved.ok) {
          res.status(400).json({
            error: formatImportErrors(resolved.errors),
            details: resolved.errors,
          });
          return;
        }

        const skipParsed = parseSkipRows(
          req.body?.skipRows,
          resolved.rows.map((r) => r.row),
        );
        if (!skipParsed.ok) {
          res.status(400).json({
            error: formatImportErrors(skipParsed.errors),
            details: skipParsed.errors,
          });
          return;
        }

        const toCreate = resolved.rows.filter(
          (r) => !skipParsed.skip.has(r.row),
        );
        const skipped = resolved.rows.length - toCreate.length;

        await prisma.$transaction(async (tx) => {
          for (const item of toCreate) {
            await createTransfer(tx, userId, item.input);
          }
        });

        res.status(201).json({ created: toCreate.length, skipped });
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
