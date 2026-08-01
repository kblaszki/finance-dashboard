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
import { createAccountsRouter } from "./accountsRoutes";
import { createCashTransactionsRouter } from "./cashTransactionsRoutes";

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
  app.use(
    createAccountsRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );
  app.use(
    createCashTransactionsRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );
}
