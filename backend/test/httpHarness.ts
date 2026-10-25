import assert from "node:assert/strict";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { canonicalUsernameKey, hashPassword, normalizeEmail } from "../src/auth";
import { seedDefaultCategories } from "../src/domain/categories";
import {
  createTestPrisma,
  disconnectTestPrisma,
  resetDatabase,
} from "./prismaTestClient";

const JWT_SECRET = "test-jwt-secret-must-be-at-least-32-characters";

export type HttpSuite = {
  prisma: PrismaClient;
  app: Express;
};

export async function startHttpSuite(): Promise<HttpSuite> {
  process.env.JWT_SECRET = JWT_SECRET;
  const prisma = await createTestPrisma();
  const mod = await import("../src/app");
  return { prisma, app: mod.app };
}

export async function stopHttpSuite(suite: HttpSuite): Promise<void> {
  await disconnectTestPrisma(suite.prisma);
}

export async function resetHttpSuite(suite: HttpSuite): Promise<void> {
  await resetDatabase(suite.prisma);
}

export async function createUserAndToken(
  suite: HttpSuite,
): Promise<{ token: string; userId: number }> {
  const passwordHash = await hashPassword("testpass123");
  const user = await suite.prisma.user.create({
    data: {
      email: "http@test.local",
      username: "httpuser",
      usernameKey: canonicalUsernameKey("httpuser"),
      passwordHash,
    },
  });
  const res = await request(suite.app)
    .post("/api/auth/login")
    .send({ email: "http@test.local", password: "testpass123" });
  assert.equal(res.status, 200);
  return { token: res.body.token, userId: user.id };
}

export async function registerAndLogin(
  suite: HttpSuite,
  email: string,
  username: string,
  password: string,
): Promise<string> {
  const reg = await request(suite.app)
    .post("/api/auth/register")
    .send({ email, username, password });
  assert.equal(reg.status, 201);
  const user = await suite.prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });
  assert.ok(user);
  await seedDefaultCategories(suite.prisma, user.id);
  return reg.body.token as string;
}

export function noneDescriptionMappings(
  suggestions: Array<{ descriptionKey: string; ledgerType: string }>,
) {
  return suggestions.map((s) => ({
    descriptionKey: s.descriptionKey,
    ledgerType: s.ledgerType,
    action: "none" as const,
  }));
}
