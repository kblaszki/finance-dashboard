import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseOptionalTagIds,
  parseTagName,
  tagNameKey,
} from "./tags";

describe("tagNameKey / parseTagName", () => {
  it("normalizes name keys", () => {
    assert.equal(tagNameKey("  Work "), "work");
  });

  it("parses and rejects empty or oversized names", () => {
    assert.equal(parseTagName(" Personal "), "Personal");
    assert.throws(() => parseTagName(""), /name required/);
    assert.throws(() => parseTagName("x".repeat(81)), /at most 80/);
  });
});

describe("parseOptionalTagIds", () => {
  it("treats undefined as omit and null as empty", () => {
    assert.equal(parseOptionalTagIds(undefined), undefined);
    assert.deepEqual(parseOptionalTagIds(null), []);
  });

  it("accepts unique-looking arrays and rejects bad values", () => {
    assert.deepEqual(parseOptionalTagIds([1, 2, 1]), [1, 2, 1]);
    assert.throws(() => parseOptionalTagIds("1"), /array/);
    assert.throws(() => parseOptionalTagIds([0]), /valid ids/);
  });
});
