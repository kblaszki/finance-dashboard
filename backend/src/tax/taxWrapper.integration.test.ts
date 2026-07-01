import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { createIkzeContribution, createTaxWrapperWithdrawal } from "./taxWrapper";
import { createTestPrisma, disconnectTestPrisma, resetDatabase } from "../../test/prismaTestClient";

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

test("createTaxWrapperWithdrawal persists row for brokerage account", async () => {
  const user = await prisma.user.create({
    data: { email: "tw@test.local", username: "tw", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "IKE",
      currency: "PLN",
      taxWrapperType: "ike",
    },
  });
  const row = await createTaxWrapperWithdrawal(prisma, user.id, {
    accountId: account.id,
    withdrawnOn: new Date("2026-05-01"),
    amount: 1000,
    currency: "PLN",
    withdrawalType: "partial",
    includeInPit38: true,
  });
  assert.equal(row.amount.toString(), "1000");
  assert.equal(row.withdrawalType, "partial");
});

test("createIkzeContribution requires IKZE account", async () => {
  const user = await prisma.user.create({
    data: { email: "ikze@test.local", username: "ikze", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Standard",
      currency: "PLN",
      taxWrapperType: "standard",
    },
  });
  await assert.rejects(
    () =>
      createIkzeContribution(prisma, user.id, {
        accountId: account.id,
        taxYear: 2026,
        amount: 500,
        currency: "PLN",
        contributedOn: new Date("2026-01-01"),
      }),
    /IKZE account/,
  );
});
