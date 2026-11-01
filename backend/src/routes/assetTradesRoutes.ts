import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  applyAssetTrade,
  parseAssetTradeInput,
  reverseAssetTrade,
} from "../domain/assetTrades";
import { assertAssetTradeAccountType } from "../domain/holdings";
import {
  assertMonthListCap,
  MONTH_LIST_CAP,
} from "../domain/rowCaps";
import {
  cursorWhere,
  pageResultFromRows,
  parseListPageQuery,
} from "../domain/listPageQuery";
import { findOwnedAccount } from "../domain/ownedAccount";
import { valueHoldingsForAccount } from "../domain/portfolioValuation";
import { decimalToNumber } from "../domain/money";
import { handleRouteError, notFound, parseIdParam } from "./httpSupport";

export type AssetTradesDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

function assetTradePayload(trade: {
  id: number;
  accountId: number;
  instrumentId: number;
  side: string;
  quantity: { toString(): string } | number;
  unitPrice: { toString(): string } | number;
  commission: { toString(): string } | number;
  currency: string;
  occurredAt: Date;
  settlementDate: Date | null;
  notes: string | null;
  createdAt: Date;
  instrument?: { symbol: string; name: string };
}) {
  return {
    id: trade.id,
    accountId: trade.accountId,
    instrumentId: trade.instrumentId,
    side: trade.side,
    quantity: Number(trade.quantity),
    unitPrice: Number(trade.unitPrice),
    commission: Number(trade.commission),
    currency: trade.currency,
    occurredAt: trade.occurredAt.toISOString(),
    settlementDate: trade.settlementDate
      ? trade.settlementDate.toISOString()
      : null,
    notes: trade.notes,
    createdAt: trade.createdAt.toISOString(),
    instrumentSymbol: trade.instrument?.symbol ?? null,
    instrumentName: trade.instrument?.name ?? null,
  };
}

export function createAssetTradesRouter(deps: AssetTradesDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get(
    "/api/accounts/:accountId/holdings",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const account = await findOwnedAccount(prisma, uid(req), accountId);
        const { holdings, holdingsValue } = await valueHoldingsForAccount(
          prisma,
          accountId,
        );

        const instruments = await prisma.instrument.findMany({
          where: { id: { in: holdings.map((h) => h.instrumentId) } },
          select: { id: true, symbol: true, name: true, currency: true },
        });
        const byId = new Map(instruments.map((i) => [i.id, i]));

        res.json({
          accountId,
          currency: account.currency,
          holdingsValue,
          holdings: holdings.map((h) => {
            const inst = byId.get(h.instrumentId);
            return {
              id: h.holdingId,
              accountId: h.accountId,
              instrumentId: h.instrumentId,
              symbol: inst?.symbol ?? null,
              name: inst?.name ?? null,
              quantity: decimalToNumber(h.quantity),
              lastClose: h.lastClose,
              lastCloseAsOf: h.lastCloseAsOf,
              marketValue: h.marketValue,
              currency: h.currency,
            };
          }),
        });
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to list holdings");
      }
    },
  );

  router.get(
    "/api/accounts/:accountId/asset-trades",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        await findOwnedAccount(prisma, uid(req), accountId);
        const page = parseListPageQuery(req.query);

        if (page.mode === "month") {
          const rows = await prisma.assetTrade.findMany({
            where: {
              accountId,
              occurredAt: { gte: page.start, lt: page.end },
            },
            orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
            take: MONTH_LIST_CAP + 1,
            include: {
              instrument: { select: { symbol: true, name: true } },
            },
          });
          assertMonthListCap(rows.length, "asset trades");
          res.json({
            items: rows.map(assetTradePayload),
            nextCursor: null,
          });
          return;
        }

        const rows = await prisma.assetTrade.findMany({
          where: {
            accountId,
            ...cursorWhere(page.beforeOccurredAt, page.beforeId),
          },
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          take: page.limit + 1,
          include: {
            instrument: { select: { symbol: true, name: true } },
          },
        });
        const pageRows = pageResultFromRows(rows, page.limit);
        res.json({
          items: pageRows.items.map(assetTradePayload),
          nextCursor: pageRows.nextCursor,
        });
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to list asset trades");
      }
    },
  );

  router.post(
    "/api/accounts/:accountId/asset-trades",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const account = await findOwnedAccount(prisma, uid(req), accountId);
        assertAssetTradeAccountType(account.accountType);

        const input = parseAssetTradeInput(req.body ?? {});
        const instrument = await prisma.instrument.findUnique({
          where: { id: input.instrumentId },
          select: { id: true, currency: true, symbol: true },
        });
        if (!instrument) throw notFound("Instrument not found");

        const trade = await prisma.$transaction(async (tx) => {
          const fresh = await tx.account.findUniqueOrThrow({
            where: { id: account.id },
          });
          return applyAssetTrade(
            tx,
            {
              id: fresh.id,
              currency: fresh.currency,
              accountType: fresh.accountType,
              cashBalance: fresh.cashBalance,
            },
            instrument,
            input,
          );
        });

        const withInst = await prisma.assetTrade.findUniqueOrThrow({
          where: { id: trade.id },
          include: { instrument: { select: { symbol: true, name: true } } },
        });
        res.status(201).json(assetTradePayload(withInst));
      } catch (e: unknown) {
        handleRouteError(res, e, "Create asset trade failed");
      }
    },
  );

  router.delete(
    "/api/accounts/:accountId/asset-trades/:id",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const id = parseIdParam(req.params.id);
        await findOwnedAccount(prisma, uid(req), accountId);

        const existing = await prisma.assetTrade.findFirst({
          where: { id, accountId },
        });
        if (!existing) throw notFound("Asset trade not found");

        await prisma.$transaction((tx) =>
          reverseAssetTrade(tx, accountId, id),
        );
        res.status(204).send();
      } catch (e: unknown) {
        handleRouteError(res, e, "Delete asset trade failed");
      }
    },
  );

  return router;
}
