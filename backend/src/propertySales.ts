import type { Prisma, PrismaClient } from "@prisma/client";
import { toNumber } from "./accountValuation";
import { convertAmount, normalizeCurrency } from "./fx";
import { badRequest, notFound } from "./routes/httpSupport";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const RENTAL_TAX_METHODS = ["scale", "lump_sum_8_5"] as const;
export type RentalTaxMethod = (typeof RENTAL_TAX_METHODS)[number];

const RENTAL_SET = new Set<string>(RENTAL_TAX_METHODS);

export function parseRentalTaxMethod(value: unknown): RentalTaxMethod {
  const raw = String(value ?? "scale").trim().toLowerCase();
  if (!RENTAL_SET.has(raw)) {
    throw badRequest(`Invalid rentalTaxMethod: ${raw}`);
  }
  return raw as RentalTaxMethod;
}

export function computePropertySaleTaxableGain(row: {
  proceeds: number;
  acquisitionCost: number;
  improvementsCost: number;
  fiveYearExemption: boolean;
}): number {
  if (row.fiveYearExemption) return 0;
  return row.proceeds - row.acquisitionCost - row.improvementsCost;
}

export function computeRentalTaxableBase(
  method: RentalTaxMethod,
  rentalIncome: number,
  maintenanceCosts: number,
): number {
  if (method === "lump_sum_8_5") {
    return rentalIncome * 0.085;
  }
  return Math.max(0, rentalIncome - maintenanceCosts);
}

export function serializePropertySale(row: {
  id: number;
  accountId: number;
  soldOn: Date;
  proceeds: unknown;
  acquisitionCost: unknown;
  improvementsCost: unknown;
  fiveYearExemption: boolean;
  currency: string;
  description: string | null;
  createdAt: Date;
  account?: { name: string };
}) {
  const proceeds = toNumber(row.proceeds);
  const acquisitionCost = toNumber(row.acquisitionCost);
  const improvementsCost = toNumber(row.improvementsCost);
  const taxableGain = computePropertySaleTaxableGain({
    proceeds,
    acquisitionCost,
    improvementsCost,
    fiveYearExemption: row.fiveYearExemption,
  });
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    soldOn: row.soldOn.toISOString(),
    proceeds,
    acquisitionCost,
    improvementsCost,
    fiveYearExemption: row.fiveYearExemption,
    taxableGain,
    currency: row.currency,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  };
}

export type PropertySaleInput = {
  accountId: number;
  soldOn: Date;
  proceeds: number;
  acquisitionCost: number;
  improvementsCost?: number;
  fiveYearExemption?: boolean;
  currency: string;
  description?: string | null;
};

async function assertRealEstateAccount(db: DbClient, userId: number, accountId: number) {
  const account = await db.account.findFirst({
    where: { id: accountId, userId },
    select: { id: true, accountType: true, name: true },
  });
  if (!account) throw notFound("Account not found");
  if (account.accountType !== "REAL_ESTATE") {
    throw badRequest("Property sales require a REAL_ESTATE account");
  }
  return account;
}

export async function listPropertySales(
  db: DbClient,
  userId: number,
  filters?: { accountId?: number; from?: Date; to?: Date },
) {
  return db.propertySale.findMany({
    where: {
      userId,
      ...(filters?.accountId ? { accountId: filters.accountId } : {}),
      ...(filters?.from || filters?.to
        ? {
            soldOn: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    include: { account: { select: { name: true } } },
    orderBy: [{ soldOn: "desc" }, { id: "desc" }],
  });
}

export async function createPropertySale(db: DbClient, userId: number, input: PropertySaleInput) {
  await assertRealEstateAccount(db, userId, input.accountId);
  return db.propertySale.create({
    data: {
      userId,
      accountId: input.accountId,
      soldOn: input.soldOn,
      proceeds: input.proceeds,
      acquisitionCost: input.acquisitionCost,
      improvementsCost: input.improvementsCost ?? 0,
      fiveYearExemption: input.fiveYearExemption ?? false,
      currency: normalizeCurrency(input.currency),
      description: input.description ?? null,
    },
    include: { account: { select: { name: true } } },
  });
}

export async function deletePropertySale(db: DbClient, userId: number, id: number) {
  const row = await db.propertySale.findFirst({ where: { id, userId } });
  if (!row) throw notFound("Property sale not found");
  await db.propertySale.delete({ where: { id } });
}

export async function aggregatePropertySalesForYear(
  db: DbClient,
  userId: number,
  taxYear: number,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
) {
  const start = new Date(Date.UTC(taxYear, 0, 1));
  const end = new Date(Date.UTC(taxYear, 11, 31, 23, 59, 59, 999));
  const rows = await db.propertySale.findMany({
    where: { userId, soldOn: { gte: start, lte: end } },
    include: { account: { select: { name: true } } },
  });
  let totalTaxableGain = 0;
  const serialized = rows.map((row) => {
    const item = serializePropertySale(row);
    totalTaxableGain += convertAmount(item.taxableGain, item.currency, displayCurrency, plnPerUnit);
    return item;
  });
  return { rows: serialized, totalTaxableGain };
}
