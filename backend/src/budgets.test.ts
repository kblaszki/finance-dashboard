import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { ensureDefaultCategories } from "./categories";
import {
  deleteUserBudget,
  formatBudgetMonth,
  listUserBudgets,
  parseBudgetMonth,
  serializeBudget,
  upsertUserBudget,
} from "./budgets";

const prisma = new PrismaClient();

test("parseBudgetMonth accepts YYYY-MM and YYYY-MM-DD", () => {
  const d = parseBudgetMonth("2026-06");
  assert.equal(formatBudgetMonth(d), "2026-06");
  assert.equal(formatBudgetMonth(parseBudgetMonth("2026-06-15")), "2026-06");
});

test("parseBudgetMonth rejects invalid input", () => {
  assert.throws(() => parseBudgetMonth("June 2026"));
  assert.throws(() => parseBudgetMonth(""));
});

test("upsertUserBudget and serializeBudget with spent", async () => {
  const user = await prisma.user.create({
    data: {
      email: `bud-${Date.now()}@test.local`,
      username: `buduser${Date.now()}`,
      passwordHash: "x",
    },
  });
  await ensureDefaultCategories(prisma, user.id);
  const cats = await prisma.category.findMany({ where: { userId: user.id } });
  const food = cats.find((c) => c.name === "Food");
  assert.ok(food);

  const month = parseBudgetMonth("2026-03");
  const row = await upsertUserBudget(prisma, user.id, {
    categoryId: food.id,
    budgetMonth: month,
    amount: 400,
    currency: "PLN",
  });
  assert.equal(Number(row.amount), 400);

  const listed = await listUserBudgets(prisma, user.id, month);
  assert.equal(listed.length, 1);

  const serialized = serializeBudget(row, "Food", 200);
  assert.equal(serialized.categoryName, "Food");
  assert.equal(serialized.spent, 200);
  assert.equal(serialized.pctUsed, 50);

  await deleteUserBudget(prisma, user.id, row.id);
  await assert.rejects(() => deleteUserBudget(prisma, user.id, row.id));
});

test("upsertUserBudget rejects invalid category and negative amount", async () => {
  const user = await prisma.user.create({
    data: {
      email: `bud2-${Date.now()}@test.local`,
      username: `buduser2${Date.now()}`,
      passwordHash: "x",
    },
  });
  await ensureDefaultCategories(prisma, user.id);
  const food = await prisma.category.findFirst({
    where: { userId: user.id, name: "Food" },
  });
  assert.ok(food);
  const month = parseBudgetMonth("2026-04");
  await assert.rejects(() =>
    upsertUserBudget(prisma, user.id, {
      categoryId: 999999,
      budgetMonth: month,
      amount: 100,
      currency: "PLN",
    }),
  );
  await assert.rejects(() =>
    upsertUserBudget(prisma, user.id, {
      categoryId: food.id,
      budgetMonth: month,
      amount: -1,
      currency: "PLN",
    }),
  );
});
