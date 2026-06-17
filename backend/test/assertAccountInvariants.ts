import type { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import { computeCashAsOf, toNumber } from "../src/accountValuation";

const TOLERANCE = 0.02;

function approxEqual(a: number, b: number, msg: string): void {
  assert.ok(Math.abs(a - b) <= TOLERANCE, `${msg}: expected ${b}, got ${a}`);
}

export async function assertAccountInvariants(
  prisma: PrismaClient,
  accountId: number,
): Promise<void> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  assert.ok(account, `Account ${accountId} not found`);

  if (account.accountType === "BANK") {
    const lastTx = await prisma.transaction.findFirst({
      where: { accountId },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
    const expectedCash = lastTx ? toNumber(lastTx.balanceAfter) : toNumber(account.openingBalance);
    approxEqual(
      toNumber(account.cashBalance),
      expectedCash,
      `Account ${accountId} cashBalance vs last transaction`,
    );
  } else if (account.accountType === "BROKERAGE") {
    const replayCash = await computeCashAsOf(prisma, accountId, new Date());
    approxEqual(
      toNumber(account.cashBalance),
      replayCash,
      `Account ${accountId} cashBalance vs replay`,
    );
  }

  const instrumentIds = [
    ...new Set(
      (await prisma.holdingLot.findMany({ where: { accountId }, select: { instrumentId: true } })).map(
        (r) => r.instrumentId,
      ),
    ),
  ];

  for (const instrumentId of instrumentIds) {
    const lots = await prisma.holdingLot.findMany({
      where: { accountId, instrumentId },
      orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
    });
    let net = 0;
    for (const lot of lots) {
      const qty = toNumber(lot.quantityAfter);
      assert.ok(qty >= 0, `Negative quantityAfter on lot ${lot.id}`);
      net = qty;
    }
    const lastLot = lots[lots.length - 1];
    if (lastLot) {
      let sumBuy = 0;
      let sumSell = 0;
      for (const lot of lots) {
        if (lot.side === "BUY") sumBuy += toNumber(lot.quantity);
        else if (lot.side === "SELL") sumSell += toNumber(lot.quantity);
      }
      approxEqual(
        toNumber(lastLot.quantityAfter),
        sumBuy - sumSell,
        `Account ${accountId} instrument ${instrumentId} quantity chain`,
      );
    }
  }

  const snapshots = await prisma.accountValuationDaily.findMany({
    where: { accountId },
    orderBy: { valuationDate: "asc" },
  });

  for (const snap of snapshots) {
    const total = toNumber(snap.totalValue);
    const cash = toNumber(snap.cashValue);
    const securities = toNumber(snap.securitiesValue);
    approxEqual(total, cash + securities, `Snapshot ${snap.valuationDate.toISOString()} totalValue`);

    const holdingRows = await prisma.holdingValuationDaily.findMany({
      where: { accountId, valuationDate: snap.valuationDate },
    });
    const sumMarket = holdingRows.reduce((s, r) => s + toNumber(r.marketValue), 0);
    approxEqual(
      securities,
      sumMarket,
      `Snapshot ${snap.valuationDate.toISOString()} securitiesValue`,
    );
  }

  const lastSnap = await prisma.accountValuationDaily.findFirst({
    where: { accountId },
    orderBy: { valuationDate: "desc" },
  });
  if (lastSnap && (account.accountType === "BANK" || account.accountType === "BROKERAGE")) {
    approxEqual(
      toNumber(lastSnap.cashValue),
      toNumber(account.cashBalance),
      `Account ${accountId} latest snapshot cashValue vs cashBalance`,
    );
  }
}
