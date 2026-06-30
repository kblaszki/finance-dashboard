import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest } from "./routes/httpSupport";
import { normalizeCurrency } from "./fx";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const INCOME_EVENT_TYPES = [
  "dividend",
  "interest",
  "coupon",
  "capital_gain_distribution",
] as const;

export const INCOME_TAX_TYPES = ["belka", "pit38", "exempt"] as const;

export type IncomeEventType = (typeof INCOME_EVENT_TYPES)[number];
export type IncomeTaxType = (typeof INCOME_TAX_TYPES)[number];

const EVENT_SET = new Set<string>(INCOME_EVENT_TYPES);
const TAX_SET = new Set<string>(INCOME_TAX_TYPES);

export type IncomeEventInput = {
  accountId: number;
  instrumentId?: number | null;
  eventType: IncomeEventType;
  taxType?: IncomeTaxType | null;
  amount: number;
  currency: string;
  occurredOn: Date;
  description?: string | null;
  withheldTax?: number;
  sourceCountry?: string | null;
  foreignTaxPaid?: number;
};

export function parseIncomeEventType(value: unknown): IncomeEventType {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!EVENT_SET.has(raw)) {
    throw badRequest(`Invalid eventType: ${raw}`);
  }
  return raw as IncomeEventType;
}

export function parseIncomeTaxType(value: unknown): IncomeTaxType | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim().toLowerCase();
  if (!TAX_SET.has(raw)) {
    throw badRequest(`Invalid taxType: ${raw}`);
  }
  return raw as IncomeTaxType;
}

export function defaultTaxTypeForEvent(eventType: IncomeEventType): IncomeTaxType | null {
  if (eventType === "interest" || eventType === "coupon") return "belka";
  if (eventType === "dividend") return "pit38";
  return null;
}

export function isBelkaIncomeEvent(eventType: string, taxType: string | null | undefined): boolean {
  if (taxType === "belka") return true;
  if (taxType === "exempt" || taxType === "pit38") return false;
  return eventType === "interest" || eventType === "coupon";
}

export async function listUserIncomeEvents(
  db: DbClient,
  userId: number,
  filters?: { from?: Date; to?: Date; accountId?: number },
) {
  return db.incomeEvent.findMany({
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
    include: {
      account: { select: { id: true, name: true } },
      instrument: { select: { id: true, symbol: true, pitZgCountry: true } },
    },
    orderBy: [{ occurredOn: "desc" }, { id: "desc" }],
  });
}

export async function getIncomeEventForUser(db: DbClient, userId: number, id: number) {
  return db.incomeEvent.findFirst({
    where: { id, userId },
    include: {
      account: { select: { id: true, name: true } },
      instrument: { select: { id: true, symbol: true, pitZgCountry: true } },
    },
  });
}

async function assertAccountOwned(db: DbClient, userId: number, accountId: number) {
  const account = await db.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw badRequest("Invalid accountId");
  return account;
}

async function assertInstrumentOptional(db: DbClient, instrumentId: number | null | undefined) {
  if (instrumentId == null) return;
  const instrument = await db.instrument.findUnique({ where: { id: instrumentId } });
  if (!instrument) throw badRequest("Invalid instrumentId");
}

export async function createUserIncomeEvent(
  db: DbClient,
  userId: number,
  input: IncomeEventInput,
) {
  await assertAccountOwned(db, userId, input.accountId);
  await assertInstrumentOptional(db, input.instrumentId);
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw badRequest("amount must be positive");
  }
  const currency = normalizeCurrency(input.currency);
  const taxType = input.taxType ?? defaultTaxTypeForEvent(input.eventType);

  return db.incomeEvent.create({
    data: {
      userId,
      accountId: input.accountId,
      instrumentId: input.instrumentId ?? null,
      eventType: input.eventType,
      taxType,
      amount: input.amount,
      currency,
      occurredOn: input.occurredOn,
      description: input.description?.trim() || null,
      withheldTax: input.withheldTax ?? 0,
      sourceCountry: input.sourceCountry?.trim().toUpperCase() || null,
      foreignTaxPaid: input.foreignTaxPaid ?? 0,
    },
    include: {
      account: { select: { id: true, name: true } },
      instrument: { select: { id: true, symbol: true, pitZgCountry: true } },
    },
  });
}

export async function updateUserIncomeEvent(
  db: DbClient,
  userId: number,
  id: number,
  input: Partial<IncomeEventInput>,
) {
  const existing = await getIncomeEventForUser(db, userId, id);
  if (!existing) throw badRequest("Income event not found");

  if (input.accountId != null) await assertAccountOwned(db, userId, input.accountId);
  if (input.instrumentId !== undefined) await assertInstrumentOptional(db, input.instrumentId);

  return db.incomeEvent.update({
    where: { id },
    data: {
      ...(input.accountId != null ? { accountId: input.accountId } : {}),
      ...(input.instrumentId !== undefined ? { instrumentId: input.instrumentId } : {}),
      ...(input.eventType != null ? { eventType: input.eventType } : {}),
      ...(input.taxType !== undefined ? { taxType: input.taxType } : {}),
      ...(input.amount != null ? { amount: input.amount } : {}),
      ...(input.currency != null ? { currency: normalizeCurrency(input.currency) } : {}),
      ...(input.occurredOn != null ? { occurredOn: input.occurredOn } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.withheldTax != null ? { withheldTax: input.withheldTax } : {}),
      ...(input.sourceCountry !== undefined
        ? { sourceCountry: input.sourceCountry?.trim().toUpperCase() || null }
        : {}),
      ...(input.foreignTaxPaid != null ? { foreignTaxPaid: input.foreignTaxPaid } : {}),
    },
    include: {
      account: { select: { id: true, name: true } },
      instrument: { select: { id: true, symbol: true, pitZgCountry: true } },
    },
  });
}

export async function deleteUserIncomeEvent(db: DbClient, userId: number, id: number): Promise<void> {
  const existing = await getIncomeEventForUser(db, userId, id);
  if (!existing) throw badRequest("Income event not found");
  await db.incomeEvent.delete({ where: { id } });
}

export function serializeIncomeEvent(row: {
  id: number;
  accountId: number;
  instrumentId: number | null;
  eventType: string;
  taxType: string | null;
  amount: unknown;
  currency: string;
  occurredOn: Date;
  description: string | null;
  withheldTax: unknown;
  sourceCountry: string | null;
  foreignTaxPaid: unknown;
  createdAt: Date;
  account?: { id: number; name: string };
  instrument?: { id: number; symbol: string; pitZgCountry: string } | null;
}) {
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    instrumentId: row.instrumentId,
    instrumentSymbol: row.instrument?.symbol ?? null,
    instrumentCountry: row.instrument?.pitZgCountry ?? null,
    eventType: row.eventType,
    taxType: row.taxType,
    amount: Number(row.amount),
    currency: row.currency,
    occurredOn: row.occurredOn.toISOString(),
    description: row.description,
    withheldTax: Number(row.withheldTax ?? 0),
    sourceCountry: row.sourceCountry,
    foreignTaxPaid: Number(row.foreignTaxPaid ?? 0),
    createdAt: row.createdAt.toISOString(),
  };
}
