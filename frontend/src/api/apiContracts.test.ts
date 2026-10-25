import { describe, expect, it } from "vitest";
import {
  authConfigFixture,
  authUserFixture,
  cashTransferFixture,
  categoriesImportPreviewFixture,
  categoryDescriptionRuleFixture,
  importColumnsPreviewFixture,
  importPreviewFixture,
  periodSummaryFixture,
  transferImportPreviewFixture,
  validateApiContractFixtures,
} from "./fixtures/apiContracts";
import type { AuthConfig, AuthUser } from "./authApi";
import type { CategoriesImportPreview } from "./categoriesApi";
import type { CategoryDescriptionRule } from "./categoryDescriptionRulesApi";
import type { PeriodSummary } from "./statisticsApi";
import type {
  ImportColumnsPreview,
  ImportPreviewResult,
} from "./transactionsApi";
import type { CashTransfer, TransferImportPreview } from "./transfersApi";

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
});
