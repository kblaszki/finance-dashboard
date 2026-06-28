import test from "node:test";
import assert from "node:assert/strict";
import { isRegisterAllowed, assertProductionEnvironment } from "./authConfig";

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

test("assertProductionEnvironment requires JWT_SECRET and closed registration", () => {
  const prevNode = process.env.NODE_ENV;
  const prevJwt = process.env.JWT_SECRET;
  const prevReg = process.env.ALLOW_REGISTER;
  process.env.NODE_ENV = "production";
  process.env.JWT_SECRET = "short";
  delete process.env.ALLOW_REGISTER;
  try {
    assert.throws(() => assertProductionEnvironment(), /JWT_SECRET/);
    process.env.JWT_SECRET = "x".repeat(32);
    assert.throws(() => assertProductionEnvironment(), /ALLOW_REGISTER/);
    process.env.ALLOW_REGISTER = "false";
    assert.doesNotThrow(() => assertProductionEnvironment());
  } finally {
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
    if (prevJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevJwt;
    if (prevReg === undefined) delete process.env.ALLOW_REGISTER;
    else process.env.ALLOW_REGISTER = prevReg;
  }
});
