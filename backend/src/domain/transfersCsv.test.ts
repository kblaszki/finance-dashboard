import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTransfersCsv,
  parseTransfersCsv,
  TRANSFERS_CSV_HEADER,
  transfersExportFilename,
} from "./transfersCsv";

describe("buildTransfersCsv", () => {
  it("returns header-only CSV when rows are empty", () => {
    assert.equal(buildTransfersCsv([]), `${TRANSFERS_CSV_HEADER}\n`);
  });

  it("encodes same- and cross-currency rows with escaping", () => {
    const csv = buildTransfersCsv([
      {
        id: 1,
        occurredAt: "2024-06-15T12:00:00.000Z",
        fromAccount: "Checking",
        fromCurrency: "pln",
        toAccount: "Brokerage",
        toCurrency: "PLN",
        amountFrom: 100.5,
        amountTo: 100.5,
        description: "Move, cash",
        createdAt: "2024-06-15T12:01:00.000Z",
      },
      {
        id: 2,
        occurredAt: "2024-07-01T00:00:00.000Z",
        fromAccount: "Checking",
        fromCurrency: "PLN",
        toAccount: "Euro",
        toCurrency: "EUR",
        amountFrom: 400,
        amountTo: 90,
        description: "=1+1",
        createdAt: "2024-07-01T00:00:01.000Z",
      },
    ]);
    const lines = csv.trimEnd().split("\n");
    assert.equal(lines[0], TRANSFERS_CSV_HEADER);
    assert.equal(
      lines[1],
      '1,2024-06-15T12:00:00.000Z,Checking,PLN,Brokerage,PLN,100.50,100.50,"Move, cash",2024-06-15T12:01:00.000Z',
    );
    assert.match(lines[2]!, /,'=1\+1,/);
    assert.match(lines[2]!, /,400\.00,90\.00,/);
  });
});

describe("parseTransfersCsv", () => {
  it("round-trips build → parse", () => {
    const csv = buildTransfersCsv([
      {
        id: 99,
        occurredAt: "2024-06-15T12:00:00.000Z",
        fromAccount: "Checking",
        fromCurrency: "PLN",
        toAccount: "Euro",
        toCurrency: "EUR",
        amountFrom: 400,
        amountTo: 90.25,
        description: "\t=1+1",
        createdAt: "2024-06-15T12:01:00.000Z",
      },
    ]);
    const result = parseTransfersCsv(csv);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.drafts.length, 1);
    const d = result.drafts[0]!;
    assert.equal(d.fromName, "Checking");
    assert.equal(d.fromCurrency, "PLN");
    assert.equal(d.toName, "Euro");
    assert.equal(d.toCurrency, "EUR");
    assert.equal(Number(d.amountFrom), 400);
    assert.equal(Number(d.amountTo), 90.25);
    assert.equal(d.description, "\t=1+1");
    assert.equal(d.occurredAt.toISOString(), "2024-06-15T12:00:00.000Z");
  });

  it("defaults amountTo when currencies match and amountTo is empty", () => {
    const csv = [
      TRANSFERS_CSV_HEADER,
      ",2024-01-01T00:00:00.000Z,A,PLN,B,PLN,50.00,,note,",
    ].join("\n");
    const result = parseTransfersCsv(csv);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(Number(result.drafts[0]!.amountTo), 50);
  });

  it("rejects wrong header", () => {
    const result = parseTransfersCsv("a,b,c\n");
    assert.equal(result.ok, false);
  });

  it("rejects bad currency, non-positive amount, and bad date", () => {
    const csv = [
      TRANSFERS_CSV_HEADER,
      ",2024-01-01T00:00:00.000Z,A,PL,B,PLN,1.00,1.00,,",
      ",2024-01-01T00:00:00.000Z,A,PLN,B,PLN,0,,,",
      ",not-a-date,A,PLN,B,PLN,1.00,,,",
    ].join("\n");
    const result = parseTransfersCsv(csv);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.length, 3);
    assert.match(result.errors[0]!.message, /fromCurrency/);
    assert.match(result.errors[1]!.message, /amountFrom|positive/i);
    assert.match(result.errors[2]!.message, /occurredAt/);
  });

  it("rejects cross-currency without amountTo and same-currency mismatch", () => {
    const cross = [
      TRANSFERS_CSV_HEADER,
      ",2024-01-01T00:00:00.000Z,A,PLN,B,EUR,100.00,,,",
    ].join("\n");
    const crossResult = parseTransfersCsv(cross);
    assert.equal(crossResult.ok, false);
    if (!crossResult.ok) {
      assert.match(crossResult.errors[0]!.message, /amountTo required/);
    }

    const mismatch = [
      TRANSFERS_CSV_HEADER,
      ",2024-01-01T00:00:00.000Z,A,PLN,B,PLN,100.00,90.00,,",
    ].join("\n");
    const mismatchResult = parseTransfersCsv(mismatch);
    assert.equal(mismatchResult.ok, false);
    if (!mismatchResult.ok) {
      assert.match(mismatchResult.errors[0]!.message, /equal amountFrom/);
    }
  });

  it("accepts header-only CSV", () => {
    const result = parseTransfersCsv(`${TRANSFERS_CSV_HEADER}\n`);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.drafts.length, 0);
  });
});

describe("transfersExportFilename", () => {
  it("uses a stable filename", () => {
    assert.equal(transfersExportFilename(), "transfers.csv");
  });
});
