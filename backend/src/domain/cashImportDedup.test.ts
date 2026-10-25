import test from "node:test";
import assert from "node:assert/strict";
import {
  cashImportFingerprint,
  fingerprintFromDraft,
  IMPORT_FINGERPRINT_SCAN_LIMIT,
  loadAccountImportFingerprints,
  normalizeImportDescription,
  occurredAtWindowForDrafts,
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

test("occurredAtWindowForDrafts pads one UTC day around min/max", () => {
  assert.equal(occurredAtWindowForDrafts([]), null);
  const window = occurredAtWindowForDrafts([
    draft({
      row: 1,
      occurredAt: new Date("2026-01-10T12:00:00.000Z"),
    }),
    draft({
      row: 2,
      occurredAt: new Date("2026-01-20T12:00:00.000Z"),
    }),
  ]);
  assert.ok(window);
  assert.equal(window!.gte.toISOString(), "2026-01-09T12:00:00.000Z");
  assert.equal(window!.lte.toISOString(), "2026-01-21T12:00:00.000Z");
  assert.ok(IMPORT_FINGERPRINT_SCAN_LIMIT >= 10_000);
});

test("loadAccountImportFingerprints fails closed when scan overflows", async () => {
  const stub = {
    cashTransaction: {
      findMany: async () =>
        Array.from({ length: IMPORT_FINGERPRINT_SCAN_LIMIT + 1 }, () => ({
          type: "EXPENSE",
          amount: 100,
          occurredAt: new Date("2024-01-01T00:00:00.000Z"),
          description: null,
        })),
    },
  };
  await assert.rejects(
    () =>
      loadAccountImportFingerprints(
        stub as never,
        1,
        {
          drafts: [
            {
              row: 1,
              type: "EXPENSE",
              amount: 1,
              occurredAt: new Date("2024-01-01T12:00:00.000Z"),
              description: null,
              categoryPath: null,
            },
          ],
        },
      ),
    /Too many ledger rows/,
  );
});
