import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../lib/errors";
import { canonicalUsernameKey } from "../auth";
import {
  applyAssetTrade,
  parseAssetTradeInput,
  reverseAssetTrade,
} from "./assetTrades";
import { signedMinor } from "./cashLedger";
import {
  createTestPrisma,
  disconnectTestPrisma,
  resetDatabase,
} from "../../test/prismaTestClient";

test("signedMinor credits ASSET_SELL and debits ASSET_BUY", () => {
  assert.equal(signedMinor("ASSET_BUY", 1000), -1000);
  assert.equal(signedMinor("ASSET_SELL", 1000), 1000);
});

test("parseAssetTradeInput validates side qty price", () => {
  const input = parseAssetTradeInput({
    instrumentId: 1,
    side: "buy",
    quantity: 10,
    unitPrice: 100.5,
    commission: 1.25,
  });
  assert.equal(input.side, "BUY");
  assert.equal(input.quantity.toNumber(), 10);
  assert.equal(input.unitPrice.toNumber(), 100.5);
  assert.equal(input.commission.toNumber(), 1.25);

  assert.throws(
    () => parseAssetTradeInput({ instrumentId: 1, side: "HOLD", quantity: 1, unitPrice: 1 }),
    (e: unknown) => e instanceof HttpError && e.status === 400,
  );
});

let prisma: PrismaClient;

test.before(async () => {
  prisma = await createTestPrisma();
});

test.after(async () => {
  await disconnectTestPrisma(prisma);
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
});

async function seedBrokerage() {
  const user = await prisma.user.create({
    data: {
      email: "trades@test.local",
      username: "trader",
      usernameKey: canonicalUsernameKey("trader"),
      passwordHash: "x",
    },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "USD",
      cashBalance: 200_000, // $2000
      openingBalance: 200_000,
    },
  });
  const instrument = await prisma.instrument.create({
    data: {
      symbol: "AAPL",
      name: "Apple",
      currency: "USD",
      assetClass: "STOCK",
      provider: "twelve_data",
      providerSymbol: "AAPL",
      allowlisted: true,
    },
  });
  return { user, account, instrument };
}

test("applyAssetTrade BUY then partial SELL uses FIFO lots and cash legs", async () => {
  const { account, instrument } = await seedBrokerage();

  await prisma.$transaction(async (tx) => {
    await applyAssetTrade(
      tx,
      {
        id: account.id,
        currency: account.currency,
        accountType: account.accountType,
        cashBalance: account.cashBalance,
      },
      { id: instrument.id, currency: instrument.currency, symbol: instrument.symbol },
      {
        instrumentId: instrument.id,
        side: "BUY",
        quantity: new Prisma.Decimal(10),
        unitPrice: new Prisma.Decimal(100),
        commission: new Prisma.Decimal(5),
        occurredAt: new Date("2024-01-10T12:00:00.000Z"),
        settlementDate: null,
        notes: null,
      },
    );
  });

  const afterBuy = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
  // 10*100+5 = 1005 → 100500 cents; 200000-100500=99500
  assert.equal(afterBuy.cashBalance, 99_500);

  const holding = await prisma.holding.findFirstOrThrow({
    where: { accountId: account.id, instrumentId: instrument.id },
  });
  assert.equal(Number(holding.quantity), 10);

  await prisma.$transaction(async (tx) => {
    await applyAssetTrade(
      tx,
      {
        id: afterBuy.id,
        currency: afterBuy.currency,
        accountType: afterBuy.accountType,
        cashBalance: afterBuy.cashBalance,
      },
      { id: instrument.id, currency: instrument.currency, symbol: instrument.symbol },
      {
        instrumentId: instrument.id,
        side: "SELL",
        quantity: new Prisma.Decimal(4),
        unitPrice: new Prisma.Decimal(120),
        commission: new Prisma.Decimal(2),
        occurredAt: new Date("2024-02-01T12:00:00.000Z"),
        settlementDate: null,
        notes: null,
      },
    );
  });

  const afterSell = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
  // proceeds 480-2=478 → +47800; 99500+47800=147300
  assert.equal(afterSell.cashBalance, 147_300);

  const holdingAfter = await prisma.holding.findFirstOrThrow({
    where: { accountId: account.id },
  });
  assert.equal(Number(holdingAfter.quantity), 6);

  const lot = await prisma.lot.findFirstOrThrow({ where: { holdingId: holding.id } });
  assert.equal(Number(lot.quantityOpen), 6);
  assert.equal(Number(lot.quantityClosed), 4);

  const legs = await prisma.cashTransaction.findMany({
    where: { accountId: account.id },
    orderBy: { id: "asc" },
  });
  assert.deepEqual(
    legs.map((l) => l.type),
    ["ASSET_BUY", "ASSET_SELL"],
  );
});

