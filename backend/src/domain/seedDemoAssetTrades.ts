import { Prisma, type PrismaClient } from "@prisma/client";
import { applyAssetTrade } from "./assetTrades";
import { utcDateFromYmd } from "./fx";
import { INSTRUMENT_PROVIDER_TWELVE_DATA } from "./instruments";
import { pickLatestCollapsedClose } from "./portfolioValuation";
import {
  DEMO_ACCOUNT_NAMES,
  type DemoAccountKey,
} from "./seedDemoPortfolio";

type Db = PrismaClient | Prisma.TransactionClient;

export type DemoTradeAccountKey = "brokerage" | "brokerageUsd" | "ike";

export type DemoPlannedAssetTrade = {
  accountKey: DemoTradeAccountKey;
  providerSymbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  /** UTC calendar day; price = valuation on or before this day. */
  asOfYmd: string;
  commission: number;
  notes: string;
};

export type SeedDemoAssetTradesResult = {
  applied: number;
  skipped: Array<{ reason: string; trade: DemoPlannedAssetTrade }>;
  openHoldingsSummary: Array<{
    account: string;
    symbol: string;
    quantity: number;
  }>;
};

/**
 * Deterministic BUY/SELL script aligned with demo-eod.ndjson month-end closes.
 * SPX omitted (index). USD symbols → brokerageUsd; PLN → brokerage / ike.
 */
export function buildDemoAssetTradePlan(
  _now: Date = new Date(),
): DemoPlannedAssetTrade[] {
  void _now;
  return [
    // Brokerage PLN — build GPW book, partial sells
    {
      accountKey: "brokerage",
      providerSymbol: "ETFBW20TR",
      side: "BUY",
      quantity: 50,
      asOfYmd: "2025-11-28",
      commission: 5,
      notes: "Seed: open WIG20TR ETF",
    },
    {
      accountKey: "brokerage",
      providerSymbol: "XTB",
      side: "BUY",
      quantity: 25,
      asOfYmd: "2025-12-30",
      commission: 5,
      notes: "Seed: open XTB",
    },
    {
      accountKey: "brokerage",
      providerSymbol: "ETFBW20TR",
      side: "BUY",
      quantity: 30,
      asOfYmd: "2026-01-30",
      commission: 5,
      notes: "Seed: DCA ETFBW20TR",
    },
    {
      accountKey: "brokerage",
      providerSymbol: "XTB",
      side: "BUY",
      quantity: 15,
      asOfYmd: "2026-02-27",
      commission: 5,
      notes: "Seed: add XTB",
    },
    {
      accountKey: "brokerage",
      providerSymbol: "XTB",
      side: "SELL",
      quantity: 20,
      asOfYmd: "2026-04-30",
      commission: 5,
      notes: "Seed: take XTB profit (FIFO)",
    },
    {
      accountKey: "brokerage",
      providerSymbol: "ETFBW20TR",
      side: "BUY",
      quantity: 20,
      asOfYmd: "2026-05-29",
      commission: 5,
      notes: "Seed: add ETFBW20TR",
    },
    {
      accountKey: "brokerage",
      providerSymbol: "ETFBW20TR",
      side: "SELL",
      quantity: 25,
      asOfYmd: "2026-07-31",
      commission: 5,
      notes: "Seed: trim ETFBW20TR",
    },
    {
      accountKey: "brokerage",
      providerSymbol: "XTB",
      side: "BUY",
      quantity: 10,
      asOfYmd: "2026-09-30",
      commission: 5,
      notes: "Seed: rebuy XTB after pullback",
    },

    // IKE PLN — small ETF DCA
    {
      accountKey: "ike",
      providerSymbol: "ETFBW20TR",
      side: "BUY",
      quantity: 15,
      asOfYmd: "2026-01-30",
      commission: 3,
      notes: "Seed: IKE ETF DCA",
    },
    {
      accountKey: "ike",
      providerSymbol: "ETFBW20TR",
      side: "BUY",
      quantity: 15,
      asOfYmd: "2026-04-30",
      commission: 3,
      notes: "Seed: IKE ETF DCA",
    },
    {
      accountKey: "ike",
      providerSymbol: "ETFBW20TR",
      side: "BUY",
      quantity: 10,
      asOfYmd: "2026-07-31",
      commission: 3,
      notes: "Seed: IKE ETF DCA",
    },

    // Brokerage USD — AAPL / VOO
    {
      accountKey: "brokerageUsd",
      providerSymbol: "AAPL",
      side: "BUY",
      quantity: 8,
      asOfYmd: "2025-11-28",
      commission: 1,
      notes: "Seed: open AAPL",
    },
    {
      accountKey: "brokerageUsd",
      providerSymbol: "VOO",
      side: "BUY",
      quantity: 4,
      asOfYmd: "2025-12-31",
      commission: 1,
      notes: "Seed: open VOO",
    },
    {
      accountKey: "brokerageUsd",
      providerSymbol: "AAPL",
      side: "BUY",
      quantity: 4,
      asOfYmd: "2026-03-31",
      commission: 1,
      notes: "Seed: buy AAPL dip",
    },
    {
      accountKey: "brokerageUsd",
      providerSymbol: "AAPL",
      side: "SELL",
      quantity: 5,
      asOfYmd: "2026-05-29",
      commission: 1,
      notes: "Seed: trim AAPL (FIFO)",
    },
    {
      accountKey: "brokerageUsd",
      providerSymbol: "VOO",
      side: "BUY",
      quantity: 2,
      asOfYmd: "2026-06-30",
      commission: 1,
      notes: "Seed: add VOO",
    },
    {
      accountKey: "brokerageUsd",
      providerSymbol: "VOO",
      side: "SELL",
      quantity: 2,
      asOfYmd: "2026-09-30",
      commission: 1,
      notes: "Seed: trim VOO",
    },
  ];
}

