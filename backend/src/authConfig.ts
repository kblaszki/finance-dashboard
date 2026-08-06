/** When unset, registration stays enabled (local dev default). Set ALLOW_REGISTER=false in production. */
export function isRegisterAllowed(): boolean {
  const raw = process.env.ALLOW_REGISTER;
  if (raw == null || raw.trim() === "") return true;
  const v = raw.trim().toLowerCase();
  return v !== "false" && v !== "0" && v !== "no";
}

/** Fail fast when production is misconfigured (open registration or missing JWT). */
export function assertProductionEnvironment(): void {
  if (process.env.NODE_ENV !== "production") return;

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters in production");
  }
  if (isRegisterAllowed()) {
    throw new Error(
      "ALLOW_REGISTER must be false in production — set ALLOW_REGISTER=false after creating your user",
    );
  }
}

/**
 * Express `trust proxy` setting for correct client IP behind reverse proxies.
 * - Unset: `1` in production, `false` otherwise
 * - `false` / `0` / `no`: disabled
 * - `true` / `yes`: one hop
 * - integer: hop count
 */
export function resolveTrustProxySetting(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  raw: string | undefined = process.env.TRUST_PROXY,
): boolean | number {
  const trimmed = raw?.trim();
  if (trimmed != null && trimmed !== "") {
    const lower = trimmed.toLowerCase();
    if (lower === "false" || lower === "0" || lower === "no") return false;
    if (lower === "true" || lower === "yes") return 1;
    const n = Number(trimmed);
    if (Number.isInteger(n) && n >= 0) return n;
    return 1;
  }
  return nodeEnv === "production" ? 1 : false;
}
