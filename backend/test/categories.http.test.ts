import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import {
  createUserAndToken as createUserAndTokenHarness,
  registerAndLogin as registerAndLoginHarness,
  resetHttpSuite,
  startHttpSuite,
  stopHttpSuite,
  type HttpSuite,
} from "./httpHarness";

let suite: HttpSuite;
let prisma: PrismaClient;
let app: Express;

test.before(async () => {
  suite = await startHttpSuite();
  prisma = suite.prisma;
  app = suite.app;
});

test.after(async () => {
  await stopHttpSuite(suite);
});

test.beforeEach(async () => {
  await resetHttpSuite(suite);
});

async function createUserAndToken(): Promise<{ token: string; userId: number }> {
  return createUserAndTokenHarness(suite);
}

async function registerAndLogin(
  email: string,
  username: string,
  password: string,
): Promise<string> {
  return registerAndLoginHarness(suite, email, username, password);
}

test("categories CRUD supports nesting, rename, reparent, and delete rules", async () => {
  const token = await registerAndLogin("cats@test.local", "catsuser", "password123");

  const roots = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(roots.status, 200);
  const cats = roots.body as Array<{
    id: number;
    name: string;
    parentId: number | null;
    ledgerType: string;
  }>;
  const salary = cats.find((c) => c.name === "Salary")!;
  const food = cats.find((c) => c.name === "Food")!;
  const otherIncome = cats.find((c) => c.name === "Other income")!;
  assert.ok(salary);
  assert.equal(salary.ledgerType, "INCOME");
  assert.equal(salary.parentId, null);

  const rootMissingType = await request(app)
    .post("/api/categories")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Side hustle" });
  assert.equal(rootMissingType.status, 400);

  const created = await request(app)
    .post("/api/categories")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Bonus", parentId: salary.id });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, "Bonus");
  assert.equal(created.body.parentId, salary.id);
  assert.equal(created.body.ledgerType, "INCOME");

  const dup = await request(app)
    .post("/api/categories")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "bonus", parentId: salary.id });
  assert.equal(dup.status, 400);

  const renamed = await request(app)
    .patch(`/api/categories/${created.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Yearly bonus" });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.name, "Yearly bonus");

  const crossType = await request(app)
    .patch(`/api/categories/${created.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ parentId: food.id });
  assert.equal(crossType.status, 400);

  const changeType = await request(app)
    .patch(`/api/categories/${created.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ ledgerType: "EXPENSE" });
  assert.equal(changeType.status, 400);

  const reparented = await request(app)
    .patch(`/api/categories/${created.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ parentId: otherIncome.id });
  assert.equal(reparented.status, 200);
  assert.equal(reparented.body.parentId, otherIncome.id);
  assert.equal(reparented.body.ledgerType, "INCOME");

  const cycle = await request(app)
    .patch(`/api/categories/${otherIncome.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ parentId: created.body.id });
  assert.equal(cycle.status, 400);

  const nestedExpense = await request(app)
    .post("/api/categories")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Groceries", parentId: food.id });
  assert.equal(nestedExpense.status, 201);

  const deleteParent = await request(app)
    .delete(`/api/categories/${food.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleteParent.status, 409);

  const deleted = await request(app)
    .delete(`/api/categories/${created.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleted.status, 204);
});

test("GET/POST /api/categories export import preview merge", async () => {
  const token = await registerAndLogin(
    "catscsv@test.local",
    "catscsv",
    "password123",
  );
  const otherToken = await registerAndLogin(
    "catscsvother@test.local",
    "catscsvother",
    "password123",
  );

  const unauth = await request(app).get("/api/categories/export");
  assert.equal(unauth.status, 401);

  const exported = await request(app)
    .get("/api/categories/export")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(exported.status, 200);
  assert.match(exported.headers["content-type"] ?? "", /text\/csv/);
  assert.match(exported.text, /^path,ledgerType\n/);
  assert.match(exported.text, /Food,EXPENSE/);
  assert.match(exported.text, /Salary,INCOME/);

  const csv = [
    "path,ledgerType",
    "Food,EXPENSE",
    "Food/Groceries,EXPENSE",
    "Side hustle,INCOME",
  ].join("\n");

  const preview = await request(app)
    .post("/api/categories/import/preview")
    .set("Authorization", `Bearer ${token}`)
    .send({ csv });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.rowCount, 3);
  assert.equal(preview.body.existing, 1);
  assert.equal(preview.body.toCreate, 2);

  const imported = await request(app)
    .post("/api/categories/import")
    .set("Authorization", `Bearer ${token}`)
    .send({ csv });
  assert.equal(imported.status, 201);
  assert.equal(imported.body.created, 2);
  assert.equal(imported.body.skipped, 1);

  const listed = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  const names = (listed.body as Array<{ name: string }>).map((c) => c.name);
  assert.ok(names.includes("Groceries"));
  assert.ok(names.includes("Side hustle"));

  const reimport = await request(app)
    .post("/api/categories/import")
    .set("Authorization", `Bearer ${token}`)
    .send({ csv });
  assert.equal(reimport.status, 201);
  assert.equal(reimport.body.created, 0);
  assert.equal(reimport.body.skipped, 3);

  const conflict = await request(app)
    .post("/api/categories/import/preview")
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: "path,ledgerType\nFood,INCOME\n" });
  assert.equal(conflict.status, 400);

  const foreign = await request(app)
    .post("/api/categories/import")
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ csv: "path,ledgerType\nOnlyOther,EXPENSE\n" });
  assert.equal(foreign.status, 201);
  const otherList = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(
    (otherList.body as Array<{ name: string }>).some((c) => c.name === "OnlyOther"),
    false,
  );
});

test("category and foreign-account writes return 404 for another user", async () => {
  const token = await registerAndLogin("owneridor@test.local", "owneridor", "password123");
  const otherToken = await registerAndLogin("otheridor@test.local", "otheridor", "password123");
  const cats = await request(app).get("/api/categories").set("Authorization", `Bearer ${token}`);
  const food = (cats.body as Array<{ id: number; name: string }>).find((c) => c.name === "Food")!;
  assert.ok(food);

  const patched = await request(app)
    .patch(`/api/categories/${food.id}`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ name: "Hijack" });
  assert.equal(patched.status, 404);

  const deleted = await request(app)
    .delete(`/api/categories/${food.id}`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(deleted.status, 404);

  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Owned", openingBalance: 1 });
  const posted = await request(app)
    .post(`/api/accounts/${account.body.id}/transactions`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ type: "INCOME", amount: 1 });
  assert.equal(posted.status, 404);
});

test("cash transactions accept optional categoryId and null on category delete", async () => {
  const token = await registerAndLogin("txcat@test.local", "txcatuser", "password123");
  const otherToken = await registerAndLogin("txcat2@test.local", "txcat2", "password123");

  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "CatLedger", openingBalance: 20 });
  const accountId = account.body.id as number;

  const cats = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  const food = (cats.body as Array<{ id: number; name: string }>).find((c) => c.name === "Food")!;
  assert.ok(food);

  const withCat = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "EXPENSE", amount: 5, categoryId: food.id });
  assert.equal(withCat.status, 201);
  assert.equal(withCat.body.categoryId, food.id);

  const mismatch = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 2, categoryId: food.id });
  assert.equal(mismatch.status, 400);

  const omit = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 3 });
  assert.equal(omit.status, 201);
  assert.equal(omit.body.categoryId, null);

  const foreign = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "EXPENSE", amount: 1, categoryId: 999999 });
  assert.equal(foreign.status, 404);

  const otherCats = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${otherToken}`);
  const otherFood = (otherCats.body as Array<{ id: number; name: string }>).find(
    (c) => c.name === "Food",
  )!;
  const crossUser = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "EXPENSE", amount: 1, categoryId: otherFood.id });
  assert.equal(crossUser.status, 404);

  const delCat = await request(app)
    .delete(`/api/categories/${food.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(delCat.status, 204);

  const list = await request(app)
    .get(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(list.status, 200);
  const tagged = (list.body.items as Array<{ id: number; categoryId: number | null }>).find(
    (t) => t.id === withCat.body.id,
  );
  assert.equal(tagged?.categoryId, null);
});

test("tags CRUD and cash transaction tagIds", async () => {
  const token = await registerAndLogin("tags@test.local", "tagsuser", "password123");
  const otherToken = await registerAndLogin(
    "tagsother@test.local",
    "tagsother",
    "password123",
  );

  const unauth = await request(app).get("/api/tags");
  assert.equal(unauth.status, 401);

  const created = await request(app)
    .post("/api/tags")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Work" });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, "Work");
  const tagId = created.body.id as number;

  const dup = await request(app)
    .post("/api/tags")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "work" });
  assert.equal(dup.status, 400);

  const personal = await request(app)
    .post("/api/tags")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Personal" });
  assert.equal(personal.status, 201);

  const listed = await request(app)
    .get("/api/tags")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.length, 2);

  const renamed = await request(app)
    .patch(`/api/tags/${tagId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Office" });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.name, "Office");

  const foreignPatch = await request(app)
    .patch(`/api/tags/${tagId}`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ name: "Hijack" });
  assert.equal(foreignPatch.status, 404);

  const foreignDelete = await request(app)
    .delete(`/api/tags/${tagId}`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(foreignDelete.status, 404);

  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "TagLedger", openingBalance: 100 });
  const accountId = account.body.id as number;

  const withTags = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 12,
      tagIds: [tagId, personal.body.id],
    });
  assert.equal(withTags.status, 201);
  assert.deepEqual(withTags.body.tagIds, [tagId, personal.body.id].sort((a, b) => a - b));

  const replaced = await request(app)
    .patch(`/api/accounts/${accountId}/transactions/${withTags.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ tagIds: [personal.body.id] });
  assert.equal(replaced.status, 200);
  assert.deepEqual(replaced.body.tagIds, [personal.body.id]);

  const cleared = await request(app)
    .patch(`/api/accounts/${accountId}/transactions/${withTags.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ tagIds: [] });
  assert.equal(cleared.status, 200);
  assert.deepEqual(cleared.body.tagIds, []);

  await request(app)
    .patch(`/api/accounts/${accountId}/transactions/${withTags.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ tagIds: [tagId] });

  const delTag = await request(app)
    .delete(`/api/tags/${tagId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(delTag.status, 204);

  const list = await request(app)
    .get(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  const row = (list.body.items as Array<{ id: number; tagIds: number[] }>).find(
    (t) => t.id === withTags.body.id,
  );
  assert.deepEqual(row?.tagIds, []);
});
