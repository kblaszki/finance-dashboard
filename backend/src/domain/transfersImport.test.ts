import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import type { TransferCsvDraft } from "./transfersCsv";
import {
  collectUsedAccounts,
  findDuplicateRows,
  occurredAtWindowForTransferRows,
  parseAccountMappings,
  parseSkipRows,
  partitionTransferRowsByExisting,
  resolveTransferDrafts,
  suggestAccountMatches,
  TRANSFER_IMPORT_DEDUP_SCAN_LIMIT,
} from "./transfersImport";

function draft(
  partial: Partial<TransferCsvDraft> & Pick<TransferCsvDraft, "row">,
): TransferCsvDraft {
  return {
    occurredAt: new Date("2024-01-01T12:00:00.000Z"),
    fromName: "Checking",
    fromCurrency: "PLN",
    toName: "Brokerage",
    toCurrency: "PLN",
    amountFrom: new Prisma.Decimal("100"),
    amountTo: new Prisma.Decimal("100"),
    description: null,
    categoryPath: null,
    ...partial,
  };
}

describe("collectUsedAccounts", () => {
  it("merges from/to and counts rows", () => {
    const used = collectUsedAccounts([
      draft({ row: 1 }),
      draft({
        row: 2,
        toName: "Euro",
        toCurrency: "EUR",
        amountTo: new Prisma.Decimal("20"),
      }),
    ]);
    assert.equal(used.length, 3);
    const checking = used.find((u) => u.name === "Checking");
    assert.equal(checking!.rowCount, 2);
    assert.ok(used.some((u) => u.name === "Brokerage" && u.currency === "PLN"));
    assert.ok(used.some((u) => u.name === "Euro" && u.currency === "EUR"));
  });
});

describe("suggestAccountMatches", () => {
  it("suggests case-insensitive name with matching currency only", () => {
    const used = collectUsedAccounts([
      draft({ row: 1, fromName: "checking", toName: "Euro", toCurrency: "EUR" }),
    ]);
    const preview = suggestAccountMatches(used, [
      { id: 1, name: "Checking", currency: "PLN" },
      { id: 2, name: "Euro", currency: "USD" },
      { id: 3, name: "Euro Travel", currency: "EUR" },
    ]);
    const checking = preview.find((p) => p.name.toLowerCase() === "checking");
    const euro = preview.find((p) => p.name === "Euro");
    assert.equal(checking!.suggestedAccountId, 1);
    assert.equal(euro!.suggestedAccountId, null);
  });
});

describe("parseAccountMappings", () => {
  const used = collectUsedAccounts([draft({ row: 1 })]);
  const owned = [
    { id: 10, name: "Checking", currency: "PLN" },
    { id: 20, name: "Brokerage", currency: "PLN" },
  ];

  it("accepts a complete mapping set", () => {
    const result = parseAccountMappings(
      [
        { name: "Checking", currency: "PLN", accountId: 10 },
        { name: "Brokerage", currency: "PLN", accountId: 20 },
      ],
      used,
      owned,
    );
    assert.equal(result.ok, true);
  });

  it("rejects missing, extra, currency mismatch, and unknown account", () => {
    const missing = parseAccountMappings(
      [{ name: "Checking", currency: "PLN", accountId: 10 }],
      used,
      owned,
    );
    assert.equal(missing.ok, false);

    const currency = parseAccountMappings(
      [
        { name: "Checking", currency: "PLN", accountId: 10 },
        { name: "Brokerage", currency: "EUR", accountId: 20 },
      ],
      used,
      owned,
    );
    assert.equal(currency.ok, false);

    const foreign = parseAccountMappings(
      [
        { name: "Checking", currency: "PLN", accountId: 10 },
        { name: "Brokerage", currency: "PLN", accountId: 999 },
      ],
      used,
      owned,
    );
    assert.equal(foreign.ok, false);
    if (!foreign.ok) assert.match(foreign.errors[0]!.message, /not found/);
  });
});

describe("resolveTransferDrafts", () => {
  it("rejects when from and to map to the same account", () => {
    const drafts = [draft({ row: 1 })];
    const byKey = new Map([
      ["PLN\0checking", 10],
      ["PLN\0brokerage", 10],
    ]);
    const result = resolveTransferDrafts(drafts, byKey);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.errors[0]!.message, /different/);
  });

  it("resolves distinct accounts", () => {
    const drafts = [draft({ row: 1 })];
    const byKey = new Map([
      ["PLN\0checking", 10],
      ["PLN\0brokerage", 20],
    ]);
    const result = resolveTransferDrafts(drafts, byKey);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.rows[0]!.input.fromAccountId, 10);
    assert.equal(result.rows[0]!.input.toAccountId, 20);
  });
});

