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
