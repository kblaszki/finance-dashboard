import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  createTestPrisma,
  disconnectTestPrisma,
  resetDatabase,
} from "../../test/prismaTestClient";
import { canonicalUsernameKey, hashPassword } from "../auth";
import { INSTRUMENT_PROVIDER_TWELVE_DATA } from "./instruments";
import { serializeHistoryNdjsonRow } from "./marketHistoryIo";
import { seedDemoMarkets } from "./seedDemoMarkets";
import { DEMO_ACCOUNT_NAMES, seedDemoPortfolio } from "./seedDemoPortfolio";
import {
  buildDemoAssetTradePlan,
  seedDemoAssetTrades,
  simulateOpenQtyFromPlan,
} from "./seedDemoAssetTrades";

const FIXED_NOW = new Date("2026-10-15T12:00:00.000Z");

test("buildDemoAssetTradePlan is deterministic and BUY-before-SELL safe", () => {
  const a = buildDemoAssetTradePlan(FIXED_NOW);
  const b = buildDemoAssetTradePlan(FIXED_NOW);
  assert.deepEqual(a, b);
  assert.ok(a.length >= 8 && a.length <= 20);

  const open = simulateOpenQtyFromPlan(a);
  for (const [key, qty] of open) {
    assert.ok(qty >= 0, `${key} ended negative (${qty})`);
  }
  assert.ok((open.get("brokerage:XTB") ?? 0) > 0);
  assert.ok((open.get("brokerage:ETFBW20TR") ?? 0) > 0);
  assert.ok((open.get("ike:ETFBW20TR") ?? 0) > 0);
  assert.ok((open.get("brokerageUsd:AAPL") ?? 0) > 0);
  assert.ok((open.get("brokerageUsd:VOO") ?? 0) > 0);

  // No SELL before sufficient BUY for same account+symbol
  const running = new Map<string, number>();
  for (const trade of a) {
    const key = `${trade.accountKey}:${trade.providerSymbol}`;
    const prev = running.get(key) ?? 0;
    if (trade.side === "BUY") {
      running.set(key, prev + trade.quantity);
    } else {
      assert.ok(
        prev >= trade.quantity,
        `SELL ${trade.quantity} ${key} with open ${prev}`,
      );
      running.set(key, prev - trade.quantity);
    }
  }

  assert.ok(a.every((t) => t.providerSymbol !== "SPX"));
  assert.ok(a.some((t) => t.accountKey === "brokerageUsd"));
  assert.ok(a.some((t) => t.side === "SELL"));
});

let prisma: PrismaClient;

before(async () => {
  prisma = await createTestPrisma();
});

after(async () => {
  await disconnectTestPrisma(prisma);
});

