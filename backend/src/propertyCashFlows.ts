import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest } from "./routes/httpSupport";
import { normalizeCurrency } from "./fx";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const PROPERTY_FLOW_TYPES = ["rent", "maintenance", "other"] as const;
export type PropertyFlowType = (typeof PROPERTY_FLOW_TYPES)[number];

const FLOW_SET = new Set<string>(PROPERTY_FLOW_TYPES);

export type PropertyCashFlowInput = {
  accountId: number;
  flowType: PropertyFlowType;
  amount: number;
  currency: string;
  occurredOn: Date;
  description?: string | null;
};

export function parsePropertyFlowType(value: unknown): PropertyFlowType {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!FLOW_SET.has(raw)) {
    throw badRequest(`Invalid flowType: ${raw}`);
  }
  return raw as PropertyFlowType;
}

async function assertRealEstateAccount(db: DbClient, userId: number, accountId: number) {
  const account = await db.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw badRequest("Invalid accountId");
  if (account.accountType !== "REAL_ESTATE") {
    throw badRequest("Property cash flows require a REAL_ESTATE account");
  }
  return account;
}

export async function listPropertyCashFlows(
  db: DbClient,
  userId: number,
  filters?: { accountId?: number; from?: Date; to?: Date },
) {
  return db.propertyCashFlow.findMany({
    where: {
      userId,
      ...(filters?.accountId ? { accountId: filters.accountId } : {}),
      ...(filters?.from || filters?.to
        ? {
            occurredOn: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    include: { account: { select: { id: true, name: true } } },
    orderBy: [{ occurredOn: "desc" }, { id: "desc" }],
  });
}

export async function getPropertyCashFlowForUser(db: DbClient, userId: number, id: number) {
  return db.propertyCashFlow.findFirst({
    where: { id, userId },
    include: { account: { select: { id: true, name: true } } },
  });
}

export async function createPropertyCashFlow(
  db: DbClient,
  userId: number,
  input: PropertyCashFlowInput,
) {
  await assertRealEstateAccount(db, userId, input.accountId);
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw badRequest("amount must be positive");
  }
  return db.propertyCashFlow.create({
    data: {
      userId,
      accountId: input.accountId,
      flowType: input.flowType,
      amount: input.amount,
      currency: normalizeCurrency(input.currency),
      occurredOn: input.occurredOn,
      description: input.description?.trim() || null,
    },
    include: { account: { select: { id: true, name: true } } },
  });
}

export async function updatePropertyCashFlow(
  db: DbClient,
  userId: number,
  id: number,
  input: Partial<PropertyCashFlowInput>,
) {
  const existing = await getPropertyCashFlowForUser(db, userId, id);
  if (!existing) throw badRequest("Property cash flow not found");
  if (input.accountId != null) await assertRealEstateAccount(db, userId, input.accountId);

  return db.propertyCashFlow.update({
    where: { id },
    data: {
      ...(input.accountId != null ? { accountId: input.accountId } : {}),
      ...(input.flowType != null ? { flowType: input.flowType } : {}),
      ...(input.amount != null ? { amount: input.amount } : {}),
      ...(input.currency != null ? { currency: normalizeCurrency(input.currency) } : {}),
      ...(input.occurredOn != null ? { occurredOn: input.occurredOn } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
    },
    include: { account: { select: { id: true, name: true } } },
  });
}

export async function deletePropertyCashFlow(
  db: DbClient,
  userId: number,
  id: number,
): Promise<void> {
  const existing = await getPropertyCashFlowForUser(db, userId, id);
  if (!existing) throw badRequest("Property cash flow not found");
  await db.propertyCashFlow.delete({ where: { id } });
}

export function serializePropertyCashFlow(row: {
  id: number;
  accountId: number;
  flowType: string;
  amount: unknown;
  currency: string;
  occurredOn: Date;
  description: string | null;
  createdAt: Date;
  account?: { id: number; name: string };
}) {
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    flowType: row.flowType,
    amount: Number(row.amount),
    currency: row.currency,
    occurredOn: row.occurredOn.toISOString(),
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  };
}
