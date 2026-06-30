import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function invalidateTaxReportSnapshots(
  db: DbClient,
  userId: number,
  taxYear: number,
): Promise<void> {
  await db.taxReportSnapshot.updateMany({
    where: { userId, taxYear, invalidatedAt: null },
    data: { invalidatedAt: new Date() },
  });
}

export async function invalidateTaxYearsForDate(
  db: DbClient,
  userId: number,
  date: Date,
): Promise<void> {
  await invalidateTaxReportSnapshots(db, userId, date.getUTCFullYear());
}

export async function saveTaxReportSnapshot(
  db: DbClient,
  userId: number,
  taxYear: number,
  payload: unknown,
): Promise<void> {
  await db.taxReportSnapshot.create({
    data: {
      userId,
      taxYear,
      payload: JSON.stringify(payload),
    },
  });
}

export async function getLatestTaxReportSnapshot(
  db: DbClient,
  userId: number,
  taxYear: number,
): Promise<{ computedAt: Date; payload: unknown; invalidatedAt: Date | null } | null> {
  const row = await db.taxReportSnapshot.findFirst({
    where: { userId, taxYear },
    orderBy: { computedAt: "desc" },
  });
  if (!row) return null;
  let payload: unknown = null;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    payload = null;
  }
  return {
    computedAt: row.computedAt,
    payload,
    invalidatedAt: row.invalidatedAt,
  };
}

export async function hasInvalidatedTaxYear(
  db: DbClient,
  userId: number,
  taxYear: number,
): Promise<boolean> {
  const count = await db.taxReportSnapshot.count({
    where: { userId, taxYear, invalidatedAt: { not: null } },
  });
  return count > 0;
}

export function correctionBannerMessage(taxYear: number): string {
  return `Tax year ${taxYear} may require PIT correction — underlying data changed since last snapshot (FR-048).`;
}
