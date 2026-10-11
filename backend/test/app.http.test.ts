import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { canonicalUsernameKey, hashPassword } from "../src/auth";
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
      usernameKey: canonicalUsernameKey("httpuser"),
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

test("unknown API path returns JSON 404", async () => {
  const res = await request(app).get("/api/does-not-exist");
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: "Not found" });
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
  assert.equal(cats.body.length, 6);
  const rows = cats.body as Array<{
    id: number;
    name: string;
    parentId: number | null;
    ledgerType: string;
  }>;
  const byName = new Map(rows.map((c) => [c.name, c]));
  assert.equal(byName.has("Income"), false);
  assert.equal(byName.has("Expense"), false);
  assert.equal(byName.get("Salary")?.parentId, null);
  assert.equal(byName.get("Salary")?.ledgerType, "INCOME");
  assert.equal(byName.get("Other income")?.ledgerType, "INCOME");
  assert.equal(byName.get("Food")?.parentId, null);
  assert.equal(byName.get("Food")?.ledgerType, "EXPENSE");
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
  assert.equal(res.status, 409);
  assert.match(res.body.error, /already exists/i);
});

test("POST /api/auth/register rejects a username that differs only by case", async () => {
  const first = await request(app).post("/api/auth/register").send({
    email: "case1@test.local",
    username: "CaseUser",
    password: "password123",
  });
  assert.equal(first.status, 201);
  const res = await request(app).post("/api/auth/register").send({
    email: "case2@test.local",
    username: "caseuser",
    password: "password123",
  });
  assert.equal(res.status, 409);
});

test("malformed JSON stays a client error", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .set("Content-Type", "application/json")
    .send("{");
  assert.equal(res.status, 400);
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
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /current password/i);

  const stillAuthed = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(stillAuthed.status, 200);

  const ok = await request(app)
    .patch("/api/auth/password")
    .set("Authorization", `Bearer ${token}`)
    .send({ currentPassword: "password123", newPassword: "newpassword99" });
  assert.equal(ok.status, 200);

  const revoked = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(revoked.status, 401);

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
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /current password/i);

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
    "CREDIT_CARD",
    "IKE",
    "IKZE",
    "TREASURY_BONDS",
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

