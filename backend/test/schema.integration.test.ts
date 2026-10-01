import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { createTestPrisma, disconnectTestPrisma, resetDatabase } from "./prismaTestClient";
import { canonicalUsernameKey } from "../src/auth";

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

test("User.email is unique", async () => {
  await prisma.user.create({
    data: { email: "unique@test.local", username: "u1", usernameKey: canonicalUsernameKey("u1"), passwordHash: "x" },
  });
  await assert.rejects(() =>
    prisma.user.create({
      data: { email: "unique@test.local", username: "u2", usernameKey: canonicalUsernameKey("u2"), passwordHash: "x" },
    }),
  );
});

test("User.username is unique", async () => {
  await prisma.user.create({
    data: { email: "a@test.local", username: "same", usernameKey: canonicalUsernameKey("same"), passwordHash: "x" },
  });
  await assert.rejects(() =>
    prisma.user.create({
      data: { email: "b@test.local", username: "same", usernameKey: canonicalUsernameKey("same"), passwordHash: "x" },
    }),
  );
});

test("Account name is unique per user", async () => {
  const user = await prisma.user.create({
    data: { email: "acct@test.local", username: "acctuser", usernameKey: canonicalUsernameKey("acctuser"), passwordHash: "x" },
  });
  await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Checking",
      currency: "PLN",
    },
  });
  await assert.rejects(() =>
    prisma.account.create({
      data: {
        userId: user.id,
        accountType: "BANK",
        name: "Checking",
        currency: "PLN",
      },
    }),
  );
});
