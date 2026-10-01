import test from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../lib/errors";
import { uid } from "./routeSupport";

test("uid throws 401 when userId is missing", () => {
  assert.throws(
    () => uid({} as never),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 401);
      return true;
    },
  );
});
