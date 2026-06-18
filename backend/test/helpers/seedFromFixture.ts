import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { backfillAccountValuations } from "../../src/accountValuation";
import { computeQuantityAfter, resolveLotPrice } from "../../src/holdingLot";
import { findOrCreateHolding, syncHoldingQuantity } from "../../src/holdings";
import { computeBalanceAfter, type TransactionType } from "../../src/transactionBalance";

export const MOCK_FX: Record<string, number> = { PLN: 1, USD: 4, EUR: 4.3 };

type FixtureAccount = {
  key: string;
  accountType: string;
  name: string;
  currency: string;
  openingBalance: number;
  description?: string;
  createdAt?: string;
};

type FixtureInstrument = {
  key: string;
  instrumentType: string;
  symbol: string;
  name?: string;
  exchange?: string;
  currency: string;
  source?: string;
};

type FixtureTransaction = {
  accountKey: string;
  transactionType: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
};

type FixtureHoldingLot = {
  accountKey: string;
  instrumentKey: string;
  side: "BUY" | "SELL";
  quantity: number;
  pricePerUnit?: number;
  totalPrice?: number;
  tradeDate: string;
};

type FixtureInstrumentValuation = {
  instrumentKey: string;
  valuationDate: string;
  price: number;
  currency: string;
  source?: string;
};

export type GoldenFixture = {
  user: { email: string; username: string; password: string };
  accounts: FixtureAccount[];
  instruments: FixtureInstrument[];
  instrumentValuations: FixtureInstrumentValuation[];
  transactions: FixtureTransaction[];
  holdingLots: FixtureHoldingLot[];
  expected?: Record<string, unknown>;
};

export type SeedResult = {
  userId: number;
  accountIds: Record<string, number>;
  instrumentIds: Record<string, number>;
};

export function loadFixture(fileName: string): GoldenFixture {
  const filePath = path.join(__dirname, "..", "fixtures", fileName);
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as GoldenFixture;
  return raw;
}

