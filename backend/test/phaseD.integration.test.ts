import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth";
import { computeBudgetAlerts } from "../src/budgetAlerts";
import { convertAmount } from "../src/fx";
import { createCategorizationRule } from "../src/categorizationRules";
import { upsertAccountSyncSetting, runAccountSync } from "../src/accountSync";
import { exportUserData } from "../src/dataExport";
import { writeAuditLog } from "../src/auditLog";
import { MOCK_FX } from "./helpers/seedFromFixture";
import { createTestPrisma, disconnectTestPrisma, resetDatabase } from "./prismaTestClient";

let prisma: PrismaClient;

function toNumber(v: unknown): number {
  return Number(v);
}

test.before(async () => {
  prisma = await createTestPrisma();
});

test.after(async () => {
  await disconnectTestPrisma(prisma);
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
});

test("computeBudgetAlerts warns at 80% threshold", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "alert@test.local", username: "alertuser", passwordHash },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Bank",
      currency: "PLN",
      openingBalance: 1000,
      cashBalance: 1000,
    },
  });
  const category = await prisma.category.create({
    data: { userId: user.id, name: "Food", sortOrder: 0 },
  });
  const month = new Date("2026-06-01T00:00:00.000Z");
  await prisma.budget.create({
    data: {
      userId: user.id,
      categoryId: category.id,
      budgetMonth: month,
      amount: 100,
      currency: "PLN",
    },
  });
  await prisma.transaction.create({
    data: {
      accountId: account.id,
      transactionType: "EXPENSE",
      amount: 85,
      balanceAfter: 915,
      currency: "PLN",
      category: "Food",
      categoryId: category.id,
      date: new Date("2026-06-05T12:00:00.000Z"),
    },
  });

  const alerts = await computeBudgetAlerts(
    prisma,
    user.id,
    month,
    "PLN",
    MOCK_FX.plnPerUnit,
    convertAmount,
    toNumber,
  );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].threshold, 80);
  assert.equal(alerts[0].severity, "warning");
});

test("account sync runs market sync for brokerage when enabled", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "sync@test.local", username: "syncuser2", passwordHash },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  await upsertAccountSyncSetting(prisma, user.id, account.id, { syncEnabled: true });
  const result = await runAccountSync(prisma, user.id, account.id, async () => MOCK_FX);
  assert.equal(result.status, "ok");
});

test("exportUserData includes user accounts", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "export@test.local", username: "exportuser", passwordHash },
  });
  await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Bank",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  const data = await exportUserData(prisma, user.id);
  assert.equal(data.user?.id, user.id);
  assert.equal(data.accounts.length, 1);
});

test("writeAuditLog stores transaction create", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "audit@test.local", username: "audituser", passwordHash },
  });
  await writeAuditLog(prisma, user.id, "transaction", 42, "create", null, { amount: 10 });
  const rows = await prisma.auditLog.findMany({ where: { userId: user.id } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].entityType, "transaction");
});

test("createCategorizationRule persists pattern", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "rule@test.local", username: "ruleuser", passwordHash },
  });
  const category = await prisma.category.create({
    data: { userId: user.id, name: "Fuel", sortOrder: 0 },
  });
  const rule = await createCategorizationRule(prisma, user.id, {
    categoryId: category.id,
    pattern: "ORLEN",
    matchType: "contains",
  });
  assert.equal(rule.pattern, "ORLEN");
});
