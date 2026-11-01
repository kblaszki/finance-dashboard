import { Prisma, type Lot, type PrismaClient } from "@prisma/client";
import { badRequest } from "../lib/errors";

type Db = PrismaClient | Prisma.TransactionClient;

export type OpenLotInput = {
  holdingId: number;
  openTradeId: number;
  openedAt: Date;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  commissionOpen: Prisma.Decimal;
};

export type CloseAllocation = {
  lotId: number;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  commissionOpenShare: Prisma.Decimal;
};

/**
 * Open a new FIFO lot from a BUY.
 */
export async function openLot(db: Db, input: OpenLotInput): Promise<Lot> {
  return db.lot.create({
    data: {
      holdingId: input.holdingId,
      openTradeId: input.openTradeId,
      openedAt: input.openedAt,
      quantityOpen: input.quantity,
      quantityClosed: 0,
      unitCost: input.unitCost,
      commissionOpen: input.commissionOpen,
    },
  });
}

/**
 * Close `quantity` from oldest open lots (FIFO). Writes LotClose rows for `tradeId`.
 * Returns allocations used for realized P&L.
 */
export async function closeLotsFifo(
  db: Db,
  holdingId: number,
  quantity: Prisma.Decimal,
  tradeId: number,
): Promise<CloseAllocation[]> {
  if (quantity.lte(0)) throw badRequest("quantity must be a positive number");

  const lots = await db.lot.findMany({
    where: { holdingId, quantityOpen: { gt: 0 } },
    orderBy: [{ openedAt: "asc" }, { id: "asc" }],
  });

  let remaining = quantity;
  const allocations: CloseAllocation[] = [];

  for (const lot of lots) {
    if (remaining.lte(0)) break;
    const open = new Prisma.Decimal(lot.quantityOpen);
    if (open.lte(0)) continue;

    const take = remaining.lte(open) ? remaining : open;
    const nextOpen = open.sub(take);
    const nextClosed = new Prisma.Decimal(lot.quantityClosed).add(take);

    // Pro-rate remaining commissionOpen by remaining open qty after this close.
    const commissionShare = open.gt(0)
      ? new Prisma.Decimal(lot.commissionOpen).mul(take).div(open)
      : new Prisma.Decimal(0);

    await db.lot.update({
      where: { id: lot.id },
      data: {
        quantityOpen: nextOpen,
        quantityClosed: nextClosed,
        commissionOpen: new Prisma.Decimal(lot.commissionOpen).sub(commissionShare),
      },
    });
    await db.lotClose.create({
      data: {
        lotId: lot.id,
        tradeId,
        quantity: take,
        commissionAllocated: commissionShare,
      },
    });

    allocations.push({
      lotId: lot.id,
      quantity: take,
      unitCost: new Prisma.Decimal(lot.unitCost),
      commissionOpenShare: commissionShare,
    });
    remaining = remaining.sub(take);
  }

  if (remaining.gt(0)) {
    throw badRequest("insufficient open quantity to sell");
  }

  return allocations;
}

/**
 * Realized P&L for a SELL: proceeds − cost basis − sell commission − allocated open commission.
 * proceeds = qty * unitPrice; cost = sum(alloc.qty * unitCost).
 */
export function realizedPnl(
  allocations: CloseAllocation[],
  unitPrice: Prisma.Decimal,
  sellCommission: Prisma.Decimal,
): Prisma.Decimal {
  const qty = allocations.reduce(
    (sum, a) => sum.add(a.quantity),
    new Prisma.Decimal(0),
  );
  const proceeds = qty.mul(unitPrice);
  const cost = allocations.reduce(
    (sum, a) => sum.add(a.quantity.mul(a.unitCost)).add(a.commissionOpenShare),
    new Prisma.Decimal(0),
  );
  return proceeds.sub(cost).sub(sellCommission);
}

/** Restore lots closed by a SELL trade (reverse of closeLotsFifo). */
export async function reverseLotCloses(
  db: Db,
  tradeId: number,
): Promise<number | null> {
  const closes = await db.lotClose.findMany({
    where: { tradeId },
    include: { lot: true },
  });
  if (closes.length === 0) return null;

  let holdingId: number | null = null;
  for (const close of closes) {
    holdingId = close.lot.holdingId;
    const qty = new Prisma.Decimal(close.quantity);
    const commission = new Prisma.Decimal(close.commissionAllocated);
    await db.lot.update({
      where: { id: close.lotId },
      data: {
        quantityOpen: new Prisma.Decimal(close.lot.quantityOpen).add(qty),
        quantityClosed: new Prisma.Decimal(close.lot.quantityClosed).sub(qty),
        commissionOpen: new Prisma.Decimal(close.lot.commissionOpen).add(
          commission,
        ),
      },
    });
  }
  await db.lotClose.deleteMany({ where: { tradeId } });
  return holdingId;
}

/** Delete the lot opened by a BUY trade (only when fully open / no closes). */
export async function deleteOpenedLotForTrade(
  db: Db,
  tradeId: number,
): Promise<number | null> {
  const lot = await db.lot.findFirst({
    where: { openTradeId: tradeId },
  });
  if (!lot) return null;
  if (new Prisma.Decimal(lot.quantityClosed).gt(0)) {
    throw badRequest("cannot delete BUY trade: lot partially or fully sold");
  }
  const holdingId = lot.holdingId;
  await db.lot.delete({ where: { id: lot.id } });
  return holdingId;
}
