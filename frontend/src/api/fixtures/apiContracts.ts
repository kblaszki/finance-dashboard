import type {
  Account,
  AccountBalanceHistory,
} from "../accountsApi";
import type { AppConfig } from "../appConfigApi";
import type { AssetTrade } from "../assetTradesApi";
import type { AuthConfig, AuthUser } from "../authApi";
import type { CategoriesImportPreview } from "../categoriesApi";
import type { CategoryDescriptionRule } from "../categoryDescriptionRulesApi";
import type { AccountHoldingsResponse } from "../holdingsApi";
import type {
  Instrument,
  InstrumentHistory,
} from "../instrumentsApi";
import type { NetWorth, PeriodSummary } from "../statisticsApi";
import type {
  ImportColumnsPreview,
  ImportPreviewResult,
} from "../transactionsApi";
import type {
  CashTransfer,
  TransferImportPreview,
} from "../transfersApi";
import type { WatchlistItem } from "../watchlistApi";

export const authUserFixture: AuthUser = {
  id: 1,
  email: "user@example.com",
  username: "user",
};

export const authConfigFixture: AuthConfig = {
  allowRegister: true,
};

export const importPreviewFixture: ImportPreviewResult = {
  rowCount: 2,
  categories: [
    {
      path: "Food",
      ledgerType: "EXPENSE",
      rowCount: 1,
      suggestedCategoryId: 2,
    },
  ],
  descriptionSuggestions: [
    {
      description: "Zabka",
      descriptionKey: "zabka",
      ledgerType: "EXPENSE",
      rowCount: 1,
      suggestedCategoryId: 2,
      suggestionSource: "history",
    },
  ],
  skipped: 0,
  skippedTransfers: [],
  duplicateCount: 0,
  skippedDuplicates: [],
};

export const importColumnsPreviewFixture: ImportColumnsPreview = {
  delimiter: ";",
  headers: ["Data", "Kwota", "Opis"],
  sampleRows: [["15.01.2026", "-12,50", "Sklep"]],
  suggestedMapping: {
    occurredAt: 0,
    amount: 1,
    description: 2,
    type: null,
    categoryPath: null,
    amountSignMode: "negativeIsExpense",
  },
  matchingPresetId: null,
};

