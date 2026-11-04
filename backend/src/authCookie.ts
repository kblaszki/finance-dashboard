import type { CookieOptions, Request, Response } from "express";

/** 7 days — keep aligned with JWT_EXPIRES_IN in auth.ts */
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const AUTH_COOKIE_NAME_INSECURE = "fd_token";
export const AUTH_COOKIE_NAME_HOST = "__Host-fd_token";

export function shouldUseSecureAuthCookie(req: Request): boolean {
  return process.env.NODE_ENV === "production" || Boolean(req.secure);
}

export function authCookieName(secure: boolean): string {
  return secure ? AUTH_COOKIE_NAME_HOST : AUTH_COOKIE_NAME_INSECURE;
}

export function authCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    secure,
  };
}

/** Read JWT from cookie (prefer Host-prefixed name when both present). */
export function readAuthTokenFromRequest(req: Request): string | null {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  if (!cookies) return null;
  const host = cookies[AUTH_COOKIE_NAME_HOST];
  if (typeof host === "string" && host.length > 0) return host;
  const plain = cookies[AUTH_COOKIE_NAME_INSECURE];
  if (typeof plain === "string" && plain.length > 0) return plain;
  return null;
}

export function setAuthCookie(res: Response, req: Request, token: string): void {
  const secure = shouldUseSecureAuthCookie(req);
  res.cookie(authCookieName(secure), token, authCookieOptions(secure));
}

export function clearAuthCookie(res: Response, req: Request): void {
  const secure = shouldUseSecureAuthCookie(req);
  const opts = { ...authCookieOptions(secure), maxAge: 0 };
  res.clearCookie(authCookieName(secure), opts);
  // Clear the other name too so a Secure/non-Secure flip does not leave a stale cookie.
  res.clearCookie(
    authCookieName(!secure),
    { ...authCookieOptions(!secure), maxAge: 0 },
  );
}
