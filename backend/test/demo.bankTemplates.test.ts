import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBankMonthTemplates } from "../prisma/demo/seedBuilders";
import {
  DEMO_MONTHLY_EXPENSE_PLN,
  DEMO_QUARTERLY_INVESTMENT_PLN,
  DEMO_SALARY_BASE_PLN,
} from "../prisma/demo/seedConfig";

test("buildBankMonthTemplates yields 10-20k salary and 5k+ monthly expenses", () => {
  const templates = buildBankMonthTemplates(24);
  const salaries = templates.filter((t) => t.categoryName === "Salary");
  assert.equal(salaries.length, 24);
  for (const s of salaries) {
    assert.ok(s.amount >= 10_000 && s.amount <= 20_000);
  }

  for (let m = 0; m < 24; m++) {
    const monthExpenses = templates.filter(
      (t) =>
        t.transactionType === "EXPENSE" &&
        t.days >= m * 30 + 5 &&
        t.days < (m + 1) * 30 + 5,
    );
    const total = monthExpenses.reduce((sum, t) => sum + t.amount, 0);
    assert.ok(total >= DEMO_MONTHLY_EXPENSE_PLN, `month ${m} expenses ${total}`);
  }
});

test("buildBankMonthTemplates includes quarterly investment transfers", () => {
  const templates = buildBankMonthTemplates(24);
  const transfers = templates.filter((t) => t.transactionType === "TRANSFER_OUT");
  assert.equal(transfers.length, 8);
  assert.ok(transfers.every((t) => t.amount >= DEMO_QUARTERLY_INVESTMENT_PLN));
  assert.ok(salariesMin(templates) >= DEMO_SALARY_BASE_PLN);
});

function salariesMin(templates: ReturnType<typeof buildBankMonthTemplates>) {
  return Math.min(
    ...templates.filter((t) => t.categoryName === "Salary").map((t) => t.amount),
  );
}
