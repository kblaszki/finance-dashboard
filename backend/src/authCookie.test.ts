import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import {
  AUTH_COOKIE_NAME_HOST,
  AUTH_COOKIE_NAME_INSECURE,
  authCookieName,
  authCookieOptions,
  readAuthTokenFromRequest,
  shouldUseSecureAuthCookie,
} from "./authCookie";

test("authCookieName uses Host prefix only when secure", () => {
  assert.equal(authCookieName(true), AUTH_COOKIE_NAME_HOST);
  assert.equal(authCookieName(false), AUTH_COOKIE_NAME_INSECURE);
});

test("authCookieOptions are HttpOnly Lax Path=/", () => {
  const opts = authCookieOptions(true);
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.sameSite, "lax");
  assert.equal(opts.path, "/");
  assert.equal(opts.secure, true);
  assert.ok((opts.maxAge ?? 0) > 0);
});

test("shouldUseSecureAuthCookie respects production and req.secure", () => {
  const prev = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "test";
    assert.equal(
      shouldUseSecureAuthCookie({ secure: false } as Request),
      false,
    );
    assert.equal(
      shouldUseSecureAuthCookie({ secure: true } as Request),
      true,
    );
    process.env.NODE_ENV = "production";
    assert.equal(
      shouldUseSecureAuthCookie({ secure: false } as Request),
      true,
    );
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("readAuthTokenFromRequest prefers Host cookie", () => {
  const req = {
    cookies: {
      [AUTH_COOKIE_NAME_INSECURE]: "plain",
      [AUTH_COOKIE_NAME_HOST]: "host",
    },
  } as unknown as Request;
  assert.equal(readAuthTokenFromRequest(req), "host");
  assert.equal(
    readAuthTokenFromRequest({ cookies: {} } as unknown as Request),
    null,
  );
});
