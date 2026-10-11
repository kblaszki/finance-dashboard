import test from "node:test";
import assert from "node:assert/strict";
import { canonicalUsernameKey, hashPassword } from "../auth";
import { aggregateCategoryBreakdown, parseMonthParam } from "./categoryBreakdown";
import { parseLedgerTxType, signedMinor } from "./cashLedger";
import {
  buildDemoLedgerTxs,
  buildDemoTransfers,
  DEMO_ACCOUNT_NAMES,
  DEMO_LEDGER_MONTHS,
  DEMO_OPENINGS,
  DEMO_TXS_PER_ACCOUNT_MONTH,
  listMonthsEndingAt,
  recomputeCashBalance,
  recomputeCashMinor,
  seedDemoPortfolio,
  utcMonthKey,
  type DemoAccountKey,
  type LedgerDeltaInput,
} from "./seedDemoPortfolio";
import { minorToDecimal, quantizeMajorToMinor } from "./money";
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

test("buildDemoTransfers is deterministic with same- and cross-currency rows", () => {
  const a = buildDemoTransfers(FIXED_NOW);
  const b = buildDemoTransfers(FIXED_NOW);
  assert.deepEqual(a, b);
  assert.ok(a.length >= 3);
  assert.ok(a.some((t) => t.amountTo == null));
  assert.ok(a.some((t) => t.amountTo != null && t.amountTo !== t.amountFrom));
  assert.ok(a.every((t) => t.fromKey !== t.toKey && t.amountFrom > 0));
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
        usernameKey: canonicalUsernameKey("seeddemo"),
        passwordHash,
      },
    });
    const other = await prisma.user.create({
      data: {
        email: "seed-other@test.local",
        username: "seedother",
        usernameKey: canonicalUsernameKey("seedother"),
        passwordHash,
      },
    });
    await prisma.account.create({
      data: {
        userId: other.id,
        name: "Keep Me",
        accountType: "BANK",
        currency: "PLN",
        openingBalance: quantizeMajorToMinor(99, "openingBalance"),
        cashBalance: quantizeMajorToMinor(99, "openingBalance"),
      },
    });

    await seedDemoPortfolio(prisma, demo.id, FIXED_NOW);
    await seedDemoPortfolio(prisma, demo.id, FIXED_NOW);

    const accounts = await prisma.account.findMany({
      where: { userId: demo.id },
      orderBy: { name: "asc" },
    });
    assert.equal(accounts.length, 6);
    for (const name of Object.values(DEMO_ACCOUNT_NAMES)) {
      assert.ok(accounts.some((a) => a.name === name));
    }
    assert.ok(accounts.some((a) => a.accountType === "CREDIT_CARD"));
    assert.ok(accounts.some((a) => a.accountType === "IKE"));
    const card = accounts.find((a) => a.accountType === "CREDIT_CARD")!;
    assert.equal(card.cashBalance, quantizeMajorToMinor(-800, "openingBalance"));

    const planned = buildDemoLedgerTxs(FIXED_NOW);
    const plannedTransfers = buildDemoTransfers(FIXED_NOW);
    const nameToKey = new Map(
      (Object.keys(DEMO_ACCOUNT_NAMES) as DemoAccountKey[]).map((key) => [
        DEMO_ACCOUNT_NAMES[key],
        key,
      ]),
    );

    const transferCount = await prisma.cashTransfer.count({
      where: { userId: demo.id },
    });
    assert.equal(transferCount, plannedTransfers.length);

    for (const account of accounts) {
      const key = nameToKey.get(account.name);
      if (!key) continue;
      const deltas: LedgerDeltaInput[] = planned
        .filter((t) => t.accountKey === key)
        .map((t) => ({ type: t.type, amount: t.amount }));
      for (const transfer of plannedTransfers) {
        if (transfer.fromKey === key) {
          deltas.push({ type: "TRANSFER_OUT", amount: transfer.amountFrom });
        }
        if (transfer.toKey === key) {
          deltas.push({
            type: "TRANSFER_IN",
            amount: transfer.amountTo ?? transfer.amountFrom,
          });
        }
      }
      const expected = recomputeCashMinor(DEMO_OPENINGS[key], deltas);
      assert.equal(account.cashBalance, expected);
      assert.equal(
        account.openingBalance,
        quantizeMajorToMinor(DEMO_OPENINGS[key], "openingBalance"),
      );

      const legs = await prisma.cashTransaction.findMany({
        where: { accountId: account.id },
        select: { type: true, amount: true },
      });
      let fromLedger = account.openingBalance;
      for (const leg of legs) {
        fromLedger += signedMinor(parseLedgerTxType(leg.type), leg.amount);
      }
      assert.equal(account.cashBalance, fromLedger);
    }

    const txCount = await prisma.cashTransaction.count({
      where: { account: { userId: demo.id } },
    });
    assert.ok(
      txCount >=
        4 * DEMO_LEDGER_MONTHS * DEMO_TXS_PER_ACCOUNT_MONTH,
    );
    assert.equal(txCount, planned.length + plannedTransfers.length * 2);

    const transferLegs = await prisma.cashTransaction.count({
      where: {
        account: { userId: demo.id },
        transferId: { not: null },
      },
    });
    assert.equal(transferLegs, plannedTransfers.length * 2);

    const categoryCount = await prisma.category.count({
      where: { userId: demo.id },
    });
    assert.equal(categoryCount, 6);

    const otherAccounts = await prisma.account.findMany({
      where: { userId: other.id },
    });
    assert.equal(otherAccounts.length, 1);
    assert.equal(otherAccounts[0].name, "Keep Me");
    assert.equal(otherAccounts[0].cashBalance, quantizeMajorToMinor(99, "openingBalance"));

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
    const breakdown = aggregateCategoryBreakdown(
      current,
      rows.map((row) => ({ ...row, amount: minorToDecimal(row.amount) })),
    );
    assert.ok(breakdown.income.length + breakdown.expense.length > 0);
    assert.ok(
      breakdown.expense.some((r) => r.currency === "PLN") ||
        breakdown.income.some((r) => r.currency === "PLN"),
    );
  } finally {
    await disconnectTestPrisma(prisma);
  }
});