/** Simulated open qty after applying plan chronologically (for unit tests). */
export function simulateOpenQtyFromPlan(
  plan: DemoPlannedAssetTrade[],
): Map<string, number> {
  const open = new Map<string, number>();
  for (const trade of plan) {
    const key = `${trade.accountKey}:${trade.providerSymbol}`;
    const prev = open.get(key) ?? 0;
    if (trade.side === "BUY") open.set(key, prev + trade.quantity);
    else open.set(key, prev - trade.quantity);
  }
  return open;
}

async function closeOnOrBefore(
  db: Db,
  instrumentId: number,
  asOfYmd: string,
): Promise<{ asOf: string; close: number } | null> {
  const exclusive = utcDateFromYmd(asOfYmd);
  exclusive.setUTCDate(exclusive.getUTCDate() + 1);
  const rows = await db.instrumentValuation.findMany({
    where: {
      instrumentId,
      asOfDate: { lt: exclusive },
    },
    select: { asOfDate: true, close: true, source: true },
  });
  return pickLatestCollapsedClose(rows);
}

/**
 * Apply planned demo asset trades after markets valuations exist.
 * Missing instruments/prices → skip with reason (portfolio still valid).
 */
export async function seedDemoAssetTrades(
  db: PrismaClient,
  userId: number,
  now: Date = new Date(),
): Promise<SeedDemoAssetTradesResult> {
  const plan = buildDemoAssetTradePlan(now);
  const skipped: SeedDemoAssetTradesResult["skipped"] = [];
  let applied = 0;

  const accounts = await db.account.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      currency: true,
      accountType: true,
      cashBalance: true,
    },
  });
  const accountByKey = new Map<DemoAccountKey, (typeof accounts)[number]>();
  for (const [key, name] of Object.entries(DEMO_ACCOUNT_NAMES) as Array<
    [DemoAccountKey, string]
  >) {
    const row = accounts.find((a) => a.name === name);
    if (row) accountByKey.set(key, row);
  }

  for (const trade of plan) {
    const account = accountByKey.get(trade.accountKey);
    if (!account) {
      skipped.push({ reason: `account ${trade.accountKey} missing`, trade });
      continue;
    }

    const instrument = await db.instrument.findUnique({
      where: {
        provider_providerSymbol: {
          provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
          providerSymbol: trade.providerSymbol,
        },
      },
      select: { id: true, currency: true, symbol: true },
    });
    if (!instrument) {
      skipped.push({
        reason: `instrument ${trade.providerSymbol} missing`,
        trade,
      });
      continue;
    }

    const picked = await closeOnOrBefore(db, instrument.id, trade.asOfYmd);
    if (!picked) {
      skipped.push({
        reason: `no valuation on or before ${trade.asOfYmd}`,
        trade,
      });
      continue;
    }

    const unitPrice = new Prisma.Decimal(picked.close).toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
    );
    const occurredAt = new Date(`${trade.asOfYmd}T12:00:00.000Z`);

    try {
      await db.$transaction(async (tx) => {
        const fresh = await tx.account.findUniqueOrThrow({
          where: { id: account.id },
        });
        await applyAssetTrade(
          tx,
          {
            id: fresh.id,
            currency: fresh.currency,
            accountType: fresh.accountType,
            cashBalance: fresh.cashBalance,
          },
          {
            id: instrument.id,
            currency: instrument.currency,
            symbol: instrument.symbol,
          },
          {
            instrumentId: instrument.id,
            side: trade.side,
            quantity: new Prisma.Decimal(trade.quantity),
            unitPrice,
            commission: new Prisma.Decimal(trade.commission),
            occurredAt,
            settlementDate: null,
            notes: trade.notes,
          },
        );
      });
      applied += 1;
      // Refresh cached account cash for subsequent sufficiency checks in-memory map
      const refreshed = await db.account.findUniqueOrThrow({
        where: { id: account.id },
      });
      accountByKey.set(trade.accountKey, {
        ...account,
        cashBalance: refreshed.cashBalance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skipped.push({ reason: message, trade });
    }
  }

  const holdings = await db.holding.findMany({
    where: {
      account: { userId },
      quantity: { gt: 0 },
    },
    include: {
      account: { select: { name: true } },
      instrument: { select: { symbol: true } },
    },
    orderBy: [{ accountId: "asc" }, { instrumentId: "asc" }],
  });

  return {
    applied,
    skipped,
    openHoldingsSummary: holdings.map((h) => ({
      account: h.account.name,
      symbol: h.instrument.symbol,
      quantity: Number(h.quantity),
    })),
  };
}
