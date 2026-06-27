import test from "node:test";
import assert from "node:assert/strict";
import { isRegisterAllowed } from "./authConfig";

function withEnv(value: string | undefined, fn: () => void): void {
  const prev = process.env.ALLOW_REGISTER;
  if (value === undefined) delete process.env.ALLOW_REGISTER;
  else process.env.ALLOW_REGISTER = value;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.ALLOW_REGISTER;
    else process.env.ALLOW_REGISTER = prev;
  }
}

test("isRegisterAllowed defaults to true when unset", () => {
  withEnv(undefined, () => assert.equal(isRegisterAllowed(), true));
});

test("isRegisterAllowed respects false values", () => {
  for (const v of ["false", "FALSE", "0", "no"]) {
    withEnv(v, () => assert.equal(isRegisterAllowed(), false));
  }
});

test("isRegisterAllowed allows explicit true", () => {
  withEnv("true", () => assert.equal(isRegisterAllowed(), true));
});
