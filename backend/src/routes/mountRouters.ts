import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import {
  canonicalUsernameKey,
  createRequireAuth,
  hashPassword,
  normalizeEmail,
  signToken,
  validatePassword,
  validateUsername,
  parseLoginIdentifier,
  verifyPassword,
} from "../auth";
import { uid } from "./routeSupport";
import { createAuthRouter } from "./authRoutes";
import { createAccountsRouter } from "./accountsRoutes";
import { createCategoriesRouter } from "./categoriesRoutes";
import { createCashTransactionsRouter } from "./cashTransactionsRoutes";
import { createCashImportRouter } from "./cashImportRoutes";
import { createStatisticsRouter } from "./statisticsRoutes";
import { createTransfersRouter } from "./transfersRoutes";
import { createTagsRouter } from "./tagsRoutes";
import { createCsvImportPresetsRouter } from "./csvImportPresetsRoutes";
import { createCategoryDescriptionRulesRouter } from "./categoryDescriptionRulesRoutes";
import { createMarketsRouter } from "./marketsRoutes";

export function mountApiRouters(app: Express, prisma: PrismaClient): void {
  const requireAuth = createRequireAuth(prisma);
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
    createCategoriesRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );
  app.use(
    createTagsRouter({
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
  app.use(
    createCashImportRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );
  app.use(
    createCsvImportPresetsRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );
  app.use(
    createCategoryDescriptionRulesRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );
  app.use(
    createTransfersRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );
  app.use(
    createStatisticsRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );
  app.use(
    createMarketsRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );
}