test("PATCH /api/accounts/:id locks currency once transactions exist", async () => {
  const { token } = await createUserAndToken();
  const created = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Lock", currency: "PLN", openingBalance: 10 });
  assert.equal(created.status, 201);
  const id = created.body.id as number;

  const emptyChange = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ currency: "eur" });
  assert.equal(emptyChange.status, 200);
  assert.equal(emptyChange.body.currency, "EUR");

  const back = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ currency: "PLN" });
  assert.equal(back.status, 200);

  const invalid = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ currency: "US" });
  assert.equal(invalid.status, 400);

  const posted = await request(app)
    .post(`/api/accounts/${id}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 1 });
  assert.equal(posted.status, 201);

  const same = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ currency: "pln" });
  assert.equal(same.status, 200);
  assert.equal(same.body.currency, "PLN");

  const locked = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ currency: "USD" });
  assert.equal(locked.status, 409);
  assert.match(locked.body.error, /currency/i);
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

test("GET /api/accounts/:id/balance-history returns flat opening and scopes ownership", async () => {
  const { token } = await createUserAndToken();
  const otherToken = await registerAndLogin("balother@test.local", "balother", "password123");
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "BalHist", openingBalance: 250 });
  assert.equal(account.status, 201);
  const accountId = account.body.id as number;

  const empty = await request(app)
    .get(`/api/accounts/${accountId}/balance-history?month=2026-01&months=6`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(empty.status, 200);
  assert.equal(empty.body.accountId, accountId);
  assert.equal(empty.body.currency, "PLN");
  assert.equal(empty.body.monthCount, 6);
  assert.equal(empty.body.series.length, 6);
  assert.equal(empty.body.series[0].month, "2025-08");
  assert.equal(empty.body.series[5].month, "2026-01");
  assert.ok(empty.body.series.every((p: { balance: number }) => p.balance === 250));

  const forbidden = await request(app)
    .get(`/api/accounts/${accountId}/balance-history?month=2026-01`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(forbidden.status, 404);

  const badMonths = await request(app)
    .get(`/api/accounts/${accountId}/balance-history?month=2026-01&months=5`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(badMonths.status, 400);
});

test("GET /api/accounts/:id/balance-history aggregates end-of-month cash balances", async () => {
  const { token } = await createUserAndToken();
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "BalAgg", openingBalance: 100 });
  assert.equal(account.status, 201);
  const accountId = account.body.id as number;

  await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 50, occurredAt: "2025-12-10T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "EXPENSE", amount: 20, occurredAt: "2026-01-15T00:00:00.000Z" });

  const res = await request(app)
    .get(`/api/accounts/${accountId}/balance-history?month=2026-01&months=6`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.monthCount, 6);
  const byMonth = new Map(
    (res.body.series as { month: string; balance: number }[]).map((p) => [p.month, p.balance]),
  );
  assert.equal(byMonth.get("2025-11"), 100);
  assert.equal(byMonth.get("2025-12"), 150);
  assert.equal(byMonth.get("2026-01"), 130);
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

test("POST /api/accounts/:id/transactions stores decimal cents without binary float drift", async () => {
  const { token } = await createUserAndToken();
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Cents", openingBalance: 0 });
  assert.equal(account.status, 201);
  const accountId = account.body.id as number;

  for (const amount of [0.1, 0.2]) {
    const created = await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "INCOME", amount });
    assert.equal(created.status, 201);
  }

  const after = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(JSON.stringify(after.body.cashBalance), "0.3");
  assert.equal(JSON.stringify(after.body.openingBalance), "0");

  const rejected = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 0.001 });
  assert.equal(rejected.status, 400);
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

test("GET /api/accounts/:id/transactions/export returns CSV with auth and ownership", async () => {
  const token = await registerAndLogin("csvuser@test.local", "csvuser", "password123");
  const otherToken = await registerAndLogin(
    "csvother@test.local",
    "csvother",
    "password123",
  );

  const unauth = await request(app).get("/api/accounts/1/transactions/export");
  assert.equal(unauth.status, 401);

  const badId = await request(app)
    .get("/api/accounts/not-a-number/transactions/export")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(badId.status, 400);

  const brokerage = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Broker CSV",
      accountType: "BROKERAGE",
      currency: "EUR",
      openingBalance: 0,
    });
  assert.equal(brokerage.status, 201);
  const accountId = brokerage.body.id as number;

  const empty = await request(app)
    .get(`/api/accounts/${accountId}/transactions/export`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(empty.status, 200);
  assert.match(String(empty.headers["content-type"]), /text\/csv/);
  assert.equal(
    empty.headers["content-disposition"],
    `attachment; filename="account-${accountId}-cash.csv"`,
  );
  assert.equal(
    empty.text,
    "id,type,amount,currency,occurredAt,description,categoryPath,createdAt\n",
  );

  const cats = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(cats.status, 200);
  const salary = (cats.body as Array<{ id: number; name: string }>).find(
    (c) => c.name === "Salary",
  );
  assert.ok(salary);

  await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "INCOME",
      amount: 100.5,
      occurredAt: "2024-06-15T12:00:00.000Z",
      description: "Pay, bonus",
      categoryId: salary!.id,
    });
  await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 10,
      occurredAt: "2024-01-01T00:00:00.000Z",
      description: "=1+1",
    });

  const exported = await request(app)
    .get(`/api/accounts/${accountId}/transactions/export`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(exported.status, 200);
  const lines = exported.text.trimEnd().split("\n");
  assert.equal(
    lines[0],
    "id,type,amount,currency,occurredAt,description,categoryPath,createdAt",
  );
  assert.equal(lines.length, 3);
  assert.match(lines[1]!, /^[0-9]+,EXPENSE,10\.00,EUR,/);
  assert.match(lines[1]!, /,'=1\+1,,/);
  assert.match(lines[2]!, /,INCOME,100\.50,EUR,/);
  assert.match(lines[2]!, /,"Pay, bonus",Salary,/);

  const forbidden = await request(app)
    .get(`/api/accounts/${accountId}/transactions/export`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(forbidden.status, 404);
});

test("POST /api/accounts/:id/transactions/import preview and mapped import", async () => {
  const token = await registerAndLogin(
    "csvimport@test.local",
    "csvimport",
    "password123",
  );
  const otherToken = await registerAndLogin(
    "csvimportother@test.local",
    "csvimportother",
    "password123",
  );

  const unauth = await request(app).post(
    "/api/accounts/1/transactions/import/preview",
  );
  assert.equal(unauth.status, 401);

  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Import Bank",
      accountType: "BANK",
      currency: "PLN",
      openingBalance: 100,
    });
  assert.equal(account.status, 201);
  const accountId = account.body.id as number;

  const cats = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(cats.status, 200);
  const food = (cats.body as Array<{ id: number; name: string }>).find(
    (c) => c.name === "Food",
  );
  assert.ok(food);

  const header =
    "id,type,amount,currency,occurredAt,description,categoryPath,createdAt";
  const csv = [
    header,
    `,INCOME,50.00,PLN,2024-03-01T12:00:00.000Z,Pay,,`,
    `,EXPENSE,20.00,PLN,2024-03-02T12:00:00.000Z,Lunch,Food,`,
    `,EXPENSE,5.00,PLN,2024-03-03T12:00:00.000Z,Shop,Food/Groceries,`,
  ].join("\n");

  const legacy = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: "id,type,amount,currency,occurredAt,description,categoryId,categoryName,createdAt\n",
    });
  assert.equal(legacy.status, 400);
  assert.match(String(legacy.body.error), /re-export/i);

  const preview = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.rowCount, 3);
  assert.equal(preview.body.categories.length, 2);
  const foodPreview = (
    preview.body.categories as Array<{
      path: string;
      suggestedCategoryId: number | null;
    }>
  ).find((c) => c.path === "Food");
  assert.ok(foodPreview);
  assert.equal(foodPreview!.suggestedCategoryId, food!.id);
  const groceriesPreview = (
    preview.body.categories as Array<{
      path: string;
      suggestedCategoryId: number | null;
    }>
  ).find((c) => c.path === "Food/Groceries");
  assert.ok(groceriesPreview);
  assert.equal(groceriesPreview!.suggestedCategoryId, null);

  const missingMap = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv, categoryMappings: [] });
  assert.equal(missingMap.status, 400);
  assert.match(String(missingMap.body.error), /missing mapping/i);

  const foreignMap = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv,
      categoryMappings: [
        { path: "Food", ledgerType: "EXPENSE", action: "map", categoryId: 999999 },
        { path: "Food/Groceries", ledgerType: "EXPENSE", action: "create" },
      ],
    });
  assert.equal(foreignMap.status, 400);
  assert.match(String(foreignMap.body.error), /not found/i);

  const imported = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv,
      categoryMappings: [
        {
          path: "Food",
          ledgerType: "EXPENSE",
          action: "map",
          categoryId: food!.id,
        },
        { path: "Food/Groceries", ledgerType: "EXPENSE", action: "create" },
      ],
    });
  assert.equal(imported.status, 201);
  assert.equal(imported.body.created, 3);
  assert.equal(imported.body.createdCategories, 1);

  const listed = await request(app)
    .get(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.length, 3);
  const lunch = (
    listed.body as Array<{ description: string | null; categoryId: number | null }>
  ).find((t) => t.description === "Lunch");
  assert.equal(lunch!.categoryId, food!.id);

  const catsAfter = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  const groceries = (
    catsAfter.body as Array<{ id: number; name: string; parentId: number | null }>
  ).find((c) => c.name === "Groceries" && c.parentId === food!.id);
  assert.ok(groceries);

  const detail = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.cashBalance, 125);

  const roundTrip = await request(app)
    .get(`/api/accounts/${accountId}/transactions/export`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(roundTrip.status, 200);
  const reimportPreview = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: roundTrip.text });
  assert.equal(reimportPreview.status, 200);
  assert.ok(reimportPreview.body.rowCount >= 3);
  const suggested = (
    reimportPreview.body.categories as Array<{
      path: string;
      ledgerType: string;
      suggestedCategoryId: number | null;
    }>
  ).filter((c) => c.suggestedCategoryId != null);
  assert.ok(suggested.length >= 1);
  const reimported = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: roundTrip.text,
      categoryMappings: (
        reimportPreview.body.categories as Array<{
          path: string;
          ledgerType: string;
          suggestedCategoryId: number | null;
        }>
      ).map((c) =>
        c.suggestedCategoryId != null
          ? {
              path: c.path,
              ledgerType: c.ledgerType,
              action: "map" as const,
              categoryId: c.suggestedCategoryId,
            }
          : {
              path: c.path,
              ledgerType: c.ledgerType,
              action: "none" as const,
            },
      ),
    });
  assert.equal(reimported.status, 201);
  assert.equal(reimported.body.created, reimportPreview.body.rowCount);

  const noCatCsv = `${header}\n,INCOME,10.00,PLN,2024-04-01T12:00:00.000Z,Bonus,,\n`;
  const emptyCats = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: noCatCsv, categoryMappings: [] });
  assert.equal(emptyCats.status, 201);
  assert.equal(emptyCats.body.created, 1);
  assert.equal(emptyCats.body.createdCategories, 0);

  const empty = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: `${header}\n`, categoryMappings: [] });
  assert.equal(empty.status, 201);
  assert.equal(empty.body.created, 0);

  const badCurrency = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: `${header}\n,INCOME,1.00,USD,2024-01-01T00:00:00.000Z,,,\n`,
    });
  assert.equal(badCurrency.status, 400);
  assert.ok(Array.isArray(badCurrency.body.details));

  const forbidden = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ csv: `${header}\n`, categoryMappings: [] });
  assert.equal(forbidden.status, 404);

  const missingCsv = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
  assert.equal(missingCsv.status, 400);

  const emptyCurrency = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: `${header}\n,EXPENSE,1.00,,2024-01-01T00:00:00.000Z,,,\n`,
      categoryMappings: [],
    });
  assert.equal(emptyCurrency.status, 400);
  assert.match(emptyCurrency.body.details[0].message, /currency/);

  const badAmount = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: `${header}\n,EXPENSE,0,PLN,2024-01-01T00:00:00.000Z,,,\n`,
      categoryMappings: [],
    });
  assert.equal(badAmount.status, 400);
  assert.match(badAmount.body.details[0].message, /amount|positive/i);

  const withTransfersCsv = [
    header,
    `,INCOME,10.00,PLN,2024-05-01T12:00:00.000Z,Bonus,,`,
    `,TRANSFER_OUT,3.00,PLN,2024-05-02T12:00:00.000Z,Move,,`,
    `,TRANSFER_IN,3.00,PLN,2024-05-02T12:00:00.000Z,Move,,`,
  ].join("\n");
  const transferPreview = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: withTransfersCsv });
  assert.equal(transferPreview.status, 200);
  assert.equal(transferPreview.body.rowCount, 1);
  assert.equal(transferPreview.body.skipped, 2);
  assert.equal(transferPreview.body.skippedTransfers.length, 2);
  assert.equal(transferPreview.body.skippedTransfers[0].type, "TRANSFER_OUT");

  const transferImport = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: withTransfersCsv, categoryMappings: [] });
  assert.equal(transferImport.status, 201);
  assert.equal(transferImport.body.created, 1);
  assert.equal(transferImport.body.skipped, 2);
  assert.equal(transferImport.body.skippedTransfers.length, 2);
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

test("PATCH /api/accounts/:id/transactions/:txId adjusts cashBalance", async () => {
  const { token } = await createUserAndToken();
  const otherToken = await registerAndLogin("txpatch@test.local", "txpatch", "password123");
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Edit", openingBalance: 100 });
  const accountId = account.body.id as number;

  const expense = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 40,
      occurredAt: "2024-01-31T23:00:00.000Z",
      description: "Old",
    });
  assert.equal(expense.status, 201);
  const txId = expense.body.id as number;

  const empty = await request(app)
    .patch(`/api/accounts/${accountId}/transactions/${txId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
  assert.equal(empty.status, 400);

  const patched = await request(app)
    .patch(`/api/accounts/${accountId}/transactions/${txId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "INCOME",
      amount: 10.5,
      occurredAt: "2024-02-01T00:00:00.000Z",
      description: "New",
    });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.type, "INCOME");
  assert.equal(patched.body.amount, 10.5);
  assert.equal(patched.body.occurredAt, "2024-02-01T00:00:00.000Z");
  assert.equal(patched.body.description, "New");

  const after = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(after.body.cashBalance, 110.5);

  const foreign = await request(app)
    .patch(`/api/accounts/${accountId}/transactions/${txId}`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ description: "Nope" });
  assert.equal(foreign.status, 404);
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

test("account name and description reject oversized text", async () => {
  const { token } = await createUserAndToken();
  const longName = "n".repeat(101);
  const created = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: longName });
  assert.equal(created.status, 400);

  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Ok name" });
  const described = await request(app)
    .patch(`/api/accounts/${account.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ description: "d".repeat(501) });
  assert.equal(described.status, 400);

  const tx = await request(app)
    .post(`/api/accounts/${account.body.id}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 1, description: "d".repeat(501) });
  assert.equal(tx.status, 400);
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
  const tagged = (list.body as Array<{ id: number; categoryId: number | null }>).find(
    (t) => t.id === withCat.body.id,
  );
  assert.equal(tagged?.categoryId, null);
});

test("GET /api/statistics/category-breakdown requires auth and valid month", async () => {
  const noAuth = await request(app).get("/api/statistics/category-breakdown?month=2026-08");
  assert.equal(noAuth.status, 401);

  const token = await registerAndLogin("statsauth@test.local", "statsauth", "password123");

  const missing = await request(app)
    .get("/api/statistics/category-breakdown")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missing.status, 400);

  const badMonth = await request(app)
    .get("/api/statistics/category-breakdown?month=2024-13")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(badMonth.status, 400);

  const shortMonth = await request(app)
    .get("/api/statistics/category-breakdown?month=2024-1")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(shortMonth.status, 400);
});

test("GET /api/statistics/category-breakdown aggregates by category and currency", async () => {
  const token = await registerAndLogin("statsagg@test.local", "statsagg", "password123");
  const otherToken = await registerAndLogin("statsother@test.local", "statsother", "password123");

  const cats = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  const salary = (cats.body as Array<{ id: number; name: string }>).find((c) => c.name === "Salary")!;
  const food = (cats.body as Array<{ id: number; name: string }>).find((c) => c.name === "Food")!;
  assert.ok(salary);
  assert.ok(food);

  const plnA = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "PLN-A", currency: "PLN", openingBalance: 0 });
  const plnB = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "PLN-B", currency: "PLN", openingBalance: 0 });
  const eur = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "EUR-A", currency: "EUR", openingBalance: 0 });
  const otherAccount = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ name: "Other", currency: "PLN", openingBalance: 0 });

  const plnAId = plnA.body.id as number;
  const plnBId = plnB.body.id as number;
  const eurId = eur.body.id as number;
  const otherId = otherAccount.body.id as number;

  await request(app)
    .post(`/api/accounts/${plnAId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "INCOME",
      amount: 3000,
      categoryId: salary.id,
      occurredAt: "2026-08-01T00:00:00.000Z",
    });
  await request(app)
    .post(`/api/accounts/${plnBId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "INCOME",
      amount: 2000,
      categoryId: salary.id,
      occurredAt: "2026-08-15T12:00:00.000Z",
    });
  await request(app)
    .post(`/api/accounts/${plnAId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 40,
      categoryId: food.id,
      occurredAt: "2026-08-10T00:00:00.000Z",
    });
  await request(app)
    .post(`/api/accounts/${plnAId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 12.5,
      occurredAt: "2026-08-20T00:00:00.000Z",
    });
  await request(app)
    .post(`/api/accounts/${eurId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 25,
      categoryId: food.id,
      occurredAt: "2026-08-11T00:00:00.000Z",
    });
  // Outside month (next month start) — excluded
  await request(app)
    .post(`/api/accounts/${plnAId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 999,
      categoryId: food.id,
      occurredAt: "2026-09-01T00:00:00.000Z",
    });
  // Other user — excluded
  await request(app)
    .post(`/api/accounts/${otherId}/transactions`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({
      type: "EXPENSE",
      amount: 50,
      occurredAt: "2026-08-05T00:00:00.000Z",
    });

  const res = await request(app)
    .get("/api/statistics/category-breakdown?month=2026-08")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.month, "2026-08");
  assert.ok(Array.isArray(res.body.income));
  assert.ok(Array.isArray(res.body.expense));

  assert.equal(res.body.income.length, 1);
  assert.equal(res.body.income[0].categoryId, salary.id);
  assert.equal(res.body.income[0].categoryName, "Salary");
  assert.equal(res.body.income[0].currency, "PLN");
  assert.equal(res.body.income[0].total, 5000);
  assert.equal(res.body.income[0].count, 2);

  assert.equal(res.body.expense.length, 3);
  const foodPln = res.body.expense.find(
    (r: { categoryId: number | null; currency: string }) =>
      r.categoryId === food.id && r.currency === "PLN",
  );
  const foodEur = res.body.expense.find(
    (r: { categoryId: number | null; currency: string }) =>
      r.categoryId === food.id && r.currency === "EUR",
  );
  const uncat = res.body.expense.find(
    (r: { categoryId: number | null; categoryName: string }) =>
      r.categoryId === null && r.categoryName === "Uncategorized",
  );
  assert.ok(foodPln);
  assert.equal(foodPln.total, 40);
  assert.equal(foodPln.count, 1);
  assert.ok(foodEur);
  assert.equal(foodEur.total, 25);
  assert.ok(uncat);
  assert.equal(uncat.total, 12.5);
  assert.equal(uncat.currency, "PLN");

  // Sorted by total desc: Food PLN 40, Food EUR 25, Uncategorized 12.5
  assert.equal(res.body.expense[0].total, 40);
  assert.equal(res.body.expense[1].total, 25);
  assert.equal(res.body.expense[2].total, 12.5);

  const empty = await request(app)
    .get("/api/statistics/category-breakdown?month=2025-01")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.income, []);
  assert.deepEqual(empty.body.expense, []);
});

test("GET /api/statistics/period-summary requires auth and valid params", async () => {
  const noAuth = await request(app).get(
    "/api/statistics/period-summary?month=2026-08&currency=PLN",
  );
  assert.equal(noAuth.status, 401);

  const token = await registerAndLogin("sumauth@test.local", "sumauth", "password123");

  const missingMonth = await request(app)
    .get("/api/statistics/period-summary?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missingMonth.status, 400);

  const missingCurrency = await request(app)
    .get("/api/statistics/period-summary?month=2026-08")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missingCurrency.status, 400);

  const badCurrency = await request(app)
    .get("/api/statistics/period-summary?month=2026-08&currency=US")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(badCurrency.status, 400);
});

test("GET /api/statistics/period-summary aggregates one currency with tenancy", async () => {
  const token = await registerAndLogin("sumagg@test.local", "sumagg", "password123");
  const otherToken = await registerAndLogin("sumother@test.local", "sumother", "password123");

  const pln = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Sum PLN", currency: "PLN", openingBalance: 0 });
  const eur = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Sum EUR", currency: "EUR", openingBalance: 0 });
  const otherAccount = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ name: "Other Sum", currency: "PLN", openingBalance: 0 });

  const plnId = pln.body.id as number;
  const eurId = eur.body.id as number;
  const otherId = otherAccount.body.id as number;

  await request(app)
    .post(`/api/accounts/${plnId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 3000, occurredAt: "2026-08-05T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${plnId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "EXPENSE", amount: 400, occurredAt: "2026-08-10T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${eurId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "EXPENSE", amount: 50, occurredAt: "2026-08-11T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${otherId}/transactions`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ type: "EXPENSE", amount: 99, occurredAt: "2026-08-08T00:00:00.000Z" });

  const res = await request(app)
    .get("/api/statistics/period-summary?month=2026-08&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    month: "2026-08",
    currency: "PLN",
    income: 3000,
    expense: 400,
    net: 2600,
  });

  const unknownCcy = await request(app)
    .get("/api/statistics/period-summary?month=2026-08&currency=USD")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(unknownCcy.status, 200);
  assert.deepEqual(unknownCcy.body, {
    month: "2026-08",
    currency: "USD",
    income: 0,
    expense: 0,
    net: 0,
  });
});

test("GET /api/statistics/cashflow-history validates months and defaults to 12", async () => {
  const token = await registerAndLogin("histauth@test.local", "histauth", "password123");

  const badMonths = await request(app)
    .get("/api/statistics/cashflow-history?month=2026-01&currency=PLN&months=5")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(badMonths.status, 400);

  const missingCurrency = await request(app)
    .get("/api/statistics/cashflow-history?month=2026-01")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missingCurrency.status, 400);

  const def = await request(app)
    .get("/api/statistics/cashflow-history?month=2026-01&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(def.status, 200);
  assert.equal(def.body.monthCount, 12);
  assert.equal(def.body.series.length, 12);
  assert.equal(def.body.series[0].month, "2025-02");
  assert.equal(def.body.series[11].month, "2026-01");
  assert.ok(def.body.series.every((p: { income: number; expense: number; net: number }) =>
    p.income === 0 && p.expense === 0 && p.net === 0));
});

test("GET /api/statistics/cashflow-history aggregates series with year span and tenancy", async () => {
  const token = await registerAndLogin("histagg@test.local", "histagg", "password123");
  const otherToken = await registerAndLogin("histother@test.local", "histother", "password123");

  const pln = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Hist PLN", currency: "PLN", openingBalance: 0 });
  const otherAccount = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ name: "Hist Other", currency: "PLN", openingBalance: 0 });

  const plnId = pln.body.id as number;
  const otherId = otherAccount.body.id as number;

  await request(app)
    .post(`/api/accounts/${plnId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 1000, occurredAt: "2025-12-15T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${plnId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "EXPENSE", amount: 200, occurredAt: "2026-01-10T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${otherId}/transactions`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ type: "INCOME", amount: 500, occurredAt: "2026-01-05T00:00:00.000Z" });

  const res = await request(app)
    .get("/api/statistics/cashflow-history?month=2026-01&currency=PLN&months=6")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.currency, "PLN");
  assert.equal(res.body.monthCount, 6);
  assert.equal(res.body.series.length, 6);
  assert.equal(res.body.series[0].month, "2025-08");
  assert.equal(res.body.series[5].month, "2026-01");

  const dec = res.body.series.find((p: { month: string }) => p.month === "2025-12");
  const jan = res.body.series.find((p: { month: string }) => p.month === "2026-01");
  assert.deepEqual(dec, { month: "2025-12", income: 1000, expense: 0, net: 1000 });
  assert.deepEqual(jan, { month: "2026-01", income: 0, expense: 200, net: -200 });
});

