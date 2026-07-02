import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { convertAmount, getFxRatesPlnPerUnit, normalizeCurrency } from "../fx";
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
import { isValidLotSide, resolveLotPrice } from "../holdingLot";
import {
  backfillAccountValuations,
  recalcTransactionBalances,
  recomputeAccountValuationsFrom,
  recomputeAccountsForInstrumentUser,
  syncBrokerageCashBalance,
  toNumber,
} from "../accountValuation";
import {
  buildHoldingSummary,
  findOrCreateHolding,
  getAccountHoldings,
  getHoldingForUser,
  recalcLotQuantityChain,
  syncHoldingQuantity,
} from "../holdings";
import { isValidTransactionType } from "../transactionBalance";
import { computeNetWorth } from "../netWorth";
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
} from "./routeSupport";
import { createAuthRouter } from "./authRoutes";
import { createAccountsRouter } from "./accountsRoutes";
import { createInstrumentsRouter } from "./instrumentsRoutes";
import { createHoldingsRouter } from "./holdingsRoutes";
import { createPortfolioRouter } from "./portfolioRoutes";
import { createAssetTradesRouter } from "./assetTradesRoutes";
import { createInternalTransfersRouter } from "./internalTransfersRoutes";
import { createMarketDataRouter } from "./marketDataRoutes";
import { createImportRouter } from "./importRoutes";
import { createCategoriesRouter } from "./categoriesRoutes";
import { createBudgetsRouter } from "./budgetsRoutes";
import { createIncomeEventsRouter } from "./incomeEventsRoutes";
import { createLiabilitiesRouter } from "./liabilitiesRoutes";
import { createPropertyCashFlowsRouter } from "./propertyCashFlowsRoutes";
import { createTaxWrappersRouter } from "./taxWrappersRoutes";
import { createPositionTransfersRouter } from "./positionTransfersRoutes";
import { createCorporateActionsRouter } from "./corporateActionsRoutes";
import { createTaxLossCarryforwardRouter } from "./taxLossCarryforwardRoutes";
import { createPropertySalesRouter } from "./propertySalesRoutes";
import { createDocumentAttachmentsRouter } from "./documentAttachmentsRoutes";
import { createImportPresetsRouter } from "./importPresetsRoutes";
import { createTaxCalendarRouter } from "./taxCalendarRoutes";
import { createAssetValuationsRouter } from "./assetValuationsRoutes";
import { createCouponSchedulesRouter } from "./couponSchedulesRoutes";
import { createCategorizationRulesRouter } from "./categorizationRulesRoutes";
import { createAccountSyncRouter } from "./accountSyncRoutes";
import { createBankConnectionsRouter } from "./bankConnectionsRoutes";
import { createExportRouter } from "./exportRoutes";
import { createStatsRouter } from "./statsRoutes";
import { createTransactionsRouter } from "./transactionsRoutes";

export function mountApiRouters(app: Express, prisma: PrismaClient): void {
  // Auth
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

  // Accounts & cash ledger
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
    createCategorizationRulesRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );

  // Brokerage & instruments
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
    createPositionTransfersRouter({
      prisma,
      requireAuth,
      uid,
      parseDateBody,
      transactionDateFilter,
      getFxRatesPlnPerUnit,
      recomputeAccountValuationsFrom,
    }),
  );

  app.use(
    createCorporateActionsRouter({
      prisma,
      requireAuth,
      uid,
      parseDateBody,
      transactionDateFilter,
      getFxRatesPlnPerUnit,
      recomputeAccountValuationsFrom,
    }),
  );

  app.use(
    createCouponSchedulesRouter({
      prisma,
      requireAuth,
      uid,
      parseDateBody,
      transactionDateFilter,
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

  // Portfolio & stats
  app.use(
    createPortfolioRouter({
      prisma,
      requireAuth,
      uid,
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

  // Market data & import
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
    createImportPresetsRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );

  // Property & liabilities
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

  app.use(
    createAssetValuationsRouter({
      prisma,
      requireAuth,
      uid,
      parseDateBody,
      transactionDateFilter,
      getFxRatesPlnPerUnit,
    }),
  );

  app.use(
    createPropertySalesRouter({
      prisma,
      requireAuth,
      uid,
      parseDateBody,
      transactionDateFilter,
    }),
  );

  // Tax
  app.use(
    createTaxWrappersRouter({
      prisma,
      requireAuth,
      uid,
      parseDateBody,
      transactionDateFilter,
    }),
  );

  app.use(
    createTaxLossCarryforwardRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );

  app.use(
    createTaxCalendarRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );

  // Automation & export
  app.use(
    createDocumentAttachmentsRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );

  app.use(
    createAccountSyncRouter({
      prisma,
      requireAuth,
      uid,
      getFxRatesPlnPerUnit,
    }),
  );

  app.use(
    createBankConnectionsRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );

  app.use(
    createExportRouter({
      prisma,
      requireAuth,
      uid,
    }),
  );
}
