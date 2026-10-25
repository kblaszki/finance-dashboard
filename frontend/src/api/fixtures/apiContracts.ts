import type { AuthConfig, AuthUser } from "../authApi";
import type { CategoryDescriptionRule } from "../categoryDescriptionRulesApi";
import type {
  ImportColumnsPreview,
  ImportPreviewResult,
} from "../transactionsApi";
import type { TransferImportPreview } from "../transfersApi";

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
  if (value.rows !== undefined && !Array.isArray(value.rows)) {
    throw new Error("transfer.rows");
  }
}

export function validateApiContractFixtures(): void {
  assertAuthUserShape(authUserFixture);
  assertAuthConfigShape(authConfigFixture);
  assertImportPreviewShape(importPreviewFixture);
  assertImportColumnsPreviewShape(importColumnsPreviewFixture);
  assertDescriptionRuleShape(categoryDescriptionRuleFixture);
  assertTransferImportPreviewShape(transferImportPreviewFixture);
}
