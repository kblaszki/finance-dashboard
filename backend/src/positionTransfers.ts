import type { Prisma, PrismaClient } from "@prisma/client";
import { toNumber } from "./accountValuation";
import { findOrCreateHolding, recalcLotQuantityChain, syncHoldingQuantity } from "./holdings";
import { badRequest, notFound } from "./routes/httpSupport";
import type { DbClient } from "./routes/routeSupport";

type DbClientLike = PrismaClient | Prisma.TransactionClient;

export type PositionTransferInput = {
  fromAccountId: number;
  toAccountId: number;
  instrumentId: number;
  quantity: number;
  transferDate: Date;
};

export type OpenBuySlice = {
  lotId: number;
  openQty: number;
  pricePerUnit: number;
  totalPrice: number;
  commission: number;
  currency: string;
  tradeDate: Date;
  settlementDate: Date | null;
};

export function computeOpenBuySlices(
  lots: Array<{
    id: number;
    side: string;
    quantity: unknown;
    pricePerUnit: unknown | null;
    totalPrice: unknown | null;
    commission?: unknown | null;
    currency: string;
    tradeDate: Date;
    settlementDate?: Date | null;
  }>,
): OpenBuySlice[] {
  const sorted = [...lots].sort((a, b) => {
    const byDate = a.tradeDate.getTime() - b.tradeDate.getTime();
    if (byDate !== 0) return byDate;
    return a.id - b.id;
  });

  let sellRemaining = 0;
  for (const lot of sorted) {
    if (lot.side === "SELL") {
      sellRemaining += toNumber(lot.quantity);
    }
  }

  const open: OpenBuySlice[] = [];
  for (const lot of sorted) {
    if (lot.side !== "BUY") continue;
    const qty = toNumber(lot.quantity);
    if (sellRemaining >= qty) {
      sellRemaining -= qty;
      continue;
    }
    const openQty = qty - sellRemaining;
    sellRemaining = 0;
    if (openQty <= 0) continue;
    const totalPrice = lot.totalPrice != null ? toNumber(lot.totalPrice) : 0;
    const pricePerUnit =
      lot.pricePerUnit != null ? toNumber(lot.pricePerUnit) : openQty > 0 ? totalPrice / qty : 0;
    open.push({
      lotId: lot.id,
      openQty,
      pricePerUnit,
      totalPrice,
      commission: toNumber(lot.commission ?? 0),
      currency: lot.currency,
      tradeDate: lot.tradeDate,
      settlementDate: lot.settlementDate ?? null,
    });
  }
  return open;
}