export async function seedFromFixture(
  prisma: PrismaClient,
  fixture: GoldenFixture,
  plnPerUnit: Record<string, number> = MOCK_FX,
): Promise<SeedResult> {
  const passwordHash = await bcrypt.hash(fixture.user.password, 4);
  const user = await prisma.user.create({
    data: {
      email: fixture.user.email,
      username: fixture.user.username,
      passwordHash,
    },
  });

  const accountIds: Record<string, number> = {};
  for (const a of fixture.accounts) {
    const row = await prisma.account.create({
      data: {
        userId: user.id,
        accountType: a.accountType,
        name: a.name,
        currency: a.currency,
        openingBalance: a.openingBalance,
        cashBalance: a.openingBalance,
        description: a.description ?? null,
        ...(a.createdAt ? { createdAt: new Date(a.createdAt) } : {}),
      },
    });
    accountIds[a.key] = row.id;
  }

  const instrumentIds: Record<string, number> = {};
  for (const i of fixture.instruments) {
    const row = await prisma.instrument.create({
      data: {
        instrumentType: i.instrumentType,
        symbol: i.symbol,
        name: i.name ?? null,
        exchange: i.exchange ?? null,
        currency: i.currency,
        source: i.source ?? "manual",
      },
    });
    instrumentIds[i.key] = row.id;
  }

  for (const v of fixture.instrumentValuations) {
    const instrumentId = instrumentIds[v.instrumentKey];
    if (!instrumentId) throw new Error(`Unknown instrumentKey: ${v.instrumentKey}`);
    await prisma.instrumentValuation.create({
      data: {
        instrumentId,
        valuationDate: new Date(v.valuationDate),
        price: v.price,
        currency: v.currency,
        source: v.source ?? "manual",
      },
    });
  }

  const txsByAccount = new Map<string, FixtureTransaction[]>();
  for (const tx of fixture.transactions) {
    const list = txsByAccount.get(tx.accountKey) ?? [];
    list.push(tx);
    txsByAccount.set(tx.accountKey, list);
  }

  for (const [accountKey, txs] of txsByAccount) {
    const accountId = accountIds[accountKey];
    const account = fixture.accounts.find((a) => a.key === accountKey)!;
    const sorted = [...txs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    let cash = account.openingBalance;
    for (const tx of sorted) {
      cash = computeBalanceAfter(cash, tx.transactionType as TransactionType, tx.amount);
      await prisma.transaction.create({
        data: {
          accountId,
          transactionType: tx.transactionType,
          amount: tx.amount,
          balanceAfter: cash,
          currency: account.currency,
          category: tx.category,
          date: new Date(tx.date),
          description: tx.description ?? null,
        },
      });
    }
    await prisma.account.update({ where: { id: accountId }, data: { cashBalance: cash } });
  }

  const lotsByAccountInstrument = new Map<string, FixtureHoldingLot[]>();
  for (const lot of fixture.holdingLots) {
    const key = `${lot.accountKey}:${lot.instrumentKey}`;
    const list = lotsByAccountInstrument.get(key) ?? [];
    list.push(lot);
    lotsByAccountInstrument.set(key, list);
  }

  const accountCash = new Map<string, number>();
  for (const a of fixture.accounts) {
    const id = accountIds[a.key];
    const acc = await prisma.account.findUnique({ where: { id } });
    accountCash.set(a.key, Number(acc?.cashBalance ?? a.openingBalance));
  }

  for (const [key, lots] of lotsByAccountInstrument) {
    const [accountKey, instrumentKey] = key.split(":");
    const accountId = accountIds[accountKey];
    const instrumentId = instrumentIds[instrumentKey];
    const account = fixture.accounts.find((a) => a.key === accountKey)!;
    const sorted = [...lots].sort(
      (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime(),
    );
    let prevQty = 0;
    let cash = accountCash.get(accountKey) ?? 0;

    const holding = await findOrCreateHolding(prisma, accountId, instrumentId);

    for (const lot of sorted) {
      const prices = resolveLotPrice({
        quantity: lot.quantity,
        totalPrice: lot.totalPrice,
        pricePerUnit: lot.pricePerUnit,
      });
      const quantityAfter = computeQuantityAfter(prevQty, lot.side, lot.quantity);
      prevQty = quantityAfter;

      if (lot.side === "BUY") {
        cash = computeBalanceAfter(cash, "EXPENSE", prices.totalPrice);
      } else {
        cash = computeBalanceAfter(cash, "INCOME", prices.totalPrice);
      }

      await prisma.holdingLot.create({
        data: {
          holdingId: holding.id,
          side: lot.side,
          quantity: lot.quantity,
          quantityAfter,
          totalPrice: prices.totalPrice,
          pricePerUnit: prices.pricePerUnit,
          currency: account.currency,
          tradeDate: new Date(lot.tradeDate),
        },
      });
    }
    await syncHoldingQuantity(prisma, holding.id);
    accountCash.set(accountKey, cash);
    await prisma.account.update({ where: { id: accountId }, data: { cashBalance: cash } });
  }

  for (const accountId of Object.values(accountIds)) {
    await backfillAccountValuations(prisma, accountId, plnPerUnit);
  }

  return { userId: user.id, accountIds, instrumentIds };
}

export async function assertFixtureExpected(
  prisma: PrismaClient,
  fixture: GoldenFixture,
  accountIds: Record<string, number>,
): Promise<void> {
  const expected = fixture.expected as
    | {
        accounts?: Record<string, { cashBalance: number }>;
        quantityAfter?: Record<string, number>;
        quantityAfterChain?: number[];
        snapshots?: Record<string, Record<string, { cashValue?: number; totalValue?: number; securitiesValue?: number }>>;
      }
    | undefined;
  if (!expected) return;

  if (expected.accounts) {
    for (const [key, exp] of Object.entries(expected.accounts)) {
      const account = await prisma.account.findUnique({ where: { id: accountIds[key] } });
      if (!account) throw new Error(`Account ${key} missing`);
      const cash = Number(account.cashBalance);
      if (Math.abs(cash - exp.cashBalance) > 0.02) {
        throw new Error(`Account ${key} cashBalance: expected ${exp.cashBalance}, got ${cash}`);
      }
    }
  }

  if (expected.snapshots) {
    for (const [accountKey, dates] of Object.entries(expected.snapshots)) {
      const accountId = accountIds[accountKey];
      for (const [dateStr, exp] of Object.entries(dates)) {
        const start = new Date(dateStr);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(dateStr);
        end.setUTCHours(23, 59, 59, 999);
        const snap = await prisma.accountValuationDaily.findFirst({
          where: { accountId, valuationDate: { gte: start, lte: end } },
        });
        if (!snap) throw new Error(`No snapshot for ${accountKey} on ${dateStr}`);
        if (exp.cashValue != null && Math.abs(Number(snap.cashValue) - exp.cashValue) > 0.02) {
          throw new Error(`${accountKey} ${dateStr} cashValue mismatch`);
        }
        if (exp.totalValue != null && Math.abs(Number(snap.totalValue) - exp.totalValue) > 0.02) {
          throw new Error(`${accountKey} ${dateStr} totalValue mismatch`);
        }
        if (exp.securitiesValue != null && Math.abs(Number(snap.securitiesValue) - exp.securitiesValue) > 0.02) {
          throw new Error(`${accountKey} ${dateStr} securitiesValue mismatch`);
        }
      }
    }
  }
}
