import { describe, expect, it } from "vitest";
import type { Account } from "../api/accountsApi";
import { filterAccountsByType } from "./AccountsPage";

function account(partial: Partial<Account> & Pick<Account, "id" | "name" | "accountType">): Account {
  return {
    userId: 1,
    currency: "PLN",
    cashBalance: 0,
    openingBalance: 0,
    openingCashAsOf: null,
    description: null,
    totalBalance: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("filterAccountsByType", () => {
  const rows = [
    account({ id: 1, name: "Checking", accountType: "BANK" }),
    account({ id: 2, name: "Broker", accountType: "BROKERAGE" }),
    account({ id: 3, name: "Savings", accountType: "BANK" }),
  ];

  it("returns all accounts when filter is ALL", () => {
    expect(filterAccountsByType(rows, "ALL")).toEqual(rows);
  });

  it("filters by account type", () => {
    expect(filterAccountsByType(rows, "BANK").map((a) => a.id)).toEqual([1, 3]);
    expect(filterAccountsByType(rows, "BROKERAGE").map((a) => a.id)).toEqual([2]);
  });

  it("returns empty when no accounts match", () => {
    expect(filterAccountsByType(rows, "CRYPTO")).toEqual([]);
  });
});
