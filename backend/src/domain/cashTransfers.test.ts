import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { signedMinor } from "./cashLedger";
import { parseTransferInput, type OwnedAccountRef } from "./cashTransfers";

function accounts(
  ...rows: Array<{ id: number; currency: string }>
): Map<number, OwnedAccountRef> {
  return new Map(rows.map((row) => [row.id, row]));
}

test("signedMinor credits TRANSFER_IN and debits TRANSFER_OUT", () => {
  assert.equal(signedMinor("TRANSFER_IN", 500), 500);
  assert.equal(signedMinor("TRANSFER_OUT", 500), -500);
});

test("parseTransferInput same currency defaults amountTo to amountFrom", () => {
  const input = parseTransferInput(
    { fromAccountId: 1, toAccountId: 2, amountFrom: 100 },
    accounts({ id: 1, currency: "PLN" }, { id: 2, currency: "PLN" }),
  );
  assert.equal(input.amountFrom.toNumber(), 100);
  assert.equal(input.amountTo.toNumber(), 100);
});

test("parseTransferInput same currency rejects mismatched amountTo", () => {
  assert.throws(
    () =>
      parseTransferInput(
        { fromAccountId: 1, toAccountId: 2, amountFrom: 100, amountTo: 90 },
        accounts({ id: 1, currency: "PLN" }, { id: 2, currency: "PLN" }),
      ),
    /amountTo must equal amountFrom/,
  );
});

test("parseTransferInput cross currency requires amountTo", () => {
  assert.throws(
    () =>
      parseTransferInput(
        { fromAccountId: 1, toAccountId: 2, amountFrom: 100 },
        accounts({ id: 1, currency: "PLN" }, { id: 2, currency: "EUR" }),
      ),
    /amountTo required when currencies differ/,
  );

  const input = parseTransferInput(
    { fromAccountId: 1, toAccountId: 2, amountFrom: 400, amountTo: 100 },
    accounts({ id: 1, currency: "PLN" }, { id: 2, currency: "EUR" }),
  );
  assert.equal(input.amountFrom.toNumber(), 400);
  assert.equal(input.amountTo.toNumber(), 100);
});

test("parseTransferInput rejects same account and foreign account", () => {
  assert.throws(
    () =>
      parseTransferInput(
        { fromAccountId: 1, toAccountId: 1, amountFrom: 10 },
        accounts({ id: 1, currency: "PLN" }),
      ),
    /must be different/,
  );
  assert.throws(
    () =>
      parseTransferInput(
        { fromAccountId: 1, toAccountId: 99, amountFrom: 10 },
        accounts({ id: 1, currency: "PLN" }),
      ),
    /Account not found/,
  );
});

test("parseTransferInput patch keeps cross-currency amountTo when unchanged", () => {
  const existing = {
    fromAccountId: 1,
    toAccountId: 2,
    amountFrom: new Prisma.Decimal("400"),
    amountTo: new Prisma.Decimal("100"),
    occurredAt: new Date("2026-08-01T00:00:00.000Z"),
    description: "old",
  };
  const input = parseTransferInput(
    { description: "new" },
    accounts({ id: 1, currency: "PLN" }, { id: 2, currency: "EUR" }),
    existing,
  );
  assert.equal(input.amountFrom.toNumber(), 400);
  assert.equal(input.amountTo.toNumber(), 100);
  assert.equal(input.description, "new");
});
