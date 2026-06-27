/** When unset, registration stays enabled (local dev default). Set ALLOW_REGISTER=false in production. */
export function isRegisterAllowed(): boolean {
  const raw = process.env.ALLOW_REGISTER;
  if (raw == null || raw.trim() === "") return true;
  const v = raw.trim().toLowerCase();
  return v !== "false" && v !== "0" && v !== "no";
}
