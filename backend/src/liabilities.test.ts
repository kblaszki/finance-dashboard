import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  createUserLiability,
  parseLiabilityType,
  sumUserLiabilitiesInCurrency,
  updateUserLiability,
} from "./liabilities";

const prisma = new PrismaClient();

test("parseLiabilityType accepts mortgage", () => {
  assert.equal(parseLiabilityType("mortgage"), "mortgage");
  assert.throws(() => parseLiabilityType("unknown"));
});

test("sumUserLiabilitiesInCurrency converts balances", async () => {
  const user = await prisma.user.create({
    data: {
      email: `liab-${Date.now()}@test.local`,
      username: `liabuser${Date.now()}`,
      passwordHash: "x",
    },
  });
  await createUserLiability(prisma, user.id, {
    name: "Loan",
    liabilityType: "loan",
    balance: 1000,
    currency: "PLN",
  });
  const total = await sumUserLiabilitiesInCurrency(prisma, user.id, "PLN", { PLN: 1 });
  assert.equal(total, 1000);
});

test("updateUserLiability clears linked account", async () => {
  const user = await prisma.user.create({
    data: {
      email: `liab-upd-${Date.now()}@test.local`,
      username: `liabupd${Date.now()}`,
      passwordHash: "x",
    },
  });
  const bank = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Bank",
      currency: "PLN",
      cashBalance: 0,
    },
  });
  const row = await createUserLiability(prisma, user.id, {
    name: "Mortgage",
    liabilityType: "mortgage",
    balance: 200000,
    currency: "PLN",
    accountId: bank.id,
  });
  const updated = await updateUserLiability(prisma, user.id, row.id, {
    name: "Mortgage paid down",
    balance: 150000,
    accountId: null,
    liabilityType: "loan",
  });
  assert.equal(updated.name, "Mortgage paid down");
  assert.equal(updated.accountId, null);
  assert.equal(updated.liabilityType, "loan");
});
