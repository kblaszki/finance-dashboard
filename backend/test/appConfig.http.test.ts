import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import {
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

async function registerAndLogin(
  email: string,
  username: string,
  password: string,
): Promise<string> {
  return registerAndLoginHarness(suite, email, username, password);
}

test("GET/PATCH /api/app-config requires auth and toggles marketLiveApi", async () => {
  const noAuth = await request(app).get("/api/app-config");
  assert.equal(noAuth.status, 401);

  const token = await registerAndLogin(
    "cfg@test.local",
    "cfguser",
    "password123",
  );

  const initial = await request(app)
    .get("/api/app-config")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(initial.status, 200);
  assert.equal(initial.body.marketLiveApi, false);

  const bad = await request(app)
    .patch("/api/app-config")
    .set("Authorization", `Bearer ${token}`)
    .send({ marketLiveApi: "yes" });
  assert.equal(bad.status, 400);

  const on = await request(app)
    .patch("/api/app-config")
    .set("Authorization", `Bearer ${token}`)
    .send({ marketLiveApi: true });
  assert.equal(on.status, 200);
  assert.equal(on.body.marketLiveApi, true);

  const off = await request(app)
    .patch("/api/app-config")
    .set("Authorization", `Bearer ${token}`)
    .send({ marketLiveApi: false });
  assert.equal(off.status, 200);
  assert.equal(off.body.marketLiveApi, false);

  const row = await prisma.appConfig.findUnique({
    where: { key: "marketLiveApi" },
  });
  assert.equal(row?.value, "false");
});
