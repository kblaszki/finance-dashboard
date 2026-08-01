import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword } from "../auth";
import { aggregateCategoryBreakdown, parseMonthParam } from "./categoryBreakdown";
import {
  DEMO_ACCOUNT_NAMES,
  DEMO_BROKERAGE_CASH_BALANCE,
  DEMO_CHECKING_CASH_BALANCE,
  DEMO_CRYPTO_CASH_BALANCE,
  DEMO_EURO_CASH_BALANCE,
  priorUtcMonthKey,
  recomputeCashBalance,
  seedDemoPortfolio,
  utcMonthKey,
} from "./seedDemoPortfolio";
import {
  createTestPrisma,
  disconnectTestPrisma,
  resetDatabase,
} from "../../test/prismaTestClient";

test("recomputeCashBalance matches Everyday Checking demo totals", () => {
  const balance = recomputeCashBalance(2500, [
    { type: "INCOME", amount: 5200 },
    { type: "EXPENSE", amount: 420 },
    { type: "EXPENSE", amount: 1800 },
    { type: "EXPENSE", amount: 260 },
    { type: "EXPENSE", amount: 85 },
    { type: "INCOME", amount: 5200 },
    { type: "EXPENSE", amount: 380 },
    { type: "EXPENSE", amount: 1800 },
  ]);
  assert.equal(Number(balance), DEMO_CHECKING_CASH_BALANCE);
});

test("recomputeCashBalance matches other demo account finals", () => {
  assert.equal(
    Number(recomputeCashBalance(400, [
      { type: "EXPENSE", amount: 45 },
      { type: "EXPENSE", amount: 30 },
    ])),
    DEMO_EURO_CASH_BALANCE,
  );
  assert.equal(
    Number(recomputeCashBalance(10000, [
      { type: "INCOME", amount: 350 },
      { type: "EXPENSE", amount: 40 },
    ])),
    DEMO_BROKERAGE_CASH_BALANCE,
  );
  assert.equal(
    Number(recomputeCashBalance(1500, [
      { type: "INCOME", amount: 200 },
      { type: "EXPENSE", amount: 35 },
    ])),
    DEMO_CRYPTO_CASH_BALANCE,
  );
});

test("seedDemoPortfolio is idempotent and scopes wipe to one user", async () => {
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

    await seedDemoPortfolio(prisma, demo.id);
    await seedDemoPortfolio(prisma, demo.id);

    const accounts = await prisma.account.findMany({
      where: { userId: demo.id },
      orderBy: { name: "asc" },
    });
    assert.equal(accounts.length, 4);
    assert.deepEqual(
      accounts.map((a) => a.name).sort(),
      Object.values(DEMO_ACCOUNT_NAMES).slice().sort(),
    );

    const checking = accounts.find((a) => a.name === DEMO_ACCOUNT_NAMES.checking)!;
    assert.equal(Number(checking.cashBalance), DEMO_CHECKING_CASH_BALANCE);
    assert.equal(checking.accountType, "BANK");
    assert.equal(checking.currency, "PLN");

    const euro = accounts.find((a) => a.name === DEMO_ACCOUNT_NAMES.euro)!;
    assert.equal(Number(euro.cashBalance), DEMO_EURO_CASH_BALANCE);
    assert.equal(euro.currency, "EUR");

    const brokerage = accounts.find((a) => a.name === DEMO_ACCOUNT_NAMES.brokerage)!;
    assert.equal(Number(brokerage.cashBalance), DEMO_BROKERAGE_CASH_BALANCE);
    assert.equal(brokerage.accountType, "BROKERAGE");

    const crypto = accounts.find((a) => a.name === DEMO_ACCOUNT_NAMES.crypto)!;
    assert.equal(Number(crypto.cashBalance), DEMO_CRYPTO_CASH_BALANCE);
    assert.equal(crypto.accountType, "CRYPTO");
    assert.equal(crypto.currency, "USD");

    const categoryCount = await prisma.category.count({ where: { userId: demo.id } });
    assert.equal(categoryCount, 8);

    const otherAccounts = await prisma.account.findMany({ where: { userId: other.id } });
    assert.equal(otherAccounts.length, 1);
    assert.equal(otherAccounts[0].name, "Keep Me");
    assert.equal(Number(otherAccounts[0].cashBalance), 99);

    const current = utcMonthKey();
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
    const breakdown = aggregateCategoryBreakdown(current, rows);
    const foodPln = breakdown.expense.find(
      (r) => r.categoryName === "Food" && r.currency === "PLN",
    );
    const foodEur = breakdown.expense.find(
      (r) => r.categoryName === "Food" && r.currency === "EUR",
    );
    const uncat = breakdown.expense.find(
      (r) => r.categoryId === null && r.categoryName === "Uncategorized",
    );
    assert.ok(foodPln);
    assert.equal(foodPln.total, 420);
    assert.ok(foodEur);
    assert.equal(foodEur.total, 45);
    assert.ok(uncat);
    assert.equal(uncat.total, 85);

    const prior = priorUtcMonthKey(current);
    const priorBounds = parseMonthParam(prior);
    const priorCount = await prisma.cashTransaction.count({
      where: {
        occurredAt: { gte: priorBounds.start, lt: priorBounds.end },
        account: { userId: demo.id },
      },
    });
    assert.equal(priorCount, 3);
  } finally {
    await disconnectTestPrisma(prisma);
  }
});
