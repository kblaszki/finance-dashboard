import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword } from "../auth";
import { aggregateCategoryBreakdown, parseMonthParam } from "./categoryBreakdown";
import {
  buildDemoLedgerTxs,
  DEMO_ACCOUNT_NAMES,
  DEMO_LEDGER_MONTHS,
  DEMO_OPENINGS,
  DEMO_TXS_PER_ACCOUNT_MONTH,
  listMonthsEndingAt,
  recomputeCashBalance,
  seedDemoPortfolio,
  utcMonthKey,
  type DemoAccountKey,
} from "./seedDemoPortfolio";
import {
  createTestPrisma,
  disconnectTestPrisma,
  resetDatabase,
} from "../../test/prismaTestClient";

const FIXED_NOW = new Date("2026-08-15T12:00:00.000Z");

test("recomputeCashBalance applies signed income and expense deltas", () => {
  const balance = recomputeCashBalance(1000, [
    { type: "INCOME", amount: 200 },
    { type: "EXPENSE", amount: 50 },
  ]);
  assert.equal(Number(balance), 1150);
});

test("buildDemoLedgerTxs is deterministic with ≥5 txs per account per month", () => {
  const a = buildDemoLedgerTxs(FIXED_NOW);
  const b = buildDemoLedgerTxs(FIXED_NOW);
  assert.equal(a.length, b.length);
  assert.deepEqual(
    a.map((t) => ({
      accountKey: t.accountKey,
      type: t.type,
      amount: t.amount,
      at: t.occurredAt.toISOString(),
      description: t.description,
      category: t.category ?? null,
    })),
    b.map((t) => ({
      accountKey: t.accountKey,
      type: t.type,
      amount: t.amount,
      at: t.occurredAt.toISOString(),
      description: t.description,
      category: t.category ?? null,
    })),
  );

  const accountKeys = Object.keys(DEMO_ACCOUNT_NAMES) as DemoAccountKey[];
  const months = listMonthsEndingAt(utcMonthKey(FIXED_NOW), DEMO_LEDGER_MONTHS);
  assert.equal(months.length, DEMO_LEDGER_MONTHS);
  assert.equal(
    a.length,
    accountKeys.length * DEMO_LEDGER_MONTHS * DEMO_TXS_PER_ACCOUNT_MONTH,
  );

  for (const key of accountKeys) {
    for (const month of months) {
      const monthTxs = a.filter(
        (t) =>
          t.accountKey === key &&
          t.occurredAt.toISOString().slice(0, 7) === month,
      );
      assert.ok(
        monthTxs.length >= DEMO_TXS_PER_ACCOUNT_MONTH,
        `${key} ${month} expected ≥${DEMO_TXS_PER_ACCOUNT_MONTH} txs`,
      );
      for (const tx of monthTxs) {
        assert.ok(tx.amount > 0);
        assert.ok(Number.isFinite(tx.amount));
      }
    }

    const deltas = a
      .filter((t) => t.accountKey === key)
      .map((t) => ({ type: t.type, amount: t.amount }));
    const balance = Number(
      recomputeCashBalance(DEMO_OPENINGS[key], deltas),
    );
    assert.ok(
      balance >= 0,
      `${key} ending balance should be ≥ 0, got ${balance}`,
    );
  }

  assert.ok(a.some((t) => t.category === undefined));
});

test("seedDemoPortfolio matches ledger balances and scopes wipe to one user", async () => {
  const prisma = await createTestPrisma();
  try {
    await resetDatabase(prisma);
    const passwordHash = await hashPassword("testpass123");
    const demo = await prisma.user.create({
      data: {
        email: "seed-demo@test.local",
        username: "seeddemo",
        passwordHash,
      },
    });
    const other = await prisma.user.create({
      data: {
        email: "seed-other@test.local",
        username: "seedother",
        passwordHash,
      },
    });
    await prisma.account.create({
      data: {
        userId: other.id,
        name: "Keep Me",
        accountType: "BANK",
        currency: "PLN",
        openingBalance: 99,
        cashBalance: 99,
      },
    });

    await seedDemoPortfolio(prisma, demo.id, FIXED_NOW);
    await seedDemoPortfolio(prisma, demo.id, FIXED_NOW);

    const accounts = await prisma.account.findMany({
      where: { userId: demo.id },
      orderBy: { name: "asc" },
    });
    assert.equal(accounts.length, 4);
    assert.deepEqual(
      accounts.map((a) => a.name).sort(),
      Object.values(DEMO_ACCOUNT_NAMES).slice().sort(),
    );

    const planned = buildDemoLedgerTxs(FIXED_NOW);
    const nameToKey = new Map(
      (Object.keys(DEMO_ACCOUNT_NAMES) as DemoAccountKey[]).map((key) => [
        DEMO_ACCOUNT_NAMES[key],
        key,
      ]),
    );

    for (const account of accounts) {
      const key = nameToKey.get(account.name)!;
      const deltas = planned
        .filter((t) => t.accountKey === key)
        .map((t) => ({ type: t.type, amount: t.amount }));
      const expected = Number(
        recomputeCashBalance(DEMO_OPENINGS[key], deltas),
      );
      assert.equal(Number(account.cashBalance), expected);
      assert.equal(Number(account.openingBalance), DEMO_OPENINGS[key]);
    }

    const txCount = await prisma.cashTransaction.count({
      where: { account: { userId: demo.id } },
    });
    assert.ok(
      txCount >=
        4 * DEMO_LEDGER_MONTHS * DEMO_TXS_PER_ACCOUNT_MONTH,
    );
    assert.equal(txCount, planned.length);

    const categoryCount = await prisma.category.count({
      where: { userId: demo.id },
    });
    assert.equal(categoryCount, 8);

    const otherAccounts = await prisma.account.findMany({
      where: { userId: other.id },
    });
    assert.equal(otherAccounts.length, 1);
    assert.equal(otherAccounts[0].name, "Keep Me");
    assert.equal(Number(otherAccounts[0].cashBalance), 99);

    const current = utcMonthKey(FIXED_NOW);
    const { start, end } = parseMonthParam(current);
    const rows = await prisma.cashTransaction.findMany({
      where: {
        occurredAt: { gte: start, lt: end },
        account: { userId: demo.id },
      },
      include: {
        account: { select: { currency: true } },
        category: { select: { id: true, name: true } },
      },
    });
    assert.ok(rows.length >= 4 * DEMO_TXS_PER_ACCOUNT_MONTH);
    const breakdown = aggregateCategoryBreakdown(current, rows);
    assert.ok(breakdown.income.length + breakdown.expense.length > 0);
    assert.ok(
      breakdown.expense.some((r) => r.currency === "PLN") ||
        breakdown.income.some((r) => r.currency === "PLN"),
    );
  } finally {
    await disconnectTestPrisma(prisma);
  }
});
