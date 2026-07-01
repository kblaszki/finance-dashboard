import type { Prisma, PrismaClient } from "@prisma/client";
import { toNumber } from "../accountValuation";
import { badRequest, notFound } from "../routes/httpSupport";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type LossCarryforwardRow = {
  taxYear: number;
  lossAmount: number;
  usedAmount: number;
  remainingAmount: number;
  note: string | null;
};

export type AppliedLoss = {
  taxYear: number;
  amount: number;
};

export function remainingLoss(lossAmount: number, usedAmount: number): number {
  return Math.max(0, lossAmount - usedAmount);
}

export function applyLossCarryforward(
  netGain: number,
  rows: Array<{ taxYear: number; lossAmount: number; usedAmount: number }>,
): { taxableGain: number; applied: AppliedLoss[] } {
  if (netGain <= 0) {
    return { taxableGain: netGain, applied: [] };
  }
  const sorted = [...rows].sort((a, b) => a.taxYear - b.taxYear);
  let taxable = netGain;
  const applied: AppliedLoss[] = [];
  for (const row of sorted) {
    const remaining = remainingLoss(row.lossAmount, row.usedAmount);
    if (remaining <= 0) continue;
    const take = Math.min(taxable, remaining);
    if (take <= 0) break;
    taxable -= take;
    applied.push({ taxYear: row.taxYear, amount: take });
  }
  return { taxableGain: taxable, applied };
}

export function serializeTaxLossCarryforward(row: {
  id: number;
  taxYear: number;
  lossAmount: unknown;
  usedAmount: unknown;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const lossAmount = toNumber(row.lossAmount);
  const usedAmount = toNumber(row.usedAmount);
  return {
    id: row.id,
    taxYear: row.taxYear,
    lossAmount,
    usedAmount,
    remainingAmount: remainingLoss(lossAmount, usedAmount),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTaxLossCarryforwards(db: DbClient, userId: number) {
  return db.taxLossCarryforward.findMany({
    where: { userId },
    orderBy: { taxYear: "asc" },
  });
}

export async function upsertTaxLossCarryforward(
  db: DbClient,
  userId: number,
  input: { taxYear: number; lossAmount: number; usedAmount?: number; note?: string | null },
) {
  if (!Number.isInteger(input.taxYear) || input.taxYear < 2000 || input.taxYear > 2100) {
    throw badRequest("taxYear must be between 2000 and 2100");
  }
  if (!Number.isFinite(input.lossAmount) || input.lossAmount < 0) {
    throw badRequest("lossAmount must be zero or positive");
  }
  const usedAmount = input.usedAmount ?? 0;
  if (!Number.isFinite(usedAmount) || usedAmount < 0) {
    throw badRequest("usedAmount must be zero or positive");
  }
  if (usedAmount > input.lossAmount) {
    throw badRequest("usedAmount cannot exceed lossAmount");
  }
  return db.taxLossCarryforward.upsert({
    where: { userId_taxYear: { userId, taxYear: input.taxYear } },
    create: {
      userId,
      taxYear: input.taxYear,
      lossAmount: input.lossAmount,
      usedAmount,
      note: input.note ?? null,
    },
    update: {
      lossAmount: input.lossAmount,
      usedAmount,
      note: input.note ?? null,
    },
  });
}

export async function deleteTaxLossCarryforward(db: DbClient, userId: number, id: number) {
  const row = await db.taxLossCarryforward.findFirst({ where: { id, userId } });
  if (!row) throw notFound("Loss carryforward row not found");
  await db.taxLossCarryforward.delete({ where: { id } });
}

export async function recordAppliedLosses(
  db: DbClient,
  userId: number,
  applied: AppliedLoss[],
): Promise<void> {
  for (const item of applied) {
    const row = await db.taxLossCarryforward.findUnique({
      where: { userId_taxYear: { userId, taxYear: item.taxYear } },
    });
    if (!row) continue;
    const nextUsed = toNumber(row.usedAmount) + item.amount;
    await db.taxLossCarryforward.update({
      where: { id: row.id },
      data: { usedAmount: nextUsed },
    });
  }
}

export function suggestLossRowForYear(taxYear: number, netRealized: number): {
  taxYear: number;
  lossAmount: number;
} | null {
  if (netRealized >= 0) return null;
  return { taxYear, lossAmount: Math.abs(netRealized) };
}