test("GET /api/statistics/net-worth requires auth and valid currency", async () => {
  const noAuth = await request(app).get("/api/statistics/net-worth?currency=PLN");
  assert.equal(noAuth.status, 401);

  const token = await registerAndLogin("nwauth@test.local", "nwauth", "password123");

  const missing = await request(app)
    .get("/api/statistics/net-worth")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missing.status, 400);

  const bad = await request(app)
    .get("/api/statistics/net-worth?currency=US")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(bad.status, 400);
});

test("GET /api/statistics/net-worth aggregates cashBalance by bucket with tenancy", async () => {
  const token = await registerAndLogin("nwagg@test.local", "nwagg", "password123");
  const otherToken = await registerAndLogin("nwother@test.local", "nwother", "password123");

  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "NW Bank",
      currency: "PLN",
      accountType: "BANK",
      openingBalance: 1000,
    });
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "NW Broker",
      currency: "PLN",
      accountType: "BROKERAGE",
      openingBalance: 2500,
    });
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "NW Crypto",
      currency: "USD",
      accountType: "CRYPTO",
      openingBalance: 400,
    });
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${otherToken}`)
    .send({
      name: "Other NW",
      currency: "PLN",
      accountType: "BANK",
      openingBalance: 9999,
    });

  const res = await request(app)
    .get("/api/statistics/net-worth?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    currency: "PLN",
    byBucket: {
      cash: 1000,
      stock: 2500,
      crypto: 0,
      metal: 0,
      real_estate: 0,
      other: 0,
    },
    liabilities: 0,
    netWorth: 3500,
  });

  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "NW Card",
      currency: "PLN",
      accountType: "CREDIT_CARD",
      openingBalance: -100,
    });
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "NW IKE",
      currency: "PLN",
      accountType: "IKE",
      openingBalance: 400,
    });

  const withCard = await request(app)
    .get("/api/statistics/net-worth?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(withCard.status, 200);
  assert.equal(withCard.body.liabilities, 100);
  assert.equal(withCard.body.byBucket.stock, 2900);
  assert.equal(withCard.body.netWorth, 3500 + 400 - 100);

  const unknown = await request(app)
    .get("/api/statistics/net-worth?currency=EUR")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(unknown.status, 200);
  assert.equal(unknown.body.netWorth, 0);
  assert.equal(unknown.body.liabilities, 0);
});

test("GET /api/statistics/cashflow-rolling-12m requires auth and valid currency", async () => {
  const noAuth = await request(app).get(
    "/api/statistics/cashflow-rolling-12m?currency=PLN",
  );
  assert.equal(noAuth.status, 401);

  const token = await registerAndLogin("rollauth@test.local", "rollauth", "password123");

  const missing = await request(app)
    .get("/api/statistics/cashflow-rolling-12m")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missing.status, 400);

  const bad = await request(app)
    .get("/api/statistics/cashflow-rolling-12m?currency=pl")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(bad.status, 400);

  const empty = await request(app)
    .get("/api/statistics/cashflow-rolling-12m?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(empty.status, 200);
  assert.equal(empty.body.currency, "PLN");
  assert.equal(empty.body.monthCount, 12);
  assert.ok(typeof empty.body.fromMonth === "string");
  assert.ok(typeof empty.body.toMonth === "string");
  assert.equal(empty.body.avgIncome, 0);
  assert.equal(empty.body.avgExpense, 0);
  assert.equal(empty.body.avgNet, 0);
});

test("POST /api/transfers same currency updates both balances", async () => {
  const token = await registerAndLogin("xfer@test.local", "xferuser", "password123");
  const from = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "From PLN", currency: "PLN", openingBalance: 1000 });
  const to = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "To PLN", currency: "PLN", openingBalance: 100 });
  const fromId = from.body.id as number;
  const toId = to.body.id as number;

  const created = await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: fromId,
      toAccountId: toId,
      amountFrom: 250,
      occurredAt: "2026-08-15T12:00:00.000Z",
      description: "move",
    });
  assert.equal(created.status, 201);
  assert.equal(created.body.amountFrom, 250);
  assert.equal(created.body.amountTo, 250);
  assert.equal(created.body.fromCurrency, "PLN");
  assert.equal(created.body.toCurrency, "PLN");
  assert.equal(created.body.fxRate, 1);
  assert.equal(created.body.description, "move");

  const fromAfter = await request(app)
    .get(`/api/accounts/${fromId}`)
    .set("Authorization", `Bearer ${token}`);
  const toAfter = await request(app)
    .get(`/api/accounts/${toId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(fromAfter.body.cashBalance, 750);
  assert.equal(toAfter.body.cashBalance, 350);

  const fromTx = await request(app)
    .get(`/api/accounts/${fromId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  const toTx = await request(app)
    .get(`/api/accounts/${toId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(fromTx.body.length, 1);
  assert.equal(fromTx.body[0].type, "TRANSFER_OUT");
  assert.equal(fromTx.body[0].transferId, created.body.id);
  assert.equal(toTx.body[0].type, "TRANSFER_IN");
  assert.equal(toTx.body[0].transferId, created.body.id);
});

test("POST /api/transfers cross currency requires amountTo and returns fxRate", async () => {
  const token = await registerAndLogin("xferfx@test.local", "xferfx", "password123");
  const from = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "PLN", currency: "PLN", openingBalance: 1000 });
  const to = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "EUR", currency: "EUR", openingBalance: 0 });

  const missing = await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: from.body.id,
      toAccountId: to.body.id,
      amountFrom: 400,
    });
  assert.equal(missing.status, 400);

  const created = await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: from.body.id,
      toAccountId: to.body.id,
      amountFrom: 400,
      amountTo: 100,
      occurredAt: "2026-08-01T00:00:00.000Z",
    });
  assert.equal(created.status, 201);
  assert.equal(created.body.amountFrom, 400);
  assert.equal(created.body.amountTo, 100);
  assert.equal(created.body.fxRate, 0.25);
});