export function serializePositionTransfer(row: {
  id: number;
  fromAccountId: number;
  toAccountId: number;
  instrumentId: number;
  quantity: unknown;
  transferDate: Date;
  createdAt: Date;
  fromAccount?: { name: string };
  toAccount?: { name: string };
  instrument?: { symbol: string };
}) {
  return {
    id: row.id,
    fromAccountId: row.fromAccountId,
    fromAccountName: row.fromAccount?.name ?? null,
    toAccountId: row.toAccountId,
    toAccountName: row.toAccount?.name ?? null,
    instrumentId: row.instrumentId,
    symbol: row.instrument?.symbol ?? null,
    quantity: toNumber(row.quantity),
    transferDate: row.transferDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPositionTransfers(
  db: DbClient,
  userId: number,
  filters?: { accountId?: number; from?: Date; to?: Date },
) {
  return db.positionTransfer.findMany({
    where: {
      userId,
      ...(filters?.from || filters?.to
        ? {
            transferDate: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
      ...(filters?.accountId
        ? {
            OR: [{ fromAccountId: filters.accountId }, { toAccountId: filters.accountId }],
          }
        : {}),
    },
    include: {
      fromAccount: { select: { name: true } },
      toAccount: { select: { name: true } },
      instrument: { select: { symbol: true } },
    },
    orderBy: [{ transferDate: "desc" }, { id: "desc" }],
  });
}

type TransferDeps = {
  getFxRatesPlnPerUnit: () => Promise<{ plnPerUnit: Record<string, number> }>;
  recomputeAccountValuationsFrom: (
    db: DbClientLike,
    accountId: number,
    fromDate: Date,
    plnPerUnit: Record<string, number>,
  ) => Promise<void>;
};

export async function createPositionTransfer(
  prisma: PrismaClient,
  userId: number,
  input: PositionTransferInput,
  deps: TransferDeps,
) {
  if (input.fromAccountId === input.toAccountId) {
    throw badRequest("Source and destination accounts must differ");
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw badRequest("quantity must be positive");
  }

  const [fromAccount, toAccount] = await Promise.all([
    prisma.account.findFirst({ where: { id: input.fromAccountId, userId } }),
    prisma.account.findFirst({ where: { id: input.toAccountId, userId } }),
  ]);
  if (!fromAccount) throw notFound("Source account not found");
  if (!toAccount) throw notFound("Destination account not found");
  if (fromAccount.accountType !== "BROKERAGE" || toAccount.accountType !== "BROKERAGE") {
    throw badRequest("Position transfers require brokerage accounts");
  }

  const instrument = await prisma.instrument.findUnique({ where: { id: input.instrumentId } });
  if (!instrument) throw notFound("Instrument not found");

  const sourceHolding = await prisma.holding.findFirst({
    where: { accountId: input.fromAccountId, instrumentId: input.instrumentId },
    include: { lots: { orderBy: [{ tradeDate: "asc" }, { id: "asc" }] } },
  });
  if (!sourceHolding) throw badRequest("No position on source account");

  const openSlices = computeOpenBuySlices(sourceHolding.lots);
  const openTotal = openSlices.reduce((sum, slice) => sum + slice.openQty, 0);
  if (openTotal + 1e-9 < input.quantity) {
    throw badRequest(`Insufficient open quantity (have ${openTotal}, need ${input.quantity})`);
  }

  const { plnPerUnit } = await deps.getFxRatesPlnPerUnit();

  return prisma.$transaction(async (tx) => {
    let remaining = input.quantity;
    for (const slice of openSlices) {
      if (remaining <= 0) break;
      const moveQty = Math.min(remaining, slice.openQty);
      remaining -= moveQty;

      const sourceLot = await tx.holdingLot.findUniqueOrThrow({ where: { id: slice.lotId } });
      const sourceQty = toNumber(sourceLot.quantity);
      const ratio = moveQty / sourceQty;
      const moveCommission = slice.commission * ratio;
      const moveTotal = slice.totalPrice * ratio;

      if (Math.abs(moveQty - sourceQty) < 1e-9) {
        await tx.holdingLot.delete({ where: { id: slice.lotId } });
      } else {
        const keepQty = sourceQty - moveQty;
        const keepTotal = slice.totalPrice - moveTotal;
        const keepCommission = slice.commission - moveCommission;
        await tx.holdingLot.update({
          where: { id: slice.lotId },
          data: {
            quantity: keepQty,
            totalPrice: keepTotal,
            commission: keepCommission,
            pricePerUnit: keepQty > 0 ? keepTotal / keepQty : 0,
          },
        });
      }

      const destHolding = await findOrCreateHolding(tx, input.toAccountId, input.instrumentId);
      await tx.holdingLot.create({
        data: {
          holdingId: destHolding.id,
          side: "BUY",
          quantity: moveQty,
          quantityAfter: 0,
          totalPrice: moveTotal,
          commission: moveCommission,
          pricePerUnit: moveQty > 0 ? moveTotal / moveQty : 0,
          currency: slice.currency,
          tradeDate: slice.tradeDate,
          settlementDate: slice.settlementDate,
        },
      });
    }

    await recalcLotQuantityChain(tx, sourceHolding.id);
    await syncHoldingQuantity(tx, sourceHolding.id);

    const destHolding = await findOrCreateHolding(tx, input.toAccountId, input.instrumentId);
    await recalcLotQuantityChain(tx, destHolding.id);
    await syncHoldingQuantity(tx, destHolding.id);

    await deps.recomputeAccountValuationsFrom(tx, input.fromAccountId, input.transferDate, plnPerUnit);
    await deps.recomputeAccountValuationsFrom(tx, input.toAccountId, input.transferDate, plnPerUnit);

    const row = await tx.positionTransfer.create({
      data: {
        userId,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        instrumentId: input.instrumentId,
        quantity: input.quantity,
        transferDate: input.transferDate,
      },
      include: {
        fromAccount: { select: { name: true } },
        toAccount: { select: { name: true } },
        instrument: { select: { symbol: true } },
      },
    });
    return row;
  });
}
