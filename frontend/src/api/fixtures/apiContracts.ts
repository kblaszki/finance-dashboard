import type { AuthConfig, AuthUser } from "../authApi";
import type { CategoriesImportPreview } from "../categoriesApi";
import type { CategoryDescriptionRule } from "../categoryDescriptionRulesApi";
import type { PeriodSummary } from "../statisticsApi";
import type {
  ImportColumnsPreview,
  ImportPreviewResult,
} from "../transactionsApi";
import type {
  CashTransfer,
  TransferImportPreview,
} from "../transfersApi";

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
}
