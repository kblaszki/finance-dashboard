import type { Prisma, PrismaClient } from "@prisma/client";
import { TAX_CHECKLIST_ITEMS, taxCalendarDeadlines } from "./taxCalendar";
import { hasInvalidatedTaxYear } from "./taxReportCache";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function getTaxChecklist(
  db: DbClient,
  userId: number,
  taxYear: number,
): Promise<
  Array<{
    key: string;
    label: string;
    completed: boolean;
    completedAt: string | null;
  }>
> {
  const completed = await db.taxChecklistItem.findMany({
    where: { userId, taxYear },
  });
  const byKey = new Map(completed.map((row) => [row.itemKey, row]));
  return TAX_CHECKLIST_ITEMS.map((item) => {
    const row = byKey.get(item.key);
    return {
      key: item.key,
      label: item.label,
      completed: row != null,
      completedAt: row?.completedAt.toISOString() ?? null,
    };
  });
}

export async function setTaxChecklistItem(
  db: DbClient,
  userId: number,
  taxYear: number,
  itemKey: string,
  completed: boolean,
): Promise<void> {
  const valid = TAX_CHECKLIST_ITEMS.some((item) => item.key === itemKey);
  if (!valid) {
    throw new Error(`Invalid checklist item: ${itemKey}`);
  }
  if (!completed) {
    await db.taxChecklistItem.deleteMany({ where: { userId, taxYear, itemKey } });
    return;
  }
  await db.taxChecklistItem.upsert({
    where: { userId_taxYear_itemKey: { userId, taxYear, itemKey } },
    create: { userId, taxYear, itemKey },
    update: { completedAt: new Date() },
  });
}

export async function buildTaxCalendarResponse(
  db: DbClient,
  userId: number,
  taxYear: number,
) {
  const [checklist, correctionNeeded] = await Promise.all([
    getTaxChecklist(db, userId, taxYear),
    hasInvalidatedTaxYear(db, userId, taxYear),
  ]);
  return {
    taxYear,
    deadlines: taxCalendarDeadlines(taxYear),
    checklist,
    correctionNeeded,
  };
}