test("POST /api/transfers rejects same account and foreign account", async () => {
  const token = await registerAndLogin("xferbad@test.local", "xferbad", "password123");
  const other = await registerAndLogin("xferoth@test.local", "xferoth", "password123");
  const mine = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Mine", currency: "PLN", openingBalance: 100 });
  const theirs = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${other}`)
    .send({ name: "Theirs", currency: "PLN", openingBalance: 100 });

  const same = await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: mine.body.id,
      toAccountId: mine.body.id,
      amountFrom: 10,
    });
  assert.equal(same.status, 400);

  const foreign = await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: mine.body.id,
      toAccountId: theirs.body.id,
      amountFrom: 10,
    });
  assert.equal(foreign.status, 404);
});

test("PATCH/DELETE /api/transfers adjust balances; leg endpoints reject edits", async () => {
  const token = await registerAndLogin("xferupd@test.local", "xferupd", "password123");
  const a = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "A", currency: "PLN", openingBalance: 1000 });
  const b = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "B", currency: "PLN", openingBalance: 0 });
  const c = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "C", currency: "PLN", openingBalance: 50 });
  const aId = a.body.id as number;
  const bId = b.body.id as number;
  const cId = c.body.id as number;

  const created = await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({ fromAccountId: aId, toAccountId: bId, amountFrom: 200 });
  assert.equal(created.status, 201);
  const transferId = created.body.id as number;

  const legsA = await request(app)
    .get(`/api/accounts/${aId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  const legId = legsA.body[0].id as number;

  const patchLeg = await request(app)
    .patch(`/api/accounts/${aId}/transactions/${legId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: 1 });
  assert.equal(patchLeg.status, 400);
  assert.match(String(patchLeg.body.error), /\/api\/transfers/);

  const deleteLeg = await request(app)
    .delete(`/api/accounts/${aId}/transactions/${legId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleteLeg.status, 400);

  const patched = await request(app)
    .patch(`/api/transfers/${transferId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amountFrom: 300, toAccountId: cId });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.amountFrom, 300);
  assert.equal(patched.body.toAccountId, cId);

  const aAfter = await request(app)
    .get(`/api/accounts/${aId}`)
    .set("Authorization", `Bearer ${token}`);
  const bAfter = await request(app)
    .get(`/api/accounts/${bId}`)
    .set("Authorization", `Bearer ${token}`);
  const cAfter = await request(app)
    .get(`/api/accounts/${cId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(aAfter.body.cashBalance, 700);
  assert.equal(bAfter.body.cashBalance, 0);
  assert.equal(cAfter.body.cashBalance, 350);

  const deleted = await request(app)
    .delete(`/api/transfers/${transferId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleted.status, 204);

  const aFinal = await request(app)
    .get(`/api/accounts/${aId}`)
    .set("Authorization", `Bearer ${token}`);
  const cFinal = await request(app)
    .get(`/api/accounts/${cId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(aFinal.body.cashBalance, 1000);
  assert.equal(cFinal.body.cashBalance, 50);
});

test("transfers are excluded from cashflow stats and included in balance-history", async () => {
  const token = await registerAndLogin("xferstat@test.local", "xferstat", "password123");
  const from = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Stat From", currency: "PLN", openingBalance: 500 });
  const to = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Stat To", currency: "PLN", openingBalance: 0 });
  const fromId = from.body.id as number;
  const toId = to.body.id as number;

  await request(app)
    .post(`/api/accounts/${fromId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 100, occurredAt: "2026-08-05T00:00:00.000Z" });
  await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: fromId,
      toAccountId: toId,
      amountFrom: 200,
      occurredAt: "2026-08-10T00:00:00.000Z",
    });

  const summary = await request(app)
    .get("/api/statistics/period-summary?month=2026-08&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(summary.status, 200);
  assert.equal(summary.body.income, 100);
  assert.equal(summary.body.expense, 0);
  assert.equal(summary.body.net, 100);

  const breakdown = await request(app)
    .get("/api/statistics/category-breakdown?month=2026-08")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(breakdown.status, 200);
  assert.equal(breakdown.body.income.length, 1);
  assert.equal(breakdown.body.income[0].total, 100);
  assert.equal(breakdown.body.expense.length, 0);

  const history = await request(app)
    .get(`/api/accounts/${fromId}/balance-history?month=2026-08&months=6`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(history.status, 200);
  const aug = history.body.series.find((p: { month: string }) => p.month === "2026-08");
  // opening 500 + income 100 - transfer out 200
  assert.equal(aug.balance, 400);
});

test("DELETE /api/accounts/:id returns 409 when account has transfers", async () => {
  const token = await registerAndLogin("xferdel@test.local", "xferdel", "password123");
  const from = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Del From", currency: "PLN", openingBalance: 100 });
  const to = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Del To", currency: "PLN", openingBalance: 0 });

  await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: from.body.id,
      toAccountId: to.body.id,
      amountFrom: 25,
    });

  const del = await request(app)
    .delete(`/api/accounts/${from.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(del.status, 409);
  assert.match(String(del.body.error), /delete transfers first/i);
});

test("GET/POST /api/transfers export import preview with account mapping", async () => {
  const tokenA = await registerAndLogin(
    "xfercsv-a@test.local",
    "xfercsva",
    "password123",
  );
  const tokenB = await registerAndLogin(
    "xfercsv-b@test.local",
    "xfercsvb",
    "password123",
  );

  const unauth = await request(app).get("/api/transfers/export");
  assert.equal(unauth.status, 401);

  const aFrom = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ name: "Alpha Checking", currency: "PLN", openingBalance: 1000 });
  const aTo = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ name: "Alpha Brokerage", currency: "PLN", openingBalance: 100 });
  const aEuro = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ name: "Alpha Euro", currency: "EUR", openingBalance: 50 });

  await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      fromAccountId: aFrom.body.id,
      toAccountId: aTo.body.id,
      amountFrom: 200,
      occurredAt: "2024-05-01T12:00:00.000Z",
      description: "invest",
    });
  await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      fromAccountId: aFrom.body.id,
      toAccountId: aEuro.body.id,
      amountFrom: 400,
      amountTo: 90,
      occurredAt: "2024-05-02T12:00:00.000Z",
      description: "travel",
    });

  const exported = await request(app)
    .get("/api/transfers/export")
    .set("Authorization", `Bearer ${tokenA}`);
  assert.equal(exported.status, 200);
  assert.match(String(exported.headers["content-type"]), /text\/csv/);
  const lines = exported.text.trimEnd().split("\n");
  assert.equal(
    lines[0],
    "id,occurredAt,fromAccount,fromCurrency,toAccount,toCurrency,amountFrom,amountTo,description,createdAt",
  );
  assert.equal(lines.length, 3);
  assert.match(lines[1]!, /Alpha Checking,PLN,Alpha Brokerage,PLN,200\.00,200\.00/);
  assert.match(lines[2]!, /Alpha Checking,PLN,Alpha Euro,EUR,400\.00,90\.00/);

  const otherExport = await request(app)
    .get("/api/transfers/export")
    .set("Authorization", `Bearer ${tokenB}`);
  assert.equal(otherExport.status, 200);
  assert.equal(
    otherExport.text,
    "id,occurredAt,fromAccount,fromCurrency,toAccount,toCurrency,amountFrom,amountTo,description,createdAt\n",
  );

  const previewBare = await request(app)
    .post("/api/transfers/import/preview")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ csv: exported.text });
  assert.equal(previewBare.status, 200);
  assert.equal(previewBare.body.rowCount, 2);
  assert.equal(previewBare.body.accounts.length, 3);
  assert.ok(previewBare.body.rows === undefined);
  assert.ok(
    (previewBare.body.accounts as Array<{ suggestedAccountId: number | null }>).every(
      (a) => a.suggestedAccountId == null,
    ),
  );

  const bFrom = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ name: "Beta Cash", currency: "PLN", openingBalance: 1000 });
  const bTo = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ name: "Beta Invest", currency: "PLN", openingBalance: 100 });
  const bEuro = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ name: "Beta Euro", currency: "EUR", openingBalance: 50 });

  const mappings = [
    { name: "Alpha Checking", currency: "PLN", accountId: bFrom.body.id },
    { name: "Alpha Brokerage", currency: "PLN", accountId: bTo.body.id },
    { name: "Alpha Euro", currency: "EUR", accountId: bEuro.body.id },
  ];

  const missingMap = await request(app)
    .post("/api/transfers/import")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ csv: exported.text, accountMappings: [] });
  assert.equal(missingMap.status, 400);
  assert.match(String(missingMap.body.error), /missing mapping/i);

  const badCurrency = await request(app)
    .post("/api/transfers/import")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({
      csv: exported.text,
      accountMappings: [
        { name: "Alpha Checking", currency: "PLN", accountId: bEuro.body.id },
        { name: "Alpha Brokerage", currency: "PLN", accountId: bTo.body.id },
        { name: "Alpha Euro", currency: "EUR", accountId: bEuro.body.id },
      ],
    });
  assert.equal(badCurrency.status, 400);
  assert.match(String(badCurrency.body.error), /currency/i);

  const foreignMap = await request(app)
    .post("/api/transfers/import")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({
      csv: exported.text,
      accountMappings: [
        { name: "Alpha Checking", currency: "PLN", accountId: aFrom.body.id },
        { name: "Alpha Brokerage", currency: "PLN", accountId: bTo.body.id },
        { name: "Alpha Euro", currency: "EUR", accountId: bEuro.body.id },
      ],
    });
  assert.equal(foreignMap.status, 400);
  assert.match(String(foreignMap.body.error), /not found/i);

  const previewMapped = await request(app)
    .post("/api/transfers/import/preview")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ csv: exported.text, accountMappings: mappings });
  assert.equal(previewMapped.status, 200);
  assert.equal(previewMapped.body.rows.length, 2);
  assert.ok(
    (previewMapped.body.rows as Array<{ duplicate: boolean }>).every(
      (r) => r.duplicate === false,
    ),
  );

  const imported = await request(app)
    .post("/api/transfers/import")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ csv: exported.text, accountMappings: mappings });
  assert.equal(imported.status, 201);
  assert.equal(imported.body.created, 2);
  assert.equal(imported.body.skipped, 0);

  const bFromAfter = await request(app)
    .get(`/api/accounts/${bFrom.body.id}`)
    .set("Authorization", `Bearer ${tokenB}`);
  const bToAfter = await request(app)
    .get(`/api/accounts/${bTo.body.id}`)
    .set("Authorization", `Bearer ${tokenB}`);
  const bEuroAfter = await request(app)
    .get(`/api/accounts/${bEuro.body.id}`)
    .set("Authorization", `Bearer ${tokenB}`);
  assert.equal(bFromAfter.body.cashBalance, 400);
  assert.equal(bToAfter.body.cashBalance, 300);
  assert.equal(bEuroAfter.body.cashBalance, 140);

  const legs = await request(app)
    .get(`/api/accounts/${bFrom.body.id}/transactions`)
    .set("Authorization", `Bearer ${tokenB}`);
  assert.ok(
    (legs.body as Array<{ type: string }>).some((t) => t.type === "TRANSFER_OUT"),
  );

  const rePreview = await request(app)
    .post("/api/transfers/import/preview")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ csv: exported.text, accountMappings: mappings });
  assert.equal(rePreview.status, 200);
  assert.ok(
    (rePreview.body.rows as Array<{ duplicate: boolean }>).every(
      (r) => r.duplicate === true,
    ),
  );

  const skipAll = (rePreview.body.rows as Array<{ row: number }>).map((r) => r.row);
  const skippedImport = await request(app)
    .post("/api/transfers/import")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({
      csv: exported.text,
      accountMappings: mappings,
      skipRows: skipAll,
    });
  assert.equal(skippedImport.status, 201);
  assert.equal(skippedImport.body.created, 0);
  assert.equal(skippedImport.body.skipped, 2);

  const balAfterSkip = await request(app)
    .get(`/api/accounts/${bFrom.body.id}`)
    .set("Authorization", `Bearer ${tokenB}`);
  assert.equal(balAfterSkip.body.cashBalance, 400);

  const recreated = await request(app)
    .post("/api/transfers/import")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ csv: exported.text, accountMappings: mappings });
  assert.equal(recreated.status, 201);
  assert.equal(recreated.body.created, 2);
  const balAfterRecreate = await request(app)
    .get(`/api/accounts/${bFrom.body.id}`)
    .set("Authorization", `Bearer ${tokenB}`);
  assert.equal(balAfterRecreate.body.cashBalance, -200);

  const header =
    "id,occurredAt,fromAccount,fromCurrency,toAccount,toCurrency,amountFrom,amountTo,description,createdAt";
  const atomicCsv = [
    header,
    ",2024-06-01T12:00:00.000Z,Alpha Checking,PLN,Alpha Brokerage,PLN,10.00,10.00,ok,",
    ",2024-06-02T12:00:00.000Z,Alpha Checking,PLN,Alpha Brokerage,PLN,10.00,9.00,bad,",
  ].join("\n");
  const beforeAtomic = await request(app)
    .get(`/api/accounts/${bFrom.body.id}`)
    .set("Authorization", `Bearer ${tokenB}`);
  const atomic = await request(app)
    .post("/api/transfers/import")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({
      csv: atomicCsv,
      accountMappings: [
        { name: "Alpha Checking", currency: "PLN", accountId: bFrom.body.id },
        { name: "Alpha Brokerage", currency: "PLN", accountId: bTo.body.id },
      ],
    });
  assert.equal(atomic.status, 400);
  const afterAtomic = await request(app)
    .get(`/api/accounts/${bFrom.body.id}`)
    .set("Authorization", `Bearer ${tokenB}`);
  assert.equal(afterAtomic.body.cashBalance, beforeAtomic.body.cashBalance);
});
