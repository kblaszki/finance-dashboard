import { Request, Response, NextFunction } from "express";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_EXPIRES_IN = "7d";

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters");
  }
  return secret;
}

export function normalizeEmail(email: unknown): string {
  return String(email ?? "").trim().toLowerCase();
}

export function validatePassword(password: unknown): string | null {
  const p = String(password ?? "");
  if (p.length < 8) return "Password must be at least 8 characters";
  return null;
}

export function validateUsername(username: unknown): string | null {
  const u = String(username ?? "").trim();
  if (u.length < 3 || u.length > 32) return "Username must be 3–32 characters";
  if (!/^[a-zA-Z0-9_]+$/.test(u)) {
    return "Username may only contain letters, numbers, and underscores";
  }
  return null;
}

/** Stable login key. Callers persist this alongside the display username. */
export function canonicalUsernameKey(username: string): string {
  return username.trim().toLowerCase();
}

export function parseLoginIdentifier(body: { login?: unknown; email?: unknown }): string {
  const raw = body.login ?? body.email;
  return String(raw ?? "").trim();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export type VerifiedToken = { userId: number; tokenVersion: number };

export function signToken(userId: number, tokenVersion = 0): string {
  return jwt.sign({ userId, tokenVersion }, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: "HS256",
  });
}

export function verifyToken(token: string): VerifiedToken | null {
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as {
      userId?: number;
      tokenVersion?: number;
    };
    if (typeof payload.userId !== "number") return null;
    const tokenVersion = typeof payload.tokenVersion === "number" ? payload.tokenVersion : 0;
    return { userId: payload.userId, tokenVersion };
  } catch {
    return null;
  }
}

export interface AuthedRequest extends Request {
  userId?: number;
}

export function createRequireAuth(prisma: PrismaClient) {
  return async function requireAuth(
    req: AuthedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const auth = verifyToken(header.slice("Bearer ".length));
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { tokenVersion: true },
    });
    if (!user || user.tokenVersion !== auth.tokenVersion) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.userId = auth.userId;
    next();
  };
}
