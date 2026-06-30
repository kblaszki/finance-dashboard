import type { Prisma, PrismaClient } from "@prisma/client";
import { applyStockSplit } from "./stockSplit";
import { syncHoldingQuantity } from "./holdings";
import { badRequest, notFound } from "./routes/httpSupport";
import type { DbClient } from "./routes/routeSupport";

type DbClientLike = PrismaClient | Prisma.TransactionClient;

export const CORPORATE_ACTION_TYPES = ["stock_split", "reverse_split", "merger", "spinoff"] as const;
export type CorporateActionType = (typeof CORPORATE_ACTION_TYPES)[number];

const ACTION_SET = new Set<string>(CORPORATE_ACTION_TYPES);

export function parseCorporateActionType(value: unknown): CorporateActionType {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!ACTION_SET.has(raw)) {
    throw badRequest(`Invalid actionType: ${raw}`);
  }
  return raw as CorporateActionType;
}

export type CorporateActionInput = {
  accountId: number;
  holdingId?: number | null;
  instrumentId: number;
  actionType: CorporateActionType;
  actionDate: Date;
  ratio?: number | null;
  quantityDelta?: number | null;
  notes?: string | null;
};

export function serializeCorporateAction(row: {
  id: number;
  accountId: number;
  holdingId: number | null;
  instrumentId: number;
  actionType: string;
  actionDate: Date;
  ratio: unknown | null;
  quantityDelta: unknown | null;
  notes: string | null;
  createdAt: Date;
  account?: { name: string };
  instrument?: { symbol: string };
}) {
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    holdingId: row.holdingId,
    instrumentId: row.instrumentId,
    symbol: row.instrument?.symbol ?? null,
    actionType: row.actionType,
    actionDate: row.actionDate.toISOString(),
    ratio: row.ratio != null ? Number(row.ratio) : null,
    quantityDelta: row.quantityDelta != null ? Number(row.quantityDelta) : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listCorporateActions(
  db: DbClient,
  userId: number,
  filters?: { accountId?: number; from?: Date; to?: Date },
) {
  return db.corporateAction.findMany({
    where: {
      userId,
      ...(filters?.accountId ? { accountId: filters.accountId } : {}),
      ...(filters?.from || filters?.to
        ? {
            actionDate: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    include: {
      account: { select: { name: true } },
      instrument: { select: { symbol: true } },
    },
    orderBy: [{ actionDate: "desc" }, { id: "desc" }],
  });
}

type ActionDeps = {
  getFxRatesPlnPerUnit: () => Promise<{ plnPerUnit: Record<string, number> }>;
  recomputeAccountValuationsFrom: (
    db: DbClientLike,
    accountId: number,
    fromDate: Date,
    plnPerUnit: Record<string, number>,
  ) => Promise<void>;
};

export async function createCorporateAction(
  prisma: PrismaClient,
  userId: number,
  input: CorporateActionInput,
  deps: ActionDeps,
) {
  const account = await prisma.account.findFirst({
    where: { id: input.accountId, userId },
  });
  if (!account) throw notFound("Account not found");
  if (account.accountType !== "BROKERAGE") {
    throw badRequest("Corporate actions apply to brokerage accounts");
  }

  const instrument = await prisma.instrument.findUnique({ where: { id: input.instrumentId } });
  if (!instrument) throw notFound("Instrument not found");

  let holdingId = input.holdingId ?? null;
  if (holdingId == null) {
    const holding = await prisma.holding.findFirst({
      where: { accountId: input.accountId, instrumentId: input.instrumentId },
    });
    holdingId = holding?.id ?? null;
  }

  const { plnPerUnit } = await deps.getFxRatesPlnPerUnit();

  return prisma.$transaction(async (tx) => {
    if (input.actionType === "stock_split" || input.actionType === "reverse_split") {
      if (holdingId == null) throw badRequest("holdingId required for split actions");
      const ratio = input.ratio;
      if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) {
        throw badRequest("ratio is required for split actions");
      }
      const effectiveRatio = input.actionType === "reverse_split" ? 1 / ratio : ratio;
      await applyStockSplit(tx, holdingId, effectiveRatio);
      await syncHoldingQuantity(tx, holdingId);
      await deps.recomputeAccountValuationsFrom(tx, input.accountId, input.actionDate, plnPerUnit);
    }

    const data: Prisma.CorporateActionCreateInput = {
      user: { connect: { id: userId } },
      account: { connect: { id: input.accountId } },
      instrument: { connect: { id: input.instrumentId } },
      actionType: input.actionType,
      actionDate: input.actionDate,
      ratio: input.ratio ?? null,
      quantityDelta: input.quantityDelta ?? null,
      notes: input.notes ?? null,
      ...(holdingId != null ? { holding: { connect: { id: holdingId } } } : {}),
    };

    const row = await tx.corporateAction.create({
      data,
      include: {
        account: { select: { name: true } },
        instrument: { select: { symbol: true } },
      },
    });
    return row;
  });
}
