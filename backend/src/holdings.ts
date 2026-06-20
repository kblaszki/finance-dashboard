import type { Prisma, PrismaClient } from "@prisma/client";
import { convertAmount } from "./fx";
import { priceAsOf, recomputeQuantityAfterChain } from "./holdingLot";
import { toNumber } from "./accountValuation";

export type HoldingLotRow = {
  id: number;
  side: string;
  quantity: unknown;
  quantityAfter: unknown;
  totalPrice: unknown | null;
  pricePerUnit: unknown | null;
  currency: string;
  tradeDate: Date;
  createdAt: Date;
};

export type HoldingInstrument = {
  id: number;
  symbol: string;
  name: string | null;
  instrumentType: string;
  exchange: string | null;
  currency: string;
};

export type HoldingSummary = {
  id: number;
  accountId: number;
  instrumentId: number;
  quantity: number;
  instrument: HoldingInstrument;
  marketValue: number | null;
  realizedPnl: number | null;
  lastTradeDate: string | null;
};

export type AccountHoldingsResponse = {
  open: HoldingSummary[];
  closed: HoldingSummary[];
};

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function findOrCreateHolding(
  prisma: DbClient,
  accountId: number,
  instrumentId: number,
) {
  const existing = await prisma.holding.findUnique({
    where: { accountId_instrumentId: { accountId, instrumentId } },
  });
  if (existing) return existing;

  return prisma.holding.create({
    data: { accountId, instrumentId, quantity: 0 },
  });
}

export async function recalcLotQuantityChain(
  prisma: DbClient,
  holdingId: number,
): Promise<void> {
  const lots = await prisma.holdingLot.findMany({
    where: { holdingId },
    orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
  });
  const chain = recomputeQuantityAfterChain(
    lots.map((l) => ({
      id: l.id,
      side: l.side,
      quantity: toNumber(l.quantity),
      tradeDate: l.tradeDate,
    })),
  );
  for (const lot of lots) {
    const qa = chain.get(lot.id);
    if (qa != null) {
      await prisma.holdingLot.update({ where: { id: lot.id }, data: { quantityAfter: qa } });
    }
  }
}

export async function syncHoldingQuantity(prisma: DbClient, holdingId: number): Promise<number> {
  const lastLot = await prisma.holdingLot.findFirst({
    where: { holdingId },
    orderBy: [{ tradeDate: "desc" }, { id: "desc" }],
  });
  const quantity = lastLot ? toNumber(lastLot.quantityAfter) : 0;
  await prisma.holding.update({
    where: { id: holdingId },
    data: { quantity },
  });
  return quantity;
}

export function computeRealizedPnl(
  lots: Array<{ side: string; totalPrice: unknown | null; currency: string }>,
  accountCurrency: string,
  plnPerUnit: Record<string, number>,
): number {
  let buyTotal = 0;
  let sellTotal = 0;
  for (const lot of lots) {
    const amount = toNumber(lot.totalPrice ?? 0);
    const converted = convertAmount(amount, lot.currency, accountCurrency, plnPerUnit);
    if (lot.side === "BUY") buyTotal += converted;
    else if (lot.side === "SELL") sellTotal += converted;
  }
  return sellTotal - buyTotal;
}

async function getInstrumentPriceAsOf(
  prisma: DbClient,
  instrumentId: number,
  asOf: Date,
): Promise<number | null> {
  const rows = await prisma.instrumentValuation.findMany({
    where: { instrumentId, valuationDate: { lte: asOf } },
    orderBy: { valuationDate: "desc" },
    take: 50,
  });
  return priceAsOf(
    rows.map((r) => ({ valuationDate: r.valuationDate, price: toNumber(r.price) })),
    asOf,
  );
}

export async function computeMarketValue(
  prisma: DbClient,
  quantity: number,
  instrumentId: number,
  instrumentCurrency: string,
  accountCurrency: string,
  plnPerUnit: Record<string, number>,
  asOf: Date = new Date(),
): Promise<number | null> {
  if (quantity <= 0) return null;
  const rawPrice = await getInstrumentPriceAsOf(prisma, instrumentId, asOf);
  if (rawPrice == null) return null;
  const inInstrumentCcy = quantity * rawPrice;
  return convertAmount(inInstrumentCcy, instrumentCurrency, accountCurrency, plnPerUnit);
}

function lastTradeDateFromLots(lots: HoldingLotRow[]): string | null {
  if (!lots.length) return null;
  const latest = lots.reduce((best, lot) =>
    lot.tradeDate.getTime() > best.tradeDate.getTime() ? lot : best,
  );
  return latest.tradeDate.toISOString();
}

function serializeInstrument(instrument: HoldingInstrument): HoldingInstrument {
  return {
    id: instrument.id,
    symbol: instrument.symbol,
    name: instrument.name,
    instrumentType: instrument.instrumentType,
    exchange: instrument.exchange,
    currency: instrument.currency,
  };
}

export async function buildHoldingSummary(
  prisma: DbClient,
  holding: {
    id: number;
    accountId: number;
    instrumentId: number;
    quantity: unknown;
    instrument: HoldingInstrument;
    lots: HoldingLotRow[];
  },
  accountCurrency: string,
  plnPerUnit: Record<string, number>,
): Promise<HoldingSummary> {
  const quantity = toNumber(holding.quantity);
  const lastTradeDate = lastTradeDateFromLots(holding.lots);
  const isOpen = quantity > 0;

  return {
    id: holding.id,
    accountId: holding.accountId,
    instrumentId: holding.instrumentId,
    quantity,
    instrument: serializeInstrument(holding.instrument),
    marketValue: isOpen
      ? await computeMarketValue(
          prisma,
          quantity,
          holding.instrumentId,
          holding.instrument.currency,
          accountCurrency,
          plnPerUnit,
        )
      : null,
    realizedPnl: !isOpen
      ? computeRealizedPnl(holding.lots, accountCurrency, plnPerUnit)
      : null,
    lastTradeDate,
  };
}

export async function getAccountHoldings(
  prisma: DbClient,
  accountId: number,
  accountCurrency: string,
  plnPerUnit: Record<string, number>,
): Promise<AccountHoldingsResponse> {
  const rows = await prisma.holding.findMany({
    where: { accountId },
    include: {
      instrument: true,
      lots: { orderBy: [{ tradeDate: "asc" }, { id: "asc" }] },
    },
    orderBy: { instrument: { symbol: "asc" } },
  });

  const open: HoldingSummary[] = [];
  const closed: HoldingSummary[] = [];

  for (const holding of rows) {
    const summary = await buildHoldingSummary(
      prisma,
      holding,
      accountCurrency,
      plnPerUnit,
    );
    if (summary.quantity > 0) open.push(summary);
    else closed.push(summary);
  }

  return { open, closed };
}

export async function getHoldingForUser(
  prisma: DbClient,
  userId: number,
  holdingId: number,
) {
  return prisma.holding.findFirst({
    where: { id: holdingId, account: { userId } },
    include: {
      instrument: true,
      account: true,
      lots: { orderBy: [{ tradeDate: "desc" }, { id: "desc" }] },
    },
  });
}