describe("occurredAtWindowForTransferRows", () => {
  it("pads one UTC day around min/max and exports scan limit", () => {
    assert.equal(occurredAtWindowForTransferRows([]), null);
    const window = occurredAtWindowForTransferRows([
      { input: { occurredAt: new Date("2026-01-10T12:00:00.000Z") } },
      { input: { occurredAt: new Date("2026-01-20T12:00:00.000Z") } },
    ]);
    assert.ok(window);
    assert.equal(window!.gte.toISOString(), "2026-01-09T12:00:00.000Z");
    assert.equal(window!.lte.toISOString(), "2026-01-21T12:00:00.000Z");
    assert.ok(TRANSFER_IMPORT_DEDUP_SCAN_LIMIT >= 10_000);
  });
});

describe("findDuplicateRows", () => {
  it("flags exact matches and ignores amount/date/description diffs", () => {
    const occurredAt = new Date("2024-01-01T12:00:00.000Z");
    const rows = [
      {
        row: 1,
        input: {
          fromAccountId: 1,
          toAccountId: 2,
          amountFrom: new Prisma.Decimal("100"),
          amountTo: new Prisma.Decimal("100"),
          occurredAt,
          description: "Move",
        },
      },
      {
        row: 2,
        input: {
          fromAccountId: 1,
          toAccountId: 2,
          amountFrom: new Prisma.Decimal("100"),
          amountTo: new Prisma.Decimal("100"),
          occurredAt,
          description: "Other",
        },
      },
    ];
    const marked = findDuplicateRows(rows, [
      {
        fromAccountId: 1,
        toAccountId: 2,
        amountFrom: 10000,
        amountTo: 10000,
        occurredAt,
        description: "Move",
      },
    ]);
    assert.equal(marked[0]!.duplicate, true);
    assert.equal(marked[1]!.duplicate, false);
  });

  it("flags intra-file duplicates when the ledger is empty", () => {
    const occurredAt = new Date("2024-01-01T12:00:00.000Z");
    const input = {
      fromAccountId: 1,
      toAccountId: 2,
      amountFrom: new Prisma.Decimal("50"),
      amountTo: new Prisma.Decimal("50"),
      occurredAt,
      description: null as string | null,
    };
    const marked = findDuplicateRows(
      [
        { row: 1, input },
        { row: 2, input },
      ],
      [],
    );
    assert.equal(marked[0]!.duplicate, false);
    assert.equal(marked[1]!.duplicate, true);
  });
});

describe("partitionTransferRowsByExisting", () => {
  it("keeps first of an intra-file pair and skips ledger matches", () => {
    const occurredAt = new Date("2024-01-01T12:00:00.000Z");
    const match = {
      fromAccountId: 1,
      toAccountId: 2,
      amountFrom: new Prisma.Decimal("10"),
      amountTo: new Prisma.Decimal("10"),
      occurredAt,
      description: "x" as string | null,
    };
    const novel = {
      fromAccountId: 1,
      toAccountId: 2,
      amountFrom: new Prisma.Decimal("20"),
      amountTo: new Prisma.Decimal("20"),
      occurredAt,
      description: null as string | null,
    };
    const { toImport, skippedDuplicateRows } = partitionTransferRowsByExisting(
      [
        { row: 1, input: match },
        { row: 2, input: novel },
        { row: 3, input: novel },
      ],
      [
        {
          fromAccountId: 1,
          toAccountId: 2,
          amountFrom: 1000,
          amountTo: 1000,
          occurredAt,
          description: "x",
        },
      ],
    );
    assert.deepEqual(
      toImport.map((r) => r.row),
      [2],
    );
    assert.deepEqual(skippedDuplicateRows, [1, 3]);
  });
});

describe("parseSkipRows", () => {
  it("accepts empty/undefined and rejects unknown rows", () => {
    assert.equal(parseSkipRows(undefined, [1, 2]).ok, true);
    assert.equal(parseSkipRows([1], [1, 2]).ok, true);
    const bad = parseSkipRows([9], [1, 2]);
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.match(bad.errors[0]!.message, /not in the CSV/);
  });
});