test("seedDemoAssetTrades applies buys/sells from valuations with FIFO cash legs", async () => {
  await resetDatabase(prisma);
  const user = await prisma.user.create({
    data: {
      email: "demotrades@test.local",
      username: "demotrades",
      usernameKey: canonicalUsernameKey("demotrades"),
      passwordHash: await hashPassword("password123"),
    },
  });

  const instruments = [
    {
      symbol: "AAPL",
      name: "Apple",
      exchange: "NASDAQ",
      currency: "USD",
      assetClass: "STOCK",
      providerSymbol: "AAPL",
    },
    {
      symbol: "VOO",
      name: "Vanguard S&P 500",
      exchange: "NYSE",
      currency: "USD",
      assetClass: "ETF",
      providerSymbol: "VOO",
    },
    {
      symbol: "XTB",
      name: "XTB",
      exchange: "WSE",
      currency: "PLN",
      assetClass: "STOCK",
      providerSymbol: "XTB",
    },
    {
      symbol: "ETFBW20TR",
      name: "Beta WIG20TR",
      exchange: "WSE",
      currency: "PLN",
      assetClass: "ETF",
      providerSymbol: "ETFBW20TR",
    },
  ] as const;

  for (const row of instruments) {
    await prisma.instrument.create({
      data: {
        symbol: row.symbol,
        name: row.name,
        exchange: row.exchange,
        currency: row.currency,
        assetClass: row.assetClass,
        provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
        providerSymbol: row.providerSymbol,
        allowlisted: true,
      },
    });
  }

  const plan = buildDemoAssetTradePlan(FIXED_NOW);
  const closesBySymbol = new Map<string, Array<{ asOf: string; close: number }>>();
  for (const trade of plan) {
    const list = closesBySymbol.get(trade.providerSymbol) ?? [];
    if (!list.some((c) => c.asOf === trade.asOfYmd)) {
      // Distinct closes so FIFO cost ≠ sell price
      const base =
        trade.providerSymbol === "AAPL"
          ? 250
          : trade.providerSymbol === "VOO"
            ? 600
            : trade.providerSymbol === "XTB"
              ? 70
              : 60;
      list.push({
        asOf: trade.asOfYmd,
        close: base + list.length * 5,
      });
      closesBySymbol.set(trade.providerSymbol, list);
    }
  }

  const tmp = path.join(os.tmpdir(), `demo-trades-eod-${process.pid}.ndjson`);
  const lines: string[] = [];
  for (const [providerSymbol, closes] of closesBySymbol) {
    for (const c of closes) {
      lines.push(
        serializeHistoryNdjsonRow({
          provider: "twelve_data",
          providerSymbol,
          asOf: c.asOf,
          close: c.close,
          source: "yahoo",
        }),
      );
    }
  }
  fs.writeFileSync(tmp, lines.join("\n") + "\n");

  try {
    await seedDemoPortfolio(prisma, user.id, FIXED_NOW);
    const markets = await seedDemoMarkets(prisma, user.id, {
      historyFile: tmp,
    });
    assert.ok(markets.valuationsUpserted >= plan.length / 2);

    const brokerageBefore = await prisma.account.findFirstOrThrow({
      where: { userId: user.id, name: DEMO_ACCOUNT_NAMES.brokerage },
    });
    const usdBefore = await prisma.account.findFirstOrThrow({
      where: { userId: user.id, name: DEMO_ACCOUNT_NAMES.brokerageUsd },
    });
    const cashBrokerageBefore = brokerageBefore.cashBalance;
    const cashUsdBefore = usdBefore.cashBalance;

    const result = await seedDemoAssetTrades(prisma, user.id, FIXED_NOW);
    assert.equal(result.skipped.length, 0, JSON.stringify(result.skipped));
    assert.equal(result.applied, plan.length);
    assert.ok(result.openHoldingsSummary.length >= 4);

    const holdings = await prisma.holding.findMany({
      where: { account: { userId: user.id }, quantity: { gt: 0 } },
      include: { instrument: true, account: true },
    });
    assert.ok(holdings.some((h) => h.instrument.symbol === "XTB"));
    assert.ok(holdings.some((h) => h.instrument.symbol === "ETFBW20TR"));
    assert.ok(holdings.some((h) => h.instrument.symbol === "AAPL"));
    assert.ok(holdings.some((h) => h.instrument.symbol === "VOO"));

    const brokerageAfter = await prisma.account.findFirstOrThrow({
      where: { userId: user.id, name: DEMO_ACCOUNT_NAMES.brokerage },
    });
    const usdAfter = await prisma.account.findFirstOrThrow({
      where: { userId: user.id, name: DEMO_ACCOUNT_NAMES.brokerageUsd },
    });
    // Net BUY notional > SELL proceeds for the script
    assert.ok(brokerageAfter.cashBalance < cashBrokerageBefore);
    assert.ok(usdAfter.cashBalance < cashUsdBefore);

    const assetLegs = await prisma.cashTransaction.findMany({
      where: {
        account: { userId: user.id },
        type: { in: ["ASSET_BUY", "ASSET_SELL"] },
      },
    });
    assert.ok(assetLegs.some((l) => l.type === "ASSET_BUY"));
    assert.ok(assetLegs.some((l) => l.type === "ASSET_SELL"));
    assert.equal(assetLegs.length, plan.length);

    const xtbHolding = holdings.find(
      (h) =>
        h.instrument.symbol === "XTB" &&
        h.account.name === DEMO_ACCOUNT_NAMES.brokerage,
    )!;
    const lots = await prisma.lot.findMany({
      where: { holdingId: xtbHolding.id },
      include: { closes: true },
    });
    assert.ok(lots.some((l) => l.closes.length > 0), "expected FIFO lot closes");

    // Re-seed portfolio wipe must clear trades (Restrict on Account)
    await seedDemoPortfolio(prisma, user.id, FIXED_NOW);
    const tradesAfterWipe = await prisma.assetTrade.count({
      where: { account: { userId: user.id } },
    });
    assert.equal(tradesAfterWipe, 0);
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("seedDemoAssetTrades skips when instruments have no valuations", async () => {
  await resetDatabase(prisma);
  const user = await prisma.user.create({
    data: {
      email: "demotradesskip@test.local",
      username: "demotradesskip",
      usernameKey: canonicalUsernameKey("demotradesskip"),
      passwordHash: await hashPassword("password123"),
    },
  });
  for (const row of [
    { symbol: "AAPL", currency: "USD", assetClass: "STOCK" },
    { symbol: "VOO", currency: "USD", assetClass: "ETF" },
    { symbol: "XTB", currency: "PLN", assetClass: "STOCK" },
    { symbol: "ETFBW20TR", currency: "PLN", assetClass: "ETF" },
  ] as const) {
    await prisma.instrument.create({
      data: {
        symbol: row.symbol,
        name: row.symbol,
        exchange: "TEST",
        currency: row.currency,
        assetClass: row.assetClass,
        provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
        providerSymbol: row.symbol,
        allowlisted: true,
      },
    });
  }
  await seedDemoPortfolio(prisma, user.id, FIXED_NOW);

  const result = await seedDemoAssetTrades(prisma, user.id, FIXED_NOW);
  assert.equal(result.applied, 0);
  assert.equal(result.skipped.length, buildDemoAssetTradePlan(FIXED_NOW).length);
  assert.ok(
    result.skipped.every((s) => s.reason.startsWith("no valuation")),
  );
});
