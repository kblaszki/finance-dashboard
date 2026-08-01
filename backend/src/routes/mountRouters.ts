import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import {
  hashPassword,
  normalizeEmail,
  requireAuth,
  signToken,
  validatePassword,
  validateUsername,
  parseLoginIdentifier,
  verifyPassword,
} from "../auth";
import { uid } from "./routeSupport";
import { createAuthRouter } from "./authRoutes";

export function mountApiRouters(app: Express, prisma: PrismaClient): void {
  app.use(
    createAuthRouter({
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
    }),
  );
}
