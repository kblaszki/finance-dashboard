import test from "node:test";
import assert from "node:assert/strict";
import {
  cashImportFingerprint,
  fingerprintFromDraft,
  normalizeImportDescription,
  partitionDraftsByExisting,
  utcDayKey,
} from "./cashImportDedup";
import type { CashLedgerImportDraft } from "./cashLedgerCsvImport";

test("normalizeImportDescription trims collapses and lowercases", () => {
  assert.equal(normalizeImportDescription(null), "");
  assert.equal(normalizeImportDescription("  Foo   BAR  "), "foo bar");
});

test("cashImportFingerprint is stable for same semantic row", () => {
  const at = new Date("2026-01-15T12:00:00.000Z");
  const a = cashImportFingerprint({
    type: "expense",
    amountMinor: 1250,
    occurredAt: at,
    description: "  Sklep  ",
  });
  const b = cashImportFingerprint({
    type: "EXPENSE",
    amountMinor: 1250,
    occurredAt: new Date("2026-01-15T23:59:59.000Z"),
    description: "sklep",
  });
  assert.equal(a, b);
  assert.equal(utcDayKey(at), "2026-01-15");
});

function draft(
  partial: Partial<CashLedgerImportDraft> & Pick<CashLedgerImportDraft, "row">,
): CashLedgerImportDraft {
  return {
    type: "EXPENSE",
    amount: 12.5,
    occurredAt: new Date("2026-01-15T12:00:00.000Z"),
    description: "Sklep",
    categoryPath: null,
    ...partial,
  };
}

test("partitionDraftsByExisting skips ledger matches and intra-file dups", () => {
  const first = draft({ row: 1 });
  const twin = draft({ row: 2 });
  const other = draft({
    row: 3,
    description: "Other",
    amount: 5,
  });
  const existing = new Set([fingerprintFromDraft(first)]);
  const { toImport, skippedDuplicates } = partitionDraftsByExisting(
    [first, twin, other],
    existing,
  );
  assert.equal(toImport.length, 1);
  assert.equal(toImport[0]!.row, 3);
  assert.equal(skippedDuplicates.length, 2);
  assert.equal(skippedDuplicates[0]!.row, 1);
  assert.equal(skippedDuplicates[1]!.row, 2);
  assert.match(skippedDuplicates[0]!.message, /Already on this account/);
});

test("partitionDraftsByExisting imports all when empty ledger", () => {
  const rows = [draft({ row: 1 }), draft({ row: 2, description: "B" })];
  const { toImport, skippedDuplicates } = partitionDraftsByExisting(
    rows,
    new Set(),
  );
  assert.equal(toImport.length, 2);
  assert.equal(skippedDuplicates.length, 0);
});
