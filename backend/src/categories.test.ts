import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  buildCategoryTree,
  createUserCategory,
  ensureDefaultCategories,
} from "./categories";

const prisma = new PrismaClient();

test("ensureDefaultCategories seeds once per user", async () => {
  const user = await prisma.user.create({
    data: {
      email: `cat-${Date.now()}@test.local`,
      username: `catuser${Date.now()}`,
      passwordHash: "x",
    },
  });
  const first = await ensureDefaultCategories(prisma, user.id);
  const second = await ensureDefaultCategories(prisma, user.id);
  assert.ok(first > 0);
  assert.equal(second, 0);
});

test("buildCategoryTree nests children under parent", () => {
  const tree = buildCategoryTree([
    { id: 1, userId: 1, name: "Root", parentId: null, sortOrder: 0, createdAt: new Date() },
    { id: 2, userId: 1, name: "Child", parentId: 1, sortOrder: 0, createdAt: new Date() },
  ]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0]?.children.length, 1);
  assert.equal(tree[0]?.children[0]?.name, "Child");
});

test("createUserCategory rejects duplicate sibling names", async () => {
  const user = await prisma.user.create({
    data: {
      email: `dup-${Date.now()}@test.local`,
      username: `dupuser${Date.now()}`,
      passwordHash: "x",
    },
  });
  await createUserCategory(prisma, user.id, { name: "Food" });
  await assert.rejects(() => createUserCategory(prisma, user.id, { name: "Food" }));
});
