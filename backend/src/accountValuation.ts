import type { PrismaClient } from "@prisma/client";
import { convertAmount } from "./fx";
import { priceAsOf } from "./holdingLot";

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (v && typeof v === "object") {
    const anyV = v as { toNumber?: () => number; toString?: () => string };
    if (typeof anyV.toNumber === "function") return anyV.toNumber();
    if (typeof anyV.toString === "function") return Number(anyV.toString());
  }
  return Number(v);
}

function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export async function computeCashAsOf(
  prisma: PrismaClient,
  accountId: number,
  asOf: Date,
): Promise<number> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return 0;

  const lastTx = await prisma.transaction.findFirst({
    where: { accountId, date: { lte: asOf } },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  if (lastTx) return toNumber(lastTx.balanceAfter);
  return toNumber(account.openingBalance);
}

export async function netQuantityAsOf(
  prisma: PrismaClient,
  accountId: number,
  instrumentId: number,
  asOf: Date,
): Promise<number> {
  const lastLot = await prisma.holdingLot.findFirst({
    where: { accountId, instrumentId, tradeDate: { lte: asOf } },
    orderBy: [{ tradeDate: "desc" }, { id: "desc" }],
  });
  return lastLot ? toNumber(lastLot.quantityAfter) : 0;
}

async function getInstrumentPriceAsOf(
  prisma: PrismaClient,
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

export async function recomputeAccountValuationsFrom(
  prisma: PrismaClient,
  accountId: number,
  fromDate: Date,
  plnPerUnit: Record<string, number>,
): Promise<void> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return;

  const from = utcDateOnly(fromDate);
  await prisma.accountValuationDaily.deleteMany({
    where: { accountId, valuationDate: { gte: from } },
  });
  await prisma.holdingValuationDaily.deleteMany({
    where: { accountId, valuationDate: { gte: from } },
  });

  const dates = new Set<string>();
  const pushDate = (d: Date) => dates.add(utcDateOnly(d).toISOString());

  const txs = await prisma.transaction.findMany({
    where: { accountId, date: { gte: from } },
  });
  for (const t of txs) pushDate(t.date);

  const lots = await prisma.holdingLot.findMany({
    where: { accountId, tradeDate: { gte: from } },
  });
  for (const l of lots) pushDate(l.tradeDate);

  const instrumentIds = [
    ...new Set(
      (
        await prisma.holdingLot.findMany({
          where: { accountId },
          select: { instrumentId: true },
        })
      ).map((r) => r.instrumentId),
    ),
  ];

  for (const instrumentId of instrumentIds) {
    const valuations = await prisma.instrumentValuation.findMany({
      where: { instrumentId, valuationDate: { gte: from } },
    });
    for (const v of valuations) pushDate(v.valuationDate);
  }

  if (!dates.size) {
    pushDate(from);
  }

  const sorted = [...dates].map((s) => new Date(s)).sort((a, b) => a.getTime() - b.getTime());
  const displayCurrency = account.currency;

  for (const day of sorted) {
    const end = new Date(day);
    end.setUTCHours(23, 59, 59, 999);

    const cashValue = await computeCashAsOf(prisma, accountId, end);
    let securitiesValue = 0;
    const heldIds = [
      ...new Set(
        (
          await prisma.holdingLot.findMany({
            where: { accountId, tradeDate: { lte: end } },
            select: { instrumentId: true },
          })
        ).map((r) => r.instrumentId),
      ),
    ];

    for (const instrumentId of heldIds) {
      const qty = await netQuantityAsOf(prisma, accountId, instrumentId, end);
      if (qty <= 0) continue;

      const instrument = await prisma.instrument.findUnique({ where: { id: instrumentId } });
      if (!instrument) continue;

      const rawPrice = await getInstrumentPriceAsOf(prisma, instrumentId, end);
      let marketValue = 0;
      if (rawPrice != null) {
        const inInstrumentCcy = qty * rawPrice;
        marketValue = convertAmount(inInstrumentCcy, instrument.currency, displayCurrency, plnPerUnit);
      }

      securitiesValue += marketValue;

      await prisma.holdingValuationDaily.upsert({
        where: {
          accountId_instrumentId_valuationDate: {
            accountId,
            instrumentId,
            valuationDate: day,
          },
        },
        create: {
          accountId,
          instrumentId,
          valuationDate: day,
          quantity: qty,
          marketValue,
          currency: displayCurrency,
        },
        update: { quantity: qty, marketValue },
      });
    }

    const totalValue = cashValue + securitiesValue;
    await prisma.accountValuationDaily.upsert({
      where: { accountId_valuationDate: { accountId, valuationDate: day } },
      create: {
        accountId,
        valuationDate: day,
        totalValue,
        cashValue,
        securitiesValue,
        currency: displayCurrency,
      },
      update: { totalValue, cashValue, securitiesValue },
    });
  }
}

export async function backfillAccountValuations(
  prisma: PrismaClient,
  accountId: number,
  plnPerUnit: Record<string, number>,
): Promise<void> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return;
  await recomputeAccountValuationsFrom(prisma, accountId, account.createdAt, plnPerUnit);
}

export async function getLatestAccountTotalValue(
  prisma: PrismaClient,
  accountId: number,
): Promise<number | null> {
  const row = await prisma.accountValuationDaily.findFirst({
    where: { accountId },
    orderBy: { valuationDate: "desc" },
  });
  return row ? toNumber(row.totalValue) : null;
}

export { utcDateOnly, addDays, toNumber };
