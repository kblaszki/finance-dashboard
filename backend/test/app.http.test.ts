import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth";
import { createTestPrisma, disconnectTestPrisma, resetDatabase } from "./prismaTestClient";

const JWT_SECRET = "test-jwt-secret-must-be-at-least-32-characters";

let prisma: PrismaClient;
let app: Express;

test.before(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  prisma = await createTestPrisma();
  const mod = await import("../src/app");
  app = mod.app;
});

test.after(async () => {
  await disconnectTestPrisma(prisma);
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
});

async function createUserAndToken(): Promise<{ token: string; userId: number }> {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: {
      email: "http@test.local",
      username: "httpuser",
      passwordHash,
    },
  });
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "http@test.local", password: "testpass123" });
  assert.equal(res.status, 200);
  return { token: res.body.token, userId: user.id };
}

async function registerAndLogin(
  email: string,
  username: string,
  password: string,
): Promise<string> {
  const reg = await request(app).post("/api/auth/register").send({ email, username, password });
  assert.equal(reg.status, 201);
  return reg.body.token as string;
}

test("GET /api/health returns ok", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.db, true);
});

test("GET /api/auth/config returns allowRegister", async () => {
  const res = await request(app).get("/api/auth/config");
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.allowRegister, "boolean");
});

test("POST /api/auth/register returns 403 when ALLOW_REGISTER=false", async () => {
  const prev = process.env.ALLOW_REGISTER;
  process.env.ALLOW_REGISTER = "false";
  try {
    const res = await request(app).post("/api/auth/register").send({
      email: "blocked@test.local",
      username: "blocked",
      password: "testpass123",
    });
    assert.equal(res.status, 403);
  } finally {
    if (prev === undefined) delete process.env.ALLOW_REGISTER;
    else process.env.ALLOW_REGISTER = prev;
  }
});

test("POST /api/auth/register creates user", async () => {
  const res = await request(app).post("/api/auth/register").send({
    email: "newuser@test.local",
    username: "newuser",
    password: "password123",
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.token);
  assert.equal(res.body.user.email, "newuser@test.local");

  const cats = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${res.body.token}`);
  assert.equal(cats.status, 200);
  assert.equal(cats.body.length, 8);
  const rows = cats.body as Array<{ id: number; name: string; parentId: number | null }>;
  const byName = new Map(rows.map((c) => [c.name, c]));
  assert.equal(byName.get("Income")?.parentId, null);
  assert.equal(byName.get("Expense")?.parentId, null);
  assert.equal(byName.get("Salary")?.parentId, byName.get("Income")!.id);
  assert.equal(byName.get("Food")?.parentId, byName.get("Expense")!.id);
});

test("POST /api/auth/register rejects short password", async () => {
  const res = await request(app).post("/api/auth/register").send({
    email: "short@test.local",
    username: "short",
    password: "abc",
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /8 characters/);
});

test("POST /api/auth/register rejects duplicate email", async () => {
  await request(app).post("/api/auth/register").send({
    email: "dup@test.local",
    username: "dup1",
    password: "password123",
  });
  const res = await request(app).post("/api/auth/register").send({
    email: "dup@test.local",
    username: "dup2",
    password: "password123",
  });
  assert.equal(res.status, 500);
});

test("POST /api/auth/login rejects wrong password", async () => {
  await request(app).post("/api/auth/register").send({
    email: "loginfail@test.local",
    username: "loginfail",
    password: "password123",
  });
  const res = await request(app).post("/api/auth/login").send({
    email: "loginfail@test.local",
    password: "wrongpassword",
  });
  assert.equal(res.status, 401);
});

test("POST /api/auth/login accepts username identifier", async () => {
  await request(app).post("/api/auth/register").send({
    email: "userlogin@test.local",
    username: "MyUser99",
    password: "password123",
  });
  const res = await request(app).post("/api/auth/login").send({
    login: "myuser99",
    password: "password123",
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.username, "MyUser99");
});

test("POST /api/auth/login requires identifier", async () => {
  const res = await request(app).post("/api/auth/login").send({ password: "password123" });
  assert.equal(res.status, 400);
});

test("GET /api/auth/me returns 401 without token", async () => {
  const res = await request(app).get("/api/auth/me");
  assert.equal(res.status, 401);
});

test("GET /api/auth/me returns current user", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.email, "http@test.local");
});

test("PATCH /api/auth/profile rejects invalid username", async () => {
  const token = await registerAndLogin("badname@test.local", "badnameuser", "password123");
  const res = await request(app)
    .patch("/api/auth/profile")
    .set("Authorization", `Bearer ${token}`)
    .send({ username: "x" });
  assert.equal(res.status, 400);
});

test("PATCH /api/auth/profile updates username", async () => {
  const token = await registerAndLogin("profile@test.local", "profileuser", "password123");
  const res = await request(app)
    .patch("/api/auth/profile")
    .set("Authorization", `Bearer ${token}`)
    .send({ username: "renamed_user" });
  assert.equal(res.status, 200);
  assert.equal(res.body.username, "renamed_user");
});

test("PATCH /api/auth/password rejects short new password", async () => {
  const token = await registerAndLogin("shortpwd@test.local", "shortpwduser", "password123");
  const res = await request(app)
    .patch("/api/auth/password")
    .set("Authorization", `Bearer ${token}`)
    .send({ currentPassword: "password123", newPassword: "short" });
  assert.equal(res.status, 400);
});

test("PATCH /api/auth/password requires current password", async () => {
  const token = await registerAndLogin("pwd@test.local", "pwduser", "password123");
  const bad = await request(app)
    .patch("/api/auth/password")
    .set("Authorization", `Bearer ${token}`)
    .send({ currentPassword: "wrong", newPassword: "newpassword99" });
  assert.equal(bad.status, 401);

  const ok = await request(app)
    .patch("/api/auth/password")
    .set("Authorization", `Bearer ${token}`)
    .send({ currentPassword: "password123", newPassword: "newpassword99" });
  assert.equal(ok.status, 200);

  const loginOld = await request(app)
    .post("/api/auth/login")
    .send({ login: "pwd@test.local", password: "password123" });
  assert.equal(loginOld.status, 401);

  const loginNew = await request(app)
    .post("/api/auth/login")
    .send({ login: "pwd@test.local", password: "newpassword99" });
  assert.equal(loginNew.status, 200);
});

test("PATCH /api/auth/email updates email with current password", async () => {
  const token = await registerAndLogin("oldmail@test.local", "mailuser", "password123");
  const bad = await request(app)
    .patch("/api/auth/email")
    .set("Authorization", `Bearer ${token}`)
    .send({ email: "newmail@test.local", currentPassword: "wrong" });
  assert.equal(bad.status, 401);

  const ok = await request(app)
    .patch("/api/auth/email")
    .set("Authorization", `Bearer ${token}`)
    .send({ email: "newmail@test.local", currentPassword: "password123" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.email, "newmail@test.local");
});

test("GET /api/accounts returns 401 without token", async () => {
  const res = await request(app).get("/api/accounts");
  assert.equal(res.status, 401);
});

test("POST /api/accounts creates BANK account with totalBalance", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Checking",
      currency: "pln",
      openingBalance: 100.5,
      description: "Main bank",
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.accountType, "BANK");
  assert.equal(res.body.name, "Checking");
  assert.equal(res.body.currency, "PLN");
  assert.equal(res.body.cashBalance, 100.5);
  assert.equal(res.body.openingBalance, 100.5);
  assert.equal(res.body.totalBalance, 100.5);
  assert.equal(res.body.description, "Main bank");
});

test("POST /api/accounts creates each allowed accountType", async () => {
  const { token } = await createUserAndToken();
  const types = [
    "BANK",
    "BROKERAGE",
    "CRYPTO",
    "PRECIOUS_METAL",
    "REAL_ESTATE",
    "OTHER",
    "MANUAL",
  ];
  for (const accountType of types) {
    const res = await request(app)
      .post("/api/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Acct-${accountType}`, accountType, openingBalance: 1 });
    assert.equal(res.status, 201, accountType);
    assert.equal(res.body.accountType, accountType);
  }
});

