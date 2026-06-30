import test from "node:test";
import assert from "node:assert/strict";
import {
  getJwtSecret,
  normalizeEmail,
  parseLoginIdentifier,
  signToken,
  validatePassword,
  validateUsername,
  verifyToken,
} from "./auth";

const JWT_SECRET = "test-jwt-secret-must-be-at-least-32-characters";

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  User@Example.COM "), "user@example.com");
});

test("validatePassword accepts long passwords and rejects short ones", () => {
  assert.equal(validatePassword("password123"), null);
  assert.match(validatePassword("short")!, /8 characters/);
});

test("validateUsername enforces length and charset", () => {
  assert.match(validateUsername("ab")!, /3–32/);
  assert.equal(validateUsername("valid_user1"), null);
  assert.match(validateUsername("bad name")!, /letters/);
});

test("parseLoginIdentifier prefers login over email field", () => {
  assert.equal(parseLoginIdentifier({ login: "  alice ", email: "b@c.d" }), "alice");
  assert.equal(parseLoginIdentifier({ email: "b@c.d" }), "b@c.d");
});

test("verifyToken returns null for invalid token", () => {
  process.env.JWT_SECRET = JWT_SECRET;
  assert.equal(verifyToken("not-a-valid-token"), null);
});

test("signToken and verifyToken round-trip user id", () => {
  process.env.JWT_SECRET = JWT_SECRET;
  const token = signToken(42);
  assert.equal(verifyToken(token), 42);
});

test("getJwtSecret throws when missing or too short", () => {
  const original = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  assert.throws(() => getJwtSecret(), /JWT_SECRET/);

  process.env.JWT_SECRET = "short";
  assert.throws(() => getJwtSecret(), /JWT_SECRET/);

  if (original !== undefined) process.env.JWT_SECRET = original;
  else delete process.env.JWT_SECRET;
});
