import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import { isRegisterAllowed } from "../authConfig";
import { handleRouteError, parseRequiredString, forbidden } from "./httpSupport";

type AuthDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  normalizeEmail: (value: unknown) => string;
  validatePassword: (value: unknown) => string | null;
  hashPassword: (password: string) => Promise<string>;
  verifyPassword: (password: string, hash: string) => Promise<boolean>;
  signToken: (userId: number) => string;
};

export function createAuthRouter(deps: AuthDeps): Router {
  const router = Router();
  const {
    prisma,
    requireAuth,
    uid,
    normalizeEmail,
    validatePassword,
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
      const pwdErr = validatePassword(password);
      if (pwdErr) return res.status(400).json({ error: pwdErr });
      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({ data: { email, username, passwordHash } });
      const token = signToken(user.id);
      res.status(201).json({ token, user: { id: user.id, email: user.email, username: user.username } });
    } catch (e: unknown) {
      handleRouteError(res, e, "Registration failed");
    }
  });

  router.post("/api/auth/login", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password ?? "");
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
  });

  router.get("/api/auth/me", requireAuth, async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: uid(req) } });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ id: user.id, email: user.email, username: user.username });
  });

  return router;
}