test("POST /api/accounts normalizes accountType case", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Broker Case", accountType: "brokerage" });
  assert.equal(res.status, 201);
  assert.equal(res.body.accountType, "BROKERAGE");
});

test("POST /api/accounts rejects unknown accountType", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Bad Type", accountType: "FOO" });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /accountType/i);
});

test("POST /api/accounts rejects duplicate name for same user", async () => {
  const { token } = await createUserAndToken();
  const first = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Dup" });
  assert.equal(first.status, 201);
  const second = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Dup" });
  assert.equal(second.status, 400);
  assert.match(second.body.error, /already exists/i);
});

test("GET /api/accounts lists own accounts newest first", async () => {
  const { token } = await createUserAndToken();
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Older", openingBalance: 10 });
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Newer", openingBalance: 20 });
  const res = await request(app).get("/api/accounts").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
  assert.equal(res.body[0].name, "Newer");
  assert.equal(res.body[0].totalBalance, 20);
  assert.equal(res.body[1].name, "Older");
});

test("GET/PATCH/DELETE /api/accounts/:id scoped to owner", async () => {
  const { token } = await createUserAndToken();
  const otherToken = await registerAndLogin("other@test.local", "otheruser", "password123");
  const created = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Mine", currency: "EUR", openingBalance: 50 });
  assert.equal(created.status, 201);
  const id = created.body.id as number;

  const getOwn = await request(app)
    .get(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(getOwn.status, 200);
  assert.equal(getOwn.body.name, "Mine");

  const getOther = await request(app)
    .get(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(getOther.status, 404);

  const patchOther = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ name: "Hijacked" });
  assert.equal(patchOther.status, 404);

  const patchOwn = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Renamed", description: "Updated", currency: "usd" });
  assert.equal(patchOwn.status, 200);
  assert.equal(patchOwn.body.name, "Renamed");
  assert.equal(patchOwn.body.description, "Updated");
  assert.equal(patchOwn.body.currency, "USD");
  assert.equal(patchOwn.body.cashBalance, 50);

  const deleteOther = await request(app)
    .delete(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(deleteOther.status, 404);

  const deleteOwn = await request(app)
    .delete(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleteOwn.status, 204);

  const getGone = await request(app)
    .get(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(getGone.status, 404);
});

test("PATCH /api/accounts/:id ignores accountType", async () => {
  const { token } = await createUserAndToken();
  const created = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Typed", accountType: "CRYPTO", openingBalance: 5 });
  assert.equal(created.status, 201);
  const id = created.body.id as number;

  const patched = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Typed Renamed", accountType: "BANK" });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.name, "Typed Renamed");
  assert.equal(patched.body.accountType, "CRYPTO");
});

test("POST /api/accounts/:id/transactions updates cashBalance for INCOME and EXPENSE", async () => {
  const { token } = await createUserAndToken();
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Ledger", openingBalance: 100 });
  assert.equal(account.status, 201);
  const accountId = account.body.id as number;

  const income = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 25, description: "Pay" });
  assert.equal(income.status, 201);
  assert.equal(income.body.type, "INCOME");
  assert.equal(income.body.amount, 25);
  assert.ok(income.body.occurredAt);

  const afterIncome = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(afterIncome.body.cashBalance, 125);

  const expense = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "expense", amount: 40 });
  assert.equal(expense.status, 201);
  assert.equal(expense.body.type, "EXPENSE");

  const afterExpense = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(afterExpense.body.cashBalance, 85);
});

