import { describe, expect, it } from "vitest";
import {
  accountBalanceHistoryFixture,
  accountEquityFixture,
  accountHoldingsFixture,
  appConfigFixture,
  assetTradeFixture,
  authConfigFixture,
  authUserFixture,
  cashTransferFixture,
  categoriesImportPreviewFixture,
  categoryDescriptionRuleFixture,
  importColumnsPreviewFixture,
  importPreviewFixture,
  instrumentFixture,
  instrumentHistoryFixture,
  netWorthFixture,
  periodSummaryFixture,
  transferImportPreviewFixture,
  validateApiContractFixtures,
  watchlistItemFixture,
} from "./fixtures/apiContracts";
import type { Account, AccountBalanceHistory } from "./accountsApi";
import type { AppConfig } from "./appConfigApi";
import type { AssetTrade } from "./assetTradesApi";
import type { AuthConfig, AuthUser } from "./authApi";
import type { CategoriesImportPreview } from "./categoriesApi";
import type { CategoryDescriptionRule } from "./categoryDescriptionRulesApi";
import type { AccountHoldingsResponse } from "./holdingsApi";
import type { Instrument, InstrumentHistory } from "./instrumentsApi";
import type { NetWorth, PeriodSummary } from "./statisticsApi";
import type {
  ImportColumnsPreview,
  ImportPreviewResult,
} from "./transactionsApi";
import type { CashTransfer, TransferImportPreview } from "./transfersApi";
import type { WatchlistItem } from "./watchlistApi";

describe("API contract fixtures", () => {
  it("validates fixture shapes against frontend types", () => {
    expect(() => validateApiContractFixtures()).not.toThrow();
  });

  it("auth user fixture matches AuthUser type fields", () => {
    const user: AuthUser = authUserFixture;
    expect(user.email).toContain("@");
    expect(user.username.length).toBeGreaterThan(0);
  });

  it("auth config fixture matches AuthConfig type fields", () => {
    const config: AuthConfig = authConfigFixture;
    expect(typeof config.allowRegister).toBe("boolean");
  });

  it("import preview fixture includes description suggestions", () => {
    const preview: ImportPreviewResult = importPreviewFixture;
    expect(preview.descriptionSuggestions[0]?.suggestionSource).toBe(
      "history",
    );
    expect(preview.duplicateCount).toBe(0);
  });

  it("import columns preview fixture matches ImportColumnsPreview", () => {
    const cols: ImportColumnsPreview = importColumnsPreviewFixture;
    expect(cols.headers.length).toBe(3);
    expect(cols.suggestedMapping.amount).toBe(1);
  });

  it("description rule fixture matches CategoryDescriptionRule", () => {
    const rule: CategoryDescriptionRule = categoryDescriptionRuleFixture;
    expect(rule.pattern).toBe("zabka");
    expect(rule.ledgerType).toBe("EXPENSE");
  });

  it("transfer import preview fixture includes mapped rows", () => {
    const preview: TransferImportPreview = transferImportPreviewFixture;
    expect(preview.rows.length).toBe(1);
    expect(preview.accounts[0]?.suggestedAccountId).toBe(1);
  });

  it("categories import preview fixture matches CategoriesImportPreview", () => {
    const preview: CategoriesImportPreview = categoriesImportPreviewFixture;
    expect(preview.toCreate).toBe(1);
    expect(preview.rows[1]?.status).toBe("create");
  });

  it("cash transfer fixture matches CashTransfer", () => {
    const transfer: CashTransfer = cashTransferFixture;
    expect(transfer.fromCurrency).toBe("PLN");
    expect(transfer.amountFrom).toBe(100);
  });

  it("period summary fixture matches PeriodSummary", () => {
    const summary: PeriodSummary = periodSummaryFixture;
    expect(summary.net).toBe(600);
    expect(summary.transfers).toBe(50);
  });

  it("instrument fixture matches Instrument", () => {
    const row: Instrument = instrumentFixture;
    expect(row.symbol).toBe("AAPL");
    expect(row.allowlisted).toBe(true);
  });

  it("instrument history fixture matches InstrumentHistory", () => {
    const history: InstrumentHistory = instrumentHistoryFixture;
    expect(history.series.length).toBe(2);
    expect(history.months).toBe(12);
  });

  it("watchlist item fixture matches WatchlistItem", () => {
    const item: WatchlistItem = watchlistItemFixture;
    expect(item.instrumentId).toBe(1);
    expect(item.lastClose).toBe(181.25);
  });

  it("app config fixture matches AppConfig", () => {
    const config: AppConfig = appConfigFixture;
    expect(config.marketLiveApi).toBe(false);
  });

  it("account equity fixture includes holdings MTM fields", () => {
    const account: Account = accountEquityFixture;
    expect(account.holdingsValue).toBe(2500);
    expect(account.totalEquity).toBe(12_500);
  });

  it("holdings / trade / net-worth / balance-history fixtures match types", () => {
    const holdings: AccountHoldingsResponse = accountHoldingsFixture;
    const trade: AssetTrade = assetTradeFixture;
    const netWorth: NetWorth = netWorthFixture;
    const history: AccountBalanceHistory = accountBalanceHistoryFixture;
    expect(holdings.holdings[0]?.symbol).toBe("XTB");
    expect(trade.side).toBe("BUY");
    expect(netWorth.byBucket.stock).toBe(2500);
    expect(history.series[0]?.totalEquity).toBe(12_500);
  });
});
