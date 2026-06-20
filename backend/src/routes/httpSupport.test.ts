import test from "node:test";
import assert from "node:assert/strict";
import {
  HttpError,
  badRequest,
  handleRouteError,
  parseFiniteNumber,
  parseRequiredString,
} from "./httpSupport";

test("parseRequiredString rejects empty values", () => {
  assert.throws(() => parseRequiredString("  ", "name"), (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 400);
    return true;
  });
});

test("parseFiniteNumber rejects non-finite values", () => {
  assert.throws(() => parseFiniteNumber("abc", "amount"), (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.message, "amount must be a valid number");
    return true;
  });
});

test("handleRouteError maps HttpError status", () => {
  const response = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  handleRouteError(response as never, badRequest("Invalid date"), "fallback");
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: "Invalid date" });
});
