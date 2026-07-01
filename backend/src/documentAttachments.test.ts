import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./auth";
import {
  createDocumentAttachment,
  deleteDocumentAttachment,
  listDocumentAttachments,
} from "./documentAttachments";
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

test("document attachment CRUD", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "attach@test.local", username: "attachuser", passwordHash },
  });

  const created = await createDocumentAttachment(prisma, user.id, {
    entityType: "transaction",
    entityId: 42,
    filename: "receipt.pdf",
    description: "Test",
  });
  assert.equal(created.filename, "receipt.pdf");

  const rows = await listDocumentAttachments(prisma, user.id, {
    entityType: "transaction",
    entityId: 42,
  });
  assert.equal(rows.length, 1);

  await deleteDocumentAttachment(prisma, user.id, created.id);
  const after = await listDocumentAttachments(prisma, user.id);
  assert.equal(after.length, 0);
});

test("createDocumentAttachment rejects invalid entityType", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "bad@test.local", username: "baduser", passwordHash },
  });
  await assert.rejects(
    () =>
      createDocumentAttachment(prisma, user.id, {
        entityType: "account",
        entityId: 1,
        filename: "x.pdf",
      }),
    /Invalid entityType/,
  );
});
