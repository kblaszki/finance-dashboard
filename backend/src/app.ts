import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { convertAmount, getFxRatesPlnPerUnit, normalizeCurrency } from "./fx";
import {
  hashPassword,
  normalizeEmail,
  requireAuth,
  signToken,
  validatePassword,
  verifyPassword,
} from "./auth";
import { isValidLotSide, resolveLotPrice } from "./holdingLot";
import {
  backfillAccountValuations,
  recomputeAccountValuationsFrom,
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
import { computeBalanceAfter, isValidTransactionType } from "./transactionBalance";
import { computeNetWorth } from "./netWorth";
import { createStatsRouter } from "./routes/statsRoutes";
import { createTransactionsRouter } from "./routes/transactionsRoutes";
import {
  getAccountForUser,
  parseDateBody,
  recalcTransactionBalances,
  serializeAccount,
  serializeHoldingLot,
  serializeHoldingSummary,
  serializeTransaction,
  syncBrokerageCashBalance,
  transactionDateFilter,
  uid,
} from "./routes/routeSupport";
import { createAuthRouter } from "./routes/authRoutes";
import { createAccountsRouter } from "./routes/accountsRoutes";
import { createInstrumentsRouter } from "./routes/instrumentsRoutes";
import { createHoldingsRouter } from "./routes/holdingsRoutes";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
app.use(
  createAuthRouter({
    prisma,
    requireAuth,
    uid,
    normalizeEmail,
    validatePassword,
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
    getAccountForUser,
    transactionDateFilter,
    serializeAccount,
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
    computeBalanceAfter,
    toNumber,
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
    getAccountForUser,
    recomputeAccountValuationsFrom,
    transactionDateFilter,
    toNumber,
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

if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
}

export { app, prisma };
