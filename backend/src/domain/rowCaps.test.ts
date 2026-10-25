import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpError } from "../lib/errors";
import {
  assertBalanceHistoryTxCap,
  assertExportRowCap,
  assertImportFingerprintScanCap,
  assertMonthListCap,
  assertStatsPeriodRowCap,
  assertTransferImportDedupScanCap,
  BALANCE_HISTORY_TX_CAP,
  CSV_EXPORT_ROW_CAP,
  IMPORT_FINGERPRINT_SCAN_LIMIT,
  MONTH_LIST_CAP,
  STATS_PERIOD_ROW_CAP,
  TRANSFER_IMPORT_DEDUP_SCAN_LIMIT,
} from "./rowCaps";

function expectBadRequest(fn: () => void, match: RegExp): void {
  try {
    fn();
    assert.fail("expected HttpError");
  } catch (e) {
    assert.ok(e instanceof HttpError);
    assert.equal(e.status, 400);
    assert.match(e.message, match);
  }
}

describe("rowCaps constants", () => {
  it("keeps hobby-scale soft caps stable", () => {
    assert.equal(CSV_EXPORT_ROW_CAP, 50_000);
    assert.equal(BALANCE_HISTORY_TX_CAP, 100_000);
    assert.equal(STATS_PERIOD_ROW_CAP, 50_000);
    assert.equal(MONTH_LIST_CAP, 2000);
    assert.equal(IMPORT_FINGERPRINT_SCAN_LIMIT, 50_000);
    assert.equal(TRANSFER_IMPORT_DEDUP_SCAN_LIMIT, 50_000);
  });
});

describe("rowCaps assert helpers", () => {
  it("allows counts at the cap and rejects cap+1", () => {
    assert.doesNotThrow(() => assertExportRowCap(CSV_EXPORT_ROW_CAP, "the ledger"));
    expectBadRequest(
      () => assertExportRowCap(CSV_EXPORT_ROW_CAP + 1, "the ledger"),
      /Export exceeds/,
    );

    assert.doesNotThrow(() => assertMonthListCap(MONTH_LIST_CAP, "transactions"));
    expectBadRequest(
      () => assertMonthListCap(MONTH_LIST_CAP + 1, "transactions"),
      /Month has more than/,
    );

    assert.doesNotThrow(() =>
      assertStatsPeriodRowCap(STATS_PERIOD_ROW_CAP, "Cash transactions"),
    );
    expectBadRequest(
      () => assertStatsPeriodRowCap(STATS_PERIOD_ROW_CAP + 1, "Cash transactions"),
      /narrow the period/,
    );

    assert.doesNotThrow(() =>
      assertBalanceHistoryTxCap(BALANCE_HISTORY_TX_CAP),
    );
    expectBadRequest(
      () => assertBalanceHistoryTxCap(BALANCE_HISTORY_TX_CAP + 1),
      /shorten history/,
    );

    assert.doesNotThrow(() =>
      assertImportFingerprintScanCap(IMPORT_FINGERPRINT_SCAN_LIMIT),
    );
    expectBadRequest(
      () => assertImportFingerprintScanCap(IMPORT_FINGERPRINT_SCAN_LIMIT + 1),
      /Too many ledger rows/,
    );

    assert.doesNotThrow(() =>
      assertTransferImportDedupScanCap(TRANSFER_IMPORT_DEDUP_SCAN_LIMIT),
    );
    expectBadRequest(
      () =>
        assertTransferImportDedupScanCap(TRANSFER_IMPORT_DEDUP_SCAN_LIMIT + 1),
      /Too many transfers/,
    );
  });
});
