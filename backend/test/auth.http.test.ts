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

test("POST /api/auth/register creates user without default categories or tags", async () => {
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
  assert.equal(cats.body.length, 0);

  const tags = await request(app)
    .get("/api/tags")
    .set("Authorization", `Bearer ${res.body.token}`);
  assert.equal(tags.status, 200);
  assert.equal(tags.body.length, 0);
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

