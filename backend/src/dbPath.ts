import path from "node:path";

export function resolveSqlitePath(databaseUrl: string, cwd = process.cwd()): string {
  const trimmed = databaseUrl.trim();
  const match = /^file:(.+)$/.exec(trimmed);
  if (!match) {
    throw new Error("Only file: SQLite DATABASE_URL is supported for backup");
  }
  const filePath = match[1];
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(cwd, filePath);
}
