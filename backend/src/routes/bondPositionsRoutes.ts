import { Router } from "express";
import type { BondPosition, PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  assertTreasuryBondsAccount,
  parseBondPositionCreate,
  parseBondPositionPatch,
  valuationForPosition,
} from "../domain/bondPositions";
import { sumBondGross } from "../domain/bondValuation";
import { decimalToNumber } from "../domain/money";
import { findOwnedAccount } from "../domain/ownedAccount";
import { badRequest } from "../lib/errors";
import { handleRouteError, notFound, parseIdParam } from "./httpSupport";

export type BondPositionsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

function bondPositionPayload(position: BondPosition, asOf: Date = new Date()) {
  const valuation = valuationForPosition(position, asOf);
  return {
    id: position.id,
    accountId: position.accountId,
    seriesCode: position.seriesCode,
    issuer: position.issuer,
    quantity: decimalToNumber(position.quantity),
    unitNominal: decimalToNumber(position.unitNominal),
    unitPurchasePrice: decimalToNumber(position.unitPurchasePrice),
    purchasedAt: position.purchasedAt.toISOString(),
    rateKind: position.rateKind,
    currentAnnualRatePct: decimalToNumber(position.currentAnnualRatePct),
    couponFrequency: position.couponFrequency,
    periodStart: position.periodStart.toISOString(),
    maturityDate: position.maturityDate.toISOString(),
    earlyExitFeePerUnit: decimalToNumber(position.earlyExitFeePerUnit),
    notes: position.notes,
    createdAt: position.createdAt.toISOString(),
    updatedAt: position.updatedAt.toISOString(),
    valuation,
  };
}

export function createBondPositionsRouter(deps: BondPositionsDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get(
    "/api/accounts/:accountId/bond-positions",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const account = await findOwnedAccount(prisma, uid(req), accountId);
        assertTreasuryBondsAccount(account);
        const positions = await prisma.bondPosition.findMany({
          where: { accountId },
          orderBy: [{ maturityDate: "asc" }, { id: "asc" }],
        });
        const asOf = new Date();
        const rows = positions.map((p) => bondPositionPayload(p, asOf));
        const valuations = rows.map((r) => r.valuation);
        const round2 = (n: number) => Math.round(n * 100) / 100;
        res.json({
          positions: rows,
          totals: {
            nominalValue: round2(
              valuations.reduce((s, v) => s + v.nominalValue, 0),
            ),
            grossValue: sumBondGross(valuations),
            liquidationNet: round2(
              valuations.reduce((s, v) => s + v.liquidationNet, 0),
            ),
          },
        });
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to list bond positions");
      }
    },
  );

  router.post(
    "/api/accounts/:accountId/bond-positions",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const account = await findOwnedAccount(prisma, uid(req), accountId);
        assertTreasuryBondsAccount(account);
        const input = parseBondPositionCreate(req.body ?? {});
        const position = await prisma.bondPosition.create({
          data: {
            accountId,
            seriesCode: input.seriesCode,
            issuer: input.issuer,
            quantity: input.quantity,
            unitNominal: input.unitNominal,
            unitPurchasePrice: input.unitPurchasePrice,
            purchasedAt: input.purchasedAt,
            rateKind: input.rateKind,
            currentAnnualRatePct: input.currentAnnualRatePct,
            couponFrequency: input.couponFrequency,
            periodStart: input.periodStart,
            maturityDate: input.maturityDate,
            earlyExitFeePerUnit: input.earlyExitFeePerUnit,
            notes: input.notes,
          },
        });
        res.status(201).json(bondPositionPayload(position));
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to create bond position");
      }
    },
  );

  router.patch(
    "/api/accounts/:accountId/bond-positions/:id",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const id = parseIdParam(req.params.id);
        const account = await findOwnedAccount(prisma, uid(req), accountId);
        assertTreasuryBondsAccount(account);
        const existing = await prisma.bondPosition.findFirst({
          where: { id, accountId },
        });
        if (!existing) throw notFound("Bond position not found");
        const patch = parseBondPositionPatch(req.body ?? {});
        const periodStart = patch.periodStart ?? existing.periodStart;
        const maturityDate = patch.maturityDate ?? existing.maturityDate;
        if (maturityDate.getTime() < periodStart.getTime()) {
          throw badRequest("maturityDate must be on or after periodStart");
        }
        const position = await prisma.bondPosition.update({
          where: { id },
          data: {
            ...(patch.seriesCode !== undefined
              ? { seriesCode: patch.seriesCode }
              : {}),
            ...(patch.issuer !== undefined ? { issuer: patch.issuer } : {}),
            ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
            ...(patch.unitNominal !== undefined
              ? { unitNominal: patch.unitNominal }
              : {}),
            ...(patch.unitPurchasePrice !== undefined
              ? { unitPurchasePrice: patch.unitPurchasePrice }
              : {}),
            ...(patch.purchasedAt !== undefined
              ? { purchasedAt: patch.purchasedAt }
              : {}),
            ...(patch.rateKind !== undefined ? { rateKind: patch.rateKind } : {}),
            ...(patch.currentAnnualRatePct !== undefined
              ? { currentAnnualRatePct: patch.currentAnnualRatePct }
              : {}),
            ...(patch.couponFrequency !== undefined
              ? { couponFrequency: patch.couponFrequency }
              : {}),
            ...(patch.periodStart !== undefined
              ? { periodStart: patch.periodStart }
              : {}),
            ...(patch.maturityDate !== undefined
              ? { maturityDate: patch.maturityDate }
              : {}),
            ...(patch.earlyExitFeePerUnit !== undefined
              ? { earlyExitFeePerUnit: patch.earlyExitFeePerUnit }
              : {}),
            ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          },
        });
        res.json(bondPositionPayload(position));
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to update bond position");
      }
    },
  );

  router.delete(
    "/api/accounts/:accountId/bond-positions/:id",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const id = parseIdParam(req.params.id);
        const account = await findOwnedAccount(prisma, uid(req), accountId);
        assertTreasuryBondsAccount(account);
        const existing = await prisma.bondPosition.findFirst({
          where: { id, accountId },
        });
        if (!existing) throw notFound("Bond position not found");
        await prisma.bondPosition.delete({ where: { id } });
        res.status(204).send();
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to delete bond position");
      }
    },
  );

  return router;
}