export const categoryDescriptionRuleFixture: CategoryDescriptionRule = {
  id: 1,
  pattern: "zabka",
  ledgerType: "EXPENSE",
  categoryId: 2,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export const categoriesImportPreviewFixture: CategoriesImportPreview = {
  rowCount: 2,
  existing: 1,
  toCreate: 1,
  rows: [
    { path: "Food", ledgerType: "EXPENSE", status: "exists" },
    { path: "Food/Groceries", ledgerType: "EXPENSE", status: "create" },
  ],
};

export const cashTransferFixture: CashTransfer = {
  id: 1,
  fromAccountId: 1,
  toAccountId: 2,
  fromCurrency: "PLN",
  toCurrency: "PLN",
  amountFrom: 100,
  amountTo: 100,
  fxRate: null,
  occurredAt: "2026-01-01T12:00:00.000Z",
  description: "Move",
  categoryId: null,
  createdAt: "2026-01-01T12:00:00.000Z",
};

export const periodSummaryFixture: PeriodSummary = {
  month: "2026-01",
  period: "month",
  label: "2026-01",
  currency: "PLN",
  income: 1000,
  expense: 400,
  net: 600,
  transfers: 50,
};

export const instrumentFixture: Instrument = {
  id: 1,
  symbol: "AAPL",
  name: "Apple Inc",
  exchange: "NASDAQ",
  micCode: "XNAS",
  country: "United States",
  currency: "USD",
  assetClass: "STOCK",
  provider: "twelve_data",
  providerSymbol: "AAPL",
  allowlisted: true,
};

export const instrumentHistoryFixture: InstrumentHistory = {
  instrument: instrumentFixture,
  currency: "USD",
  months: 12,
  year: null,
  oldestYear: 2020,
  newestYear: 2026,
  from: "2025-11-01",
  to: "2026-11-01",
  series: [
    { asOf: "2025-11-03", close: 180.5 },
    { asOf: "2025-11-04", close: 181.25 },
  ],
  backfilled: false,
};

export const watchlistItemFixture: WatchlistItem = {
  instrumentId: 1,
  createdAt: "2026-10-30T00:00:00.000Z",
  instrument: instrumentFixture,
  lastClose: 181.25,
  asOf: "2026-10-29",
};

export const appConfigFixture: AppConfig = {
  marketLiveApi: false,
};

export const accountEquityFixture: Account = {
  id: 1,
  userId: 1,
  accountType: "BROKERAGE",
  name: "Brokerage Cash",
  currency: "PLN",
  cashBalance: 10_000,
  holdingsValue: 2500,
  totalEquity: 12_500,
  openingBalance: 15_000,
  openingCashAsOf: null,
  description: null,
  totalBalance: 10_000,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export const accountHoldingsFixture: AccountHoldingsResponse = {
  accountId: 1,
  currency: "PLN",
  holdingsValue: 2500,
  holdings: [
    {
      id: 1,
      accountId: 1,
      instrumentId: 1,
      symbol: "XTB",
      name: "XTB",
      quantity: 20,
      lastClose: 125,
      lastCloseAsOf: "2026-10-30",
      marketValue: 2500,
      currency: "PLN",
    },
  ],
};

export const assetTradeFixture: AssetTrade = {
  id: 1,
  accountId: 1,
  instrumentId: 1,
  side: "BUY",
  quantity: 20,
  unitPrice: 100,
  commission: 5,
  currency: "PLN",
  occurredAt: "2026-01-15T12:00:00.000Z",
  settlementDate: null,
  notes: null,
  createdAt: "2026-01-15T12:00:00.000Z",
  instrumentSymbol: "XTB",
  instrumentName: "XTB",
};

export const netWorthFixture: NetWorth = {
  currency: "PLN",
  asOf: "2026-10-30",
  byBucket: {
    cash: 1000,
    stock: 2500,
    crypto: 0,
    metal: 0,
    real_estate: 0,
    other: 0,
  },
  liabilities: 0,
  netWorth: 3500,
  ratesUsed: [],
};

export const accountBalanceHistoryFixture: AccountBalanceHistory = {
  accountId: 1,
  currency: "PLN",
  monthCount: 1,
  series: [
    {
      month: "2026-10",
      balance: 10_000,
      cashBalance: 10_000,
      holdingsValue: 2500,
      totalEquity: 12_500,
    },
  ],
};

export const transferImportPreviewFixture: TransferImportPreview = {
  rowCount: 1,
  accounts: [
    {
      name: "Checking",
      currency: "PLN",
      rowCount: 1,
      suggestedAccountId: 1,
    },
  ],
  rows: [
    {
      row: 2,
      occurredAt: "2026-01-01T12:00:00.000Z",
      fromAccountId: 1,
      toAccountId: 2,
      amountFrom: 10,
      amountTo: 10,
      description: "Move",
      duplicate: false,
    },
  ],
};

function assertAuthUserShape(value: AuthUser): void {
  if (typeof value.id !== "number") throw new Error("authUser.id");
  if (typeof value.email !== "string") throw new Error("authUser.email");
  if (typeof value.username !== "string") throw new Error("authUser.username");
}

function assertAuthConfigShape(value: AuthConfig): void {
  if (typeof value.allowRegister !== "boolean") {
    throw new Error("authConfig.allowRegister");
  }
}

function assertImportPreviewShape(value: ImportPreviewResult): void {
  if (typeof value.rowCount !== "number") throw new Error("import.rowCount");
  if (!Array.isArray(value.categories)) throw new Error("import.categories");
  if (!Array.isArray(value.descriptionSuggestions)) {
    throw new Error("import.descriptionSuggestions");
  }
  if (!Array.isArray(value.skippedTransfers)) {
    throw new Error("import.skippedTransfers");
  }
  if (typeof value.duplicateCount !== "number") {
    throw new Error("import.duplicateCount");
  }
  if (!Array.isArray(value.skippedDuplicates)) {
    throw new Error("import.skippedDuplicates");
  }
  const suggestion = value.descriptionSuggestions[0];
  if (suggestion) {
    if (typeof suggestion.descriptionKey !== "string") {
      throw new Error("import.descriptionSuggestions.descriptionKey");
    }
    if (
      suggestion.suggestionSource !== "rule" &&
      suggestion.suggestionSource !== "history" &&
      suggestion.suggestionSource !== null
    ) {
      throw new Error("import.descriptionSuggestions.suggestionSource");
    }
  }
}

function assertImportColumnsPreviewShape(value: ImportColumnsPreview): void {
  if (typeof value.delimiter !== "string") {
    throw new Error("columns.delimiter");
  }
  if (!Array.isArray(value.headers)) throw new Error("columns.headers");
  if (!Array.isArray(value.sampleRows)) throw new Error("columns.sampleRows");
  if (typeof value.suggestedMapping !== "object" || !value.suggestedMapping) {
    throw new Error("columns.suggestedMapping");
  }
  if (
    value.matchingPresetId !== null &&
    typeof value.matchingPresetId !== "number"
  ) {
    throw new Error("columns.matchingPresetId");
  }
}

function assertDescriptionRuleShape(value: CategoryDescriptionRule): void {
  if (typeof value.id !== "number") throw new Error("rule.id");
  if (typeof value.pattern !== "string") throw new Error("rule.pattern");
  if (value.ledgerType !== "INCOME" && value.ledgerType !== "EXPENSE") {
    throw new Error("rule.ledgerType");
  }
  if (typeof value.categoryId !== "number") throw new Error("rule.categoryId");
}

function assertTransferImportPreviewShape(value: TransferImportPreview): void {
  if (typeof value.rowCount !== "number") throw new Error("transfer.rowCount");
  if (!Array.isArray(value.accounts)) throw new Error("transfer.accounts");
  if (!Array.isArray(value.rows)) throw new Error("transfer.rows");
}

function assertCategoriesImportPreviewShape(
  value: CategoriesImportPreview,
): void {
  if (typeof value.rowCount !== "number") throw new Error("catImport.rowCount");
  if (typeof value.existing !== "number") throw new Error("catImport.existing");
  if (typeof value.toCreate !== "number") throw new Error("catImport.toCreate");
  if (!Array.isArray(value.rows)) throw new Error("catImport.rows");
}

function assertCashTransferShape(value: CashTransfer): void {
  if (typeof value.id !== "number") throw new Error("transfer.id");
  if (typeof value.fromAccountId !== "number") {
    throw new Error("transfer.fromAccountId");
  }
  if (typeof value.amountFrom !== "number") {
    throw new Error("transfer.amountFrom");
  }
  if (typeof value.occurredAt !== "string") {
    throw new Error("transfer.occurredAt");
  }
}

function assertPeriodSummaryShape(value: PeriodSummary): void {
  if (typeof value.month !== "string") throw new Error("period.month");
  if (typeof value.currency !== "string") throw new Error("period.currency");
  if (typeof value.income !== "number") throw new Error("period.income");
  if (typeof value.expense !== "number") throw new Error("period.expense");
  if (typeof value.net !== "number") throw new Error("period.net");
  if (typeof value.transfers !== "number") throw new Error("period.transfers");
}

function assertInstrumentShape(value: Instrument): void {
  if (typeof value.id !== "number") throw new Error("instrument.id");
  if (typeof value.symbol !== "string") throw new Error("instrument.symbol");
  if (typeof value.name !== "string") throw new Error("instrument.name");
  if (typeof value.currency !== "string") throw new Error("instrument.currency");
  if (typeof value.assetClass !== "string") {
    throw new Error("instrument.assetClass");
  }
  if (typeof value.allowlisted !== "boolean") {
    throw new Error("instrument.allowlisted");
  }
}

function assertInstrumentHistoryShape(value: InstrumentHistory): void {
  assertInstrumentShape(value.instrument);
  if (typeof value.currency !== "string") {
    throw new Error("history.currency");
  }
  if (!Array.isArray(value.series)) throw new Error("history.series");
  if (typeof value.backfilled !== "boolean") {
    throw new Error("history.backfilled");
  }
  if (typeof value.from !== "string" || typeof value.to !== "string") {
    throw new Error("history.from/to");
  }
}

function assertWatchlistItemShape(value: WatchlistItem): void {
  if (typeof value.instrumentId !== "number") {
    throw new Error("watchlist.instrumentId");
  }
  assertInstrumentShape(value.instrument);
  if (value.lastClose !== null && typeof value.lastClose !== "number") {
    throw new Error("watchlist.lastClose");
  }
  if (value.asOf !== null && typeof value.asOf !== "string") {
    throw new Error("watchlist.asOf");
  }
}

function assertAppConfigShape(value: AppConfig): void {
  if (typeof value.marketLiveApi !== "boolean") {
    throw new Error("appConfig.marketLiveApi");
  }
}

function assertAccountEquityShape(value: Account): void {
  if (typeof value.cashBalance !== "number") throw new Error("account.cashBalance");
  if (typeof value.holdingsValue !== "number") {
    throw new Error("account.holdingsValue");
  }
  if (typeof value.totalEquity !== "number") {
    throw new Error("account.totalEquity");
  }
}

function assertAccountHoldingsShape(value: AccountHoldingsResponse): void {
  if (typeof value.accountId !== "number") throw new Error("holdings.accountId");
  if (typeof value.holdingsValue !== "number") {
    throw new Error("holdings.holdingsValue");
  }
  if (!Array.isArray(value.holdings)) throw new Error("holdings.holdings");
  const row = value.holdings[0];
  if (row && typeof row.instrumentId !== "number") {
    throw new Error("holdings.instrumentId");
  }
}

function assertAssetTradeShape(value: AssetTrade): void {
  if (typeof value.id !== "number") throw new Error("trade.id");
  if (typeof value.side !== "string") throw new Error("trade.side");
  if (typeof value.quantity !== "number") throw new Error("trade.quantity");
  if (typeof value.unitPrice !== "number") throw new Error("trade.unitPrice");
  if (typeof value.occurredAt !== "string") throw new Error("trade.occurredAt");
}

function assertNetWorthShape(value: NetWorth): void {
  if (typeof value.currency !== "string") throw new Error("netWorth.currency");
  if (typeof value.netWorth !== "number") throw new Error("netWorth.netWorth");
  if (typeof value.byBucket.stock !== "number") {
    throw new Error("netWorth.byBucket.stock");
  }
}

function assertBalanceHistoryShape(value: AccountBalanceHistory): void {
  if (typeof value.accountId !== "number") {
    throw new Error("balanceHistory.accountId");
  }
  if (!Array.isArray(value.series)) throw new Error("balanceHistory.series");
  const point = value.series[0];
  if (point) {
    if (typeof point.cashBalance !== "number") {
      throw new Error("balanceHistory.cashBalance");
    }
    if (typeof point.holdingsValue !== "number") {
      throw new Error("balanceHistory.holdingsValue");
    }
    if (typeof point.totalEquity !== "number") {
      throw new Error("balanceHistory.totalEquity");
    }
  }
}

export function validateApiContractFixtures(): void {
  assertAuthUserShape(authUserFixture);
  assertAuthConfigShape(authConfigFixture);
  assertImportPreviewShape(importPreviewFixture);
  assertImportColumnsPreviewShape(importColumnsPreviewFixture);
  assertDescriptionRuleShape(categoryDescriptionRuleFixture);
  assertTransferImportPreviewShape(transferImportPreviewFixture);
  assertCategoriesImportPreviewShape(categoriesImportPreviewFixture);
  assertCashTransferShape(cashTransferFixture);
  assertPeriodSummaryShape(periodSummaryFixture);
  assertInstrumentShape(instrumentFixture);
  assertInstrumentHistoryShape(instrumentHistoryFixture);
  assertWatchlistItemShape(watchlistItemFixture);
  assertAppConfigShape(appConfigFixture);
  assertAccountEquityShape(accountEquityFixture);
  assertAccountHoldingsShape(accountHoldingsFixture);
  assertAssetTradeShape(assetTradeFixture);
  assertNetWorthShape(netWorthFixture);
  assertBalanceHistoryShape(accountBalanceHistoryFixture);
}
