import test from "node:test";
import assert from "node:assert/strict";
import {
  findMatchingPresetId,
  namedMappingFromResolved,
  parsePresetName,
  parseStoredMapping,
  presetNameKey,
  serializeNamedMapping,
  toColumnMappingBody,
} from "./csvImportPresets";

test("parsePresetName and presetNameKey", () => {
  assert.equal(parsePresetName("  mBank  "), "mBank");
  assert.equal(presetNameKey("mBank"), "mbank");
  assert.throws(() => parsePresetName(""), /name required/);
  assert.throws(() => parsePresetName("x".repeat(81)), /at most 80/);
});

test("serializeNamedMapping stores header names", () => {
  const headers = ["Data", "Kwota", "Opis"];
  const named = serializeNamedMapping(headers, {
    occurredAt: 0,
    amount: 1,
    description: 2,
    amountSignMode: "negativeIsExpense",
  });
  assert.deepEqual(named, {
    occurredAt: "Data",
    amount: "Kwota",
    description: "Opis",
    type: null,
    categoryPath: null,
    amountSignMode: "negativeIsExpense",
  });
});

test("serializeNamedMapping accepts name refs", () => {
  const headers = ["Date", "Amount", "Type"];
  const named = serializeNamedMapping(headers, {
    occurredAt: "Date",
    amount: "Amount",
    type: "Type",
  });
  assert.equal(named.type, "Type");
  assert.equal(named.amountSignMode, undefined);
});

test("parseStoredMapping round-trips JSON", () => {
  const stored = {
    occurredAt: "Data",
    amount: "Kwota",
    description: null,
    type: null,
    categoryPath: null,
    amountSignMode: "negativeIsIncome" as const,
  };
  const parsed = parseStoredMapping(JSON.stringify(stored));
  assert.deepEqual(parsed, stored);
  assert.throws(() => parseStoredMapping("{"), /invalid/);
  assert.throws(
    () =>
      parseStoredMapping(
        JSON.stringify({ occurredAt: "D", amount: "K" }),
      ),
    /amountSignMode/,
  );
});

test("toColumnMappingBody omits null optionals", () => {
  const body = toColumnMappingBody({
    occurredAt: "Data",
    amount: "Kwota",
    description: null,
    type: null,
    categoryPath: null,
    amountSignMode: "negativeIsExpense",
  });
  assert.deepEqual(body, {
    occurredAt: "Data",
    amount: "Kwota",
    amountSignMode: "negativeIsExpense",
  });
});

test("namedMappingFromResolved requires amountSignMode without type", () => {
  assert.throws(
    () =>
      namedMappingFromResolved(
        { occurredAt: 0, amount: 1 },
        ["Date", "Amount"],
      ),
    /amountSignMode/,
  );
});

test("findMatchingPresetId matches when all mapped headers present", () => {
  const mappingJson = JSON.stringify({
    occurredAt: "Data",
    amount: "Kwota",
    description: "Opis",
    type: null,
    categoryPath: null,
    amountSignMode: "negativeIsExpense",
  });
  const id = findMatchingPresetId(
    [{ id: 7, mappingJson }],
    ["Data", "Kwota", "Opis", "Extra"],
  );
  assert.equal(id, 7);
  assert.equal(
    findMatchingPresetId([{ id: 7, mappingJson }], ["Data", "Kwota"]),
    null,
  );
});
