import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { ensureDefaultCategories } from "./categories";
import {
  replaceTransactionSplits,
  resolveTransactionCategory,
  validateTransactionSplits,
} from "./transactionSplits";

const prisma = new PrismaClient();

test("validateTransactionSplits enforces sum and unique categories", async () => {
  const user = await prisma.user.create({
    data: {
      email: `split-${Date.now()}@test.local`,
      username: `splituser${Date.now()}`,
      passwordHash: "x",
    },
  });
  await ensureDefaultCategories(prisma, user.id);
  const cats = await prisma.category.findMany({ where: { userId: user.id } });
  const food = cats.find((c) => c.name === "Food");
  const transport = cats.find((c) => c.name === "Transport");
  assert.ok(food && transport);

  const valid = await validateTransactionSplits(prisma, user.id, 100, [
    { categoryId: food.id, amount: 60 },
    { categoryId: transport.id, amount: 40 },
  ]);
  assert.equal(valid?.length, 2);

  await assert.rejects(() =>
    validateTransactionSplits(prisma, user.id, 100, [
      { categoryId: food.id, amount: 50 },
      { categoryId: transport.id, amount: 40 },
    ]),
  );
  await assert.rejects(() =>
    validateTransactionSplits(prisma, user.id, 100, [
      { categoryId: food.id, amount: 50 },
      { categoryId: food.id, amount: 50 },
    ]),
  );
  await assert.rejects(() =>
    validateTransactionSplits(prisma, user.id, 100, [
      { categoryId: 999999, amount: 100 },
    ]),
  );
});

test("resolveTransactionCategory maps categoryId and splits", async () => {
  const user = await prisma.user.create({
    data: {
      email: `split2-${Date.now()}@test.local`,
      username: `splituser2${Date.now()}`,
      passwordHash: "x",
    },
  });
  await ensureDefaultCategories(prisma, user.id);
  const food = await prisma.category.findFirst({
    where: { userId: user.id, name: "Food" },
  });
  assert.ok(food);

  const byId = await resolveTransactionCategory(prisma, user.id, {
    categoryId: food.id,
  });
  assert.equal(byId.categoryId, food.id);
  assert.equal(byId.category, "Food");

  const split = await resolveTransactionCategory(prisma, user.id, {
    splits: [{ categoryId: food.id, amount: 10 }],
  });
  assert.equal(split.category, "SPLIT");
  assert.equal(split.categoryId, null);

  const fallback = await resolveTransactionCategory(prisma, user.id, {
    category: "",
  });
  assert.equal(fallback.category, "Uncategorized");
});

test("replaceTransactionSplits replaces rows", async () => {
  const user = await prisma.user.create({
    data: {
      email: `split3-${Date.now()}@test.local`,
      username: `splituser3${Date.now()}`,
      passwordHash: "x",
    },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Split test",
      currency: "PLN",
      cashBalance: 1000,
    },
  });
  const tx = await prisma.transaction.create({
    data: {
      accountId: account.id,
      transactionType: "EXPENSE",
      amount: 50,
      balanceAfter: 950,
      currency: "PLN",
      category: "SPLIT",
      date: new Date("2026-06-01T12:00:00.000Z"),
    },
  });
  await ensureDefaultCategories(prisma, user.id);
  const food = await prisma.category.findFirst({
    where: { userId: user.id, name: "Food" },
  });
  assert.ok(food);

  await replaceTransactionSplits(prisma, tx.id, [{ categoryId: food.id, amount: 50 }]);
  const rows = await prisma.transactionSplit.findMany({ where: { transactionId: tx.id } });
  assert.equal(rows.length, 1);

  await replaceTransactionSplits(prisma, tx.id, null);
  const cleared = await prisma.transactionSplit.findMany({ where: { transactionId: tx.id } });
  assert.equal(cleared.length, 0);
});
