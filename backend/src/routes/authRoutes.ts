import { Router } from "express";
import type { PrismaClient, User } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import { isRegisterAllowed } from "../authConfig";
import { ensureDefaultCategories } from "../categories";
import { handleRouteError, forbidden } from "./httpSupport";

type AuthDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  normalizeEmail: (value: unknown) => string;
  validatePassword: (value: unknown) => string | null;
  validateUsername: (value: unknown) => string | null;
  parseLoginIdentifier: (body: { login?: unknown; email?: unknown }) => string;
  hashPassword: (password: string) => Promise<string>;
  verifyPassword: (password: string, hash: string) => Promise<boolean>;
  signToken: (userId: number) => string;
};

function userPayload(user: User) {
  return { id: user.id, email: user.email, username: user.username };
}

async function findUserByLogin(
  prisma: PrismaClient,
  identifier: string,
  normalizeEmail: (value: unknown) => string,
): Promise<User | null> {
  if (!identifier) return null;
  if (identifier.includes("@")) {
    return prisma.user.findUnique({ where: { email: normalizeEmail(identifier) } });
  }
  const exact = await prisma.user.findUnique({ where: { username: identifier } });
  if (exact) return exact;
  const rows = await prisma.$queryRaw<User[]>`
    SELECT "id", "email", "username", "passwordHash", "createdAt"
    FROM "User"
    WHERE lower("username") = lower(${identifier})
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export function createAuthRouter(deps: AuthDeps): Router {
  const router = Router();
  const {
    prisma,
    requireAuth,
    uid,
    normalizeEmail,
    validatePassword,
    validateUsername,
    parseLoginIdentifier,
    hashPassword,
    verifyPassword,
    signToken,
  } = deps;

  router.get("/api/auth/config", (_req, res) => {
    res.json({ allowRegister: isRegisterAllowed() });
  });

  router.post("/api/auth/register", async (req, res) => {
    if (!isRegisterAllowed()) {
      handleRouteError(res, forbidden("Registration is disabled"), "Registration failed");
      return;
    }
    try {
      const email = normalizeEmail(req.body?.email);
      const username = String(req.body?.username ?? "").trim();
      const password = String(req.body?.password ?? "");
      if (!email || !username) return res.status(400).json({ error: "Email and username required" });
      const userErr = validateUsername(username);
      if (userErr) return res.status(400).json({ error: userErr });
      const pwdErr = validatePassword(password);
      if (pwdErr) return res.status(400).json({ error: pwdErr });
      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({ data: { email, username, passwordHash } });
      await ensureDefaultCategories(prisma, user.id);
      const token = signToken(user.id);
      res.status(201).json({ token, user: userPayload(user) });
    } catch (e: unknown) {
      handleRouteError(res, e, "Registration failed");
    }
  });

  router.post("/api/auth/login", async (req, res) => {
    const identifier = parseLoginIdentifier(req.body ?? {});
    const password = String(req.body?.password ?? "");
    if (!identifier) return res.status(400).json({ error: "Email or username required" });
    const user = await findUserByLogin(prisma, identifier, normalizeEmail);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = signToken(user.id);
    res.json({ token, user: userPayload(user) });
  });

  router.get("/api/auth/me", requireAuth, async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: uid(req) } });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(userPayload(user));
  });

  router.patch("/api/auth/profile", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const username = String(req.body?.username ?? "").trim();
      const userErr = validateUsername(username);
      if (userErr) return res.status(400).json({ error: userErr });
      const user = await prisma.user.update({
        where: { id: uid(req) },
        data: { username },
      });
      res.json(userPayload(user));
    } catch (e: unknown) {
      handleRouteError(res, e, "Profile update failed");
    }
  });

  router.patch("/api/auth/password", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const currentPassword = String(req.body?.currentPassword ?? "");
      const newPassword = String(req.body?.newPassword ?? "");
      const pwdErr = validatePassword(newPassword);
      if (pwdErr) return res.status(400).json({ error: pwdErr });
      const user = await prisma.user.findUnique({ where: { id: uid(req) } });
      if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      const passwordHash = await hashPassword(newPassword);
      const updated = await prisma.user.update({
        where: { id: uid(req) },
        data: { passwordHash },
      });
      res.json(userPayload(updated));
    } catch (e: unknown) {
      handleRouteError(res, e, "Password update failed");
    }
  });

  router.patch("/api/auth/email", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const currentPassword = String(req.body?.currentPassword ?? "");
      if (!email) return res.status(400).json({ error: "Email required" });
      const user = await prisma.user.findUnique({ where: { id: uid(req) } });
      if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      const updated = await prisma.user.update({
        where: { id: uid(req) },
        data: { email },
      });
      res.json(userPayload(updated));
    } catch (e: unknown) {
      handleRouteError(res, e, "Email update failed");
    }
  });

  return router;
}
