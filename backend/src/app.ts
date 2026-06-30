import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { assertProductionEnvironment } from "./authConfig";
import { convertAmount, getFxRatesPlnPerUnit, normalizeCurrency } from "./fx";
import {
  hashPassword,
  normalizeEmail,
  requireAuth,
  signToken,
  validatePassword,
  validateUsername,
  parseLoginIdentifier,
  verifyPassword,
} from "./auth";
import { isValidLotSide, resolveLotPrice } from "./holdingLot";
import {
  backfillAccountValuations,
  recalcTransactionBalances,
  recomputeAccountValuationsFrom,
  recomputeAccountsForInstrumentUser,
  recomputeAllAccountsForInstrument,
  syncBrokerageCashBalance,
  toNumber,
} from "./accountValuation";
import {
  buildHoldingSummary,
  findOrCreateHolding,
  getAccountHoldings,
  getHoldingForUser,
  recalcLotQuantityChain,
  syncHoldingQuantity,
} from "./holdings";
import { isValidTransactionType } from "./transactionBalance";
import { computeNetWorth } from "./netWorth";
import { createStatsRouter } from "./routes/statsRoutes";
import { createTransactionsRouter } from "./routes/transactionsRoutes";
import {
  getAccountForUser,
  parseDateBody,
  serializeHoldingLot,
  serializeHoldingSummary,
  serializeInstrument,
  serializeInstrumentValuation,
  serializeTransaction,
  transactionDateFilter,
  uid,
} from "./routes/routeSupport";
import { createAuthRouter } from "./routes/authRoutes";
import { createAccountsRouter } from "./routes/accountsRoutes";
import { createInstrumentsRouter } from "./routes/instrumentsRoutes";
import { createHoldingsRouter } from "./routes/holdingsRoutes";
import { createPortfolioRouter } from "./routes/portfolioRoutes";
import { createAssetTradesRouter } from "./routes/assetTradesRoutes";
import { createInternalTransfersRouter } from "./routes/internalTransfersRoutes";
import { createMarketDataRouter } from "./routes/marketDataRoutes";
import { createImportRouter } from "./routes/importRoutes";
import { createCategoriesRouter } from "./routes/categoriesRoutes";
import { createBudgetsRouter } from "./routes/budgetsRoutes";
import { createIncomeEventsRouter } from "./routes/incomeEventsRoutes";
import { createLiabilitiesRouter } from "./routes/liabilitiesRoutes";
import { createPropertyCashFlowsRouter } from "./routes/propertyCashFlowsRoutes";
import { handleRouteError } from "./routes/httpSupport";

dotenv.config();
assertProductionEnvironment();

const app = express();
const prisma = new PrismaClient();

const corsOrigin = process.env.CORS_ORIGIN?.trim();
app.use(
  corsOrigin
    ? cors({ origin: corsOrigin })
    : cors(),
);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "1mb" }));

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
const importRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
if (process.env.NODE_ENV === "production") {
  app.use("/api/auth/login", authRateLimiter);
  app.use("/api/auth/register", authRateLimiter);
  app.use("/api/import", importRateLimiter);
}

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: true });
  } catch {
    res.status(503).json({ ok: false, db: false });
  }
});

const PORT = process.env.PORT || 4000;
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
    normalizeCurrency,
    getFxRatesPlnPerUnit,
    backfillAccountValuations,
    recalcTransactionBalances,
    recomputeAccountValuationsFrom,
    getAccountForUser,
    transactionDateFilter,
    toNumber,
  }),
);

app.use(
  createTransactionsRouter({
    prisma,
    requireAuth,
    uid,
    normalizeCurrency,
    parseDateBody,
    transactionDateFilter,
    isValidTransactionType,
    getAccountForUser,
    recalcTransactionBalances,
    recomputeAccountValuationsFrom,
    getFxRatesPlnPerUnit,
    serializeTransaction,
  }),
);

app.use(
  createInstrumentsRouter({
    prisma,
    requireAuth,
    uid,
    normalizeCurrency,
    parseDateBody,
    getFxRatesPlnPerUnit,
    recomputeAccountsForInstrumentUser,
    transactionDateFilter,
    serializeInstrument,
    serializeInstrumentValuation,
  }),
);

app.use(
  createHoldingsRouter({
    prisma,
    requireAuth,
    uid,
    normalizeCurrency,
    parseDateBody,
    isValidLotSide,
    resolveLotPrice,
    getFxRatesPlnPerUnit,
    getAccountForUser,
    getAccountHoldings,
    getHoldingForUser,
    buildHoldingSummary,
    findOrCreateHolding,
    recalcLotQuantityChain,
    syncHoldingQuantity,
    syncBrokerageCashBalance,
    recomputeAccountValuationsFrom,
    serializeHoldingSummary,
    serializeHoldingLot,
    transactionDateFilter,
    toNumber,
  }),
);

app.use(
  createPortfolioRouter({
    prisma,
    requireAuth,
    uid,
    getFxRatesPlnPerUnit,
  }),
);

app.use(
  createAssetTradesRouter({
    prisma,
    requireAuth,
    uid,
    normalizeCurrency,
    parseDateBody,
    isValidLotSide,
    transactionDateFilter,
    getAccountForUser,
    resolveLotPrice,
    getFxRatesPlnPerUnit,
    recomputeAccountValuationsFrom,
    serializeHoldingLot,
    toNumber,
  }),
);

app.use(
  createInternalTransfersRouter({
    prisma,
    requireAuth,
    uid,
    parseDateBody,
    transactionDateFilter,
    getAccountForUser,
    getFxRatesPlnPerUnit,
  }),
);

app.use(
  createStatsRouter({
    prisma,
    requireAuth,
    uid,
    normalizeCurrency,
    transactionDateFilter,
    toNumber,
    convertAmount,
    getFxRatesPlnPerUnit,
    computeNetWorth,
  }),
);

app.use(
  createMarketDataRouter({
    prisma,
    requireAuth,
    uid,
    getFxRatesPlnPerUnit,
  }),
);

app.use(
  createImportRouter({
    prisma,
    requireAuth,
    uid,
    getFxRatesPlnPerUnit,
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
  createBudgetsRouter({
    prisma,
    requireAuth,
    uid,
    normalizeCurrency,
    convertAmount,
    getFxRatesPlnPerUnit,
    toNumber,
  }),
);

app.use(
  createIncomeEventsRouter({
    prisma,
    requireAuth,
    uid,
    parseDateBody,
    transactionDateFilter,
  }),
);

app.use(
  createLiabilitiesRouter({
    prisma,
    requireAuth,
    uid,
  }),
);

app.use(
  createPropertyCashFlowsRouter({
    prisma,
    requireAuth,
    uid,
    parseDateBody,
    transactionDateFilter,
  }),
);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  handleRouteError(res, err, "Internal server error");
});

/* c8 ignore start */
if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
}
/* c8 ignore end */

export { app, prisma };
