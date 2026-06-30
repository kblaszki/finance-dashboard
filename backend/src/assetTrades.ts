import type { PrismaClient } from "@prisma/client";
import { HOLDINGS_ACCOUNT_TYPES } from "./accountTypes";
import { recomputeQuantityAfterChain } from "./holdingLot";
import { findOrCreateHolding, recalcLotQuantityChain, syncHoldingQuantity } from "./holdings";
import type { DbClient } from "./routes/routeSupport";
import { syncBrokerageCashBalance } from "./accountValuation";

export type AssetTradeFilters = {
  accountId?: number;
  instrumentId?: number;
  from?: Date;
  to?: Date;
};

export async function fetchUserAssetTrades(
  prisma: PrismaClient,
  userId: number,
  filters: AssetTradeFilters,
) {
  const tradeDate: { gte?: Date; lte?: Date } = {};
  if (filters.from) tradeDate.gte = filters.from;
  if (filters.to) tradeDate.lte = filters.to;

  return prisma.holdingLot.findMany({
    where: {
      side: { in: ["BUY", "SELL"] },
      ...(Object.keys(tradeDate).length > 0 ? { tradeDate } : {}),
      holding: {
        account: {
          userId,
          accountType: { in: [...HOLDINGS_ACCOUNT_TYPES] },
          ...(filters.accountId != null ? { id: filters.accountId } : {}),
        },
        ...(filters.instrumentId != null ? { instrumentId: filters.instrumentId } : {}),
      },
    },
    include: {
      holding: {
        include: {
          instrument: true,
          account: { select: { id: true, name: true, currency: true } },
        },
      },
    },
    orderBy: [{ tradeDate: "desc" }, { id: "desc" }],
  });
}

type CreateAssetTradeInput = {
  accountId: number;
  instrumentId: number;
  side: string;
  quantity: number;
  currency: string;
  tradeDate: Date;
  totalPrice?: number | null;
  pricePerUnit?: number | null;
};

type CreateAssetTradeDeps = {
  resolveLotPrice: (input: {
    quantity: number;
    totalPrice?: number | null;
    pricePerUnit?: number | null;
  }) => { totalPrice: number; pricePerUnit: number };
  getFxRatesPlnPerUnit: () => Promise<{ plnPerUnit: Record<string, number> }>;
  recomputeAccountValuationsFrom: (
    db: DbClient,
    accountId: number,
    fromDate: Date,
    plnPerUnit: Record<string, number>,
  ) => Promise<void>;
  toNumber: (value: unknown) => number;
};

export async function createUserAssetTrade(
  prisma: PrismaClient,
  holdingId: number,
  account: { id: number; currency: string },
  input: Omit<CreateAssetTradeInput, "accountId" | "instrumentId">,
  deps: CreateAssetTradeDeps,
) {
  const { plnPerUnit } = await deps.getFxRatesPlnPerUnit();
  const prices = deps.resolveLotPrice({
    quantity: input.quantity,
    ...(input.totalPrice !== undefined ? { totalPrice: input.totalPrice } : {}),
    ...(input.pricePerUnit !== undefined ? { pricePerUnit: input.pricePerUnit } : {}),
  });

  return prisma.$transaction(async (tx) => {
    const existingLots = await tx.holdingLot.findMany({
      where: { holdingId },
      orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
    });
    recomputeQuantityAfterChain([
      ...existingLots.map((lot) => ({
        id: lot.id,
        side: lot.side,
        quantity: deps.toNumber(lot.quantity),
        tradeDate: lot.tradeDate,
      })),
      { id: -1, side: input.side, quantity: input.quantity, tradeDate: input.tradeDate },
    ]);

    const created = await tx.holdingLot.create({
      data: {
        holdingId,
        side: input.side,
        quantity: input.quantity,
        quantityAfter: 0,
        totalPrice: prices.totalPrice,
        pricePerUnit: prices.pricePerUnit,
        currency: input.currency,
        tradeDate: input.tradeDate,
      },
    });

    await recalcLotQuantityChain(tx, holdingId);
    await syncHoldingQuantity(tx, holdingId);
    await syncBrokerageCashBalance(tx, account.id);
    await deps.recomputeAccountValuationsFrom(tx, account.id, input.tradeDate, plnPerUnit);

    return tx.holdingLot.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        holding: {
          include: {
            instrument: true,
            account: { select: { id: true, name: true, currency: true } },
          },
        },
      },
    });
  });
}

export async function createUserAssetTradeForAccount(
  prisma: PrismaClient,
  account: { id: number; currency: string },
  input: CreateAssetTradeInput,
  deps: CreateAssetTradeDeps,
) {
  const holding = await findOrCreateHolding(prisma, account.id, input.instrumentId);
  return createUserAssetTrade(
    prisma,
    holding.id,
    account,
    {
      side: input.side,
      quantity: input.quantity,
      currency: input.currency,
      tradeDate: input.tradeDate,
      ...(input.totalPrice !== undefined ? { totalPrice: input.totalPrice } : {}),
      ...(input.pricePerUnit !== undefined ? { pricePerUnit: input.pricePerUnit } : {}),
    },
    deps,
  );
}
