import { describe, expect, it } from "vitest";
import {
  EMPTY_LEDGER_FILTERS,
  EMPTY_TRANSFER_FILTERS,
  filterLedgerRows,
  filterTransferRows,
} from "./listFilters";

describe("filterLedgerRows", () => {
  const rows = [
    {
      id: 1,
      occurredAt: "2026-03-01T12:00:00.000Z",
      type: "EXPENSE",
      categoryId: 3,
      tagIds: [10],
      description: "Coffee shop",
    },
    {
      id: 2,
      occurredAt: "2026-03-15T12:00:00.000Z",
      type: "INCOME",
      categoryId: null,
      tagIds: [],
      description: "Salary",
    },
  ];

  it("filters by type, category none, tag, and description", () => {
    expect(
      filterLedgerRows(rows, {
        ...EMPTY_LEDGER_FILTERS,
        type: "EXPENSE",
      }).map((r) => r.id),
    ).toEqual([1]);
    expect(
      filterLedgerRows(rows, {
        ...EMPTY_LEDGER_FILTERS,
        categoryId: "none",
      }).map((r) => r.id),
    ).toEqual([2]);
    expect(
      filterLedgerRows(rows, {
        ...EMPTY_LEDGER_FILTERS,
        tagId: "10",
      }).map((r) => r.id),
    ).toEqual([1]);
    expect(
      filterLedgerRows(rows, {
        ...EMPTY_LEDGER_FILTERS,
        description: "coffee",
      }).map((r) => r.id),
    ).toEqual([1]);
  });

  it("filters by local date range", () => {
    expect(
      filterLedgerRows(rows, {
        ...EMPTY_LEDGER_FILTERS,
        fromDate: "2026-03-10",
      }).map((r) => r.id),
    ).toEqual([2]);
  });
});

describe("filterTransferRows", () => {
  const rows = [
    {
      id: 1,
      occurredAt: "2026-03-01T12:00:00.000Z",
      fromAccountId: 1,
      toAccountId: 2,
      categoryId: 5,
      description: "Move cash",
    },
    {
      id: 2,
      occurredAt: "2026-03-02T12:00:00.000Z",
      fromAccountId: 2,
      toAccountId: 1,
      categoryId: null,
      description: null,
    },
  ];

  it("filters by accounts and category", () => {
    expect(
      filterTransferRows(rows, {
        ...EMPTY_TRANSFER_FILTERS,
        fromAccountId: "1",
      }).map((r) => r.id),
    ).toEqual([1]);
    expect(
      filterTransferRows(rows, {
        ...EMPTY_TRANSFER_FILTERS,
        categoryId: "none",
      }).map((r) => r.id),
    ).toEqual([2]);
  });
});
