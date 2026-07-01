import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./auth";
import {
  BUILTIN_IMPORT_PRESETS,
  createImportPreset,
  deleteImportPreset,
  listImportPresets,
} from "./importPresets";
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

test("listImportPresets returns builtin and custom presets", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "preset@test.local", username: "presetuser", passwordHash },
  });

  const empty = await listImportPresets(prisma, user.id);
  assert.ok(empty.builtin.length >= BUILTIN_IMPORT_PRESETS.length);
  assert.equal(empty.custom.length, 0);

  await createImportPreset(prisma, user.id, {
    name: "My CSV",
    broker: "custom",
    targetType: "cash_flow",
    columnMapping: { date: "Date", amount: "Amount" },
  });

  const withCustom = await listImportPresets(prisma, user.id);
  assert.equal(withCustom.custom.length, 1);
  assert.equal(withCustom.custom[0].name, "My CSV");

  await deleteImportPreset(prisma, user.id, withCustom.custom[0].id);
  const afterDelete = await listImportPresets(prisma, user.id);
  assert.equal(afterDelete.custom.length, 0);
});
