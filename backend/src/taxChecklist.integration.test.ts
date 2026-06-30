import test from "node:test";
import assert from "node:assert/strict";
import { buildTaxCalendarResponse } from "./taxChecklist";
import type { PrismaClient } from "@prisma/client";
import { createTestPrisma, disconnectTestPrisma, resetDatabase } from "../test/prismaTestClient";

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

test("buildTaxCalendarResponse returns deadlines and checklist", async () => {
  const user = await prisma.user.create({
    data: { email: "cal@test.local", username: "cal", passwordHash: "x" },
  });
  const data = await buildTaxCalendarResponse(prisma, user.id, 2025);
  assert.equal(data.taxYear, 2025);
  assert.ok(data.deadlines.length >= 2);
  assert.equal(data.checklist.length, 7);
  assert.equal(data.correctionNeeded, false);
});