test("GET /api/accounts/:id/transactions lists newest first and scopes ownership", async () => {
  const { token } = await createUserAndToken();
  const otherToken = await registerAndLogin("txother@test.local", "txother", "password123");
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "ListTx", openingBalance: 10 });
  const accountId = account.body.id as number;

  await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 1, occurredAt: "2024-01-01T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "EXPENSE", amount: 2, occurredAt: "2024-06-01T00:00:00.000Z" });

  const list = await request(app)
    .get(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 2);
  assert.equal(list.body[0].type, "EXPENSE");
  assert.equal(list.body[1].type, "INCOME");

  const forbidden = await request(app)
    .get(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(forbidden.status, 404);
});

test("DELETE /api/accounts/:id/transactions/:txId reverses cashBalance", async () => {
  const { token } = await createUserAndToken();
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Rev", openingBalance: 50 });
  const accountId = account.body.id as number;

  const income = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 30 });
  const txId = income.body.id as number;

  const deleted = await request(app)
    .delete(`/api/accounts/${accountId}/transactions/${txId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleted.status, 204);

  const after = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(after.body.cashBalance, 50);

  const list = await request(app)
    .get(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(list.body.length, 0);
});

test("cash transactions reject invalid input and mismatched account", async () => {
  const { token } = await createUserAndToken();
  const a = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "A1", openingBalance: 10 });
  const b = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "A2", openingBalance: 10 });
  const accountId = a.body.id as number;
  const otherAccountId = b.body.id as number;

  const zero = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 0 });
  assert.equal(zero.status, 400);

  const badType = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "TRANSFER", amount: 5 });
  assert.equal(badType.status, 400);

  const created = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 5 });
  const txId = created.body.id as number;

  const wrongAccount = await request(app)
    .delete(`/api/accounts/${otherAccountId}/transactions/${txId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(wrongAccount.status, 404);

  const missing = await request(app)
    .delete(`/api/accounts/${accountId}/transactions/999999`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missing.status, 404);
});

test("categories CRUD supports nesting, rename, reparent, and delete rules", async () => {
  const token = await registerAndLogin("cats@test.local", "catsuser", "password123");

  const roots = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(roots.status, 200);
  const income = (roots.body as Array<{ id: number; name: string }>).find((c) => c.name === "Income")!;
  assert.ok(income);

  const created = await request(app)
    .post("/api/categories")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Bonus", parentId: income.id });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, "Bonus");
  assert.equal(created.body.parentId, income.id);

  const dup = await request(app)
    .post("/api/categories")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "bonus", parentId: income.id });
  assert.equal(dup.status, 400);

  const renamed = await request(app)
    .patch(`/api/categories/${created.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Yearly bonus" });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.name, "Yearly bonus");

  const expense = (roots.body as Array<{ id: number; name: string }>).find((c) => c.name === "Expense")!;
  const reparented = await request(app)
    .patch(`/api/categories/${created.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ parentId: expense.id });
  assert.equal(reparented.status, 200);
  assert.equal(reparented.body.parentId, expense.id);

  const cycle = await request(app)
    .patch(`/api/categories/${expense.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ parentId: created.body.id });
  assert.equal(cycle.status, 400);

  const deleteParent = await request(app)
    .delete(`/api/categories/${expense.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleteParent.status, 409);

  const deleted = await request(app)
    .delete(`/api/categories/${created.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleted.status, 204);
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
  const tagged = (list.body as Array<{ id: number; categoryId: number | null }>).find(
    (t) => t.id === withCat.body.id,
  );
  assert.equal(tagged?.categoryId, null);
});