test("applyAssetTrade rejects insufficient cash and open qty", async () => {
  const { account, instrument } = await seedBrokerage();

  await assert.rejects(
    () =>
      prisma.$transaction((tx) =>
        applyAssetTrade(
          tx,
          {
            id: account.id,
            currency: "USD",
            accountType: "BROKERAGE",
            cashBalance: account.cashBalance,
          },
          { id: instrument.id, currency: "USD", symbol: "AAPL" },
          {
            instrumentId: instrument.id,
            side: "BUY",
            quantity: new Prisma.Decimal(100),
            unitPrice: new Prisma.Decimal(100),
            commission: new Prisma.Decimal(0),
            occurredAt: new Date(),
            settlementDate: null,
            notes: null,
          },
        ),
      ),
    (e: unknown) => e instanceof HttpError && /insufficient cash/i.test(e.message),
  );

  await prisma.$transaction(async (tx) => {
    await applyAssetTrade(
      tx,
      {
        id: account.id,
        currency: "USD",
        accountType: "BROKERAGE",
        cashBalance: account.cashBalance,
      },
      { id: instrument.id, currency: "USD", symbol: "AAPL" },
      {
        instrumentId: instrument.id,
        side: "BUY",
        quantity: new Prisma.Decimal(2),
        unitPrice: new Prisma.Decimal(50),
        commission: new Prisma.Decimal(0),
        occurredAt: new Date(),
        settlementDate: null,
        notes: null,
      },
    );
  });

  const refreshed = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
  await assert.rejects(
    () =>
      prisma.$transaction((tx) =>
        applyAssetTrade(
          tx,
          {
            id: refreshed.id,
            currency: "USD",
            accountType: "BROKERAGE",
            cashBalance: refreshed.cashBalance,
          },
          { id: instrument.id, currency: "USD", symbol: "AAPL" },
          {
            instrumentId: instrument.id,
            side: "SELL",
            quantity: new Prisma.Decimal(5),
            unitPrice: new Prisma.Decimal(50),
            commission: new Prisma.Decimal(0),
            occurredAt: new Date(),
            settlementDate: null,
            notes: null,
          },
        ),
      ),
    (e: unknown) =>
      e instanceof HttpError && /insufficient open quantity/i.test(e.message),
  );
});

test("reverseAssetTrade restores cash and lots", async () => {
  const { account, instrument } = await seedBrokerage();

  const trade = await prisma.$transaction(async (tx) =>
    applyAssetTrade(
      tx,
      {
        id: account.id,
        currency: "USD",
        accountType: "BROKERAGE",
        cashBalance: account.cashBalance,
      },
      { id: instrument.id, currency: "USD", symbol: "AAPL" },
      {
        instrumentId: instrument.id,
        side: "BUY",
        quantity: new Prisma.Decimal(3),
        unitPrice: new Prisma.Decimal(100),
        commission: new Prisma.Decimal(0),
        occurredAt: new Date(),
        settlementDate: null,
        notes: null,
      },
    ),
  );

  await prisma.$transaction((tx) => reverseAssetTrade(tx, account.id, trade.id));

  const restored = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
  assert.equal(restored.cashBalance, 200_000);
  assert.equal(await prisma.assetTrade.count(), 0);
  assert.equal(await prisma.lot.count(), 0);
  const holding = await prisma.holding.findFirst({ where: { accountId: account.id } });
  assert.equal(Number(holding?.quantity ?? 0), 0);
});
