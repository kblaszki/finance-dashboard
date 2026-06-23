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
  recalcTransactionBalances,
  recomputeAccountValuationsFrom,
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
  serializeAccount,
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
import { createMarketDataRouter } from "./routes/marketDataRoutes";
import { createImportRouter } from "./routes/importRoutes";
import { handleRouteError } from "./routes/httpSupport";

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
    recalcTransactionBalances,
    recomputeAccountValuationsFrom,
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
