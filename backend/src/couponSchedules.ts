import type { Prisma, PrismaClient } from "@prisma/client";
import { createUserIncomeEvent } from "./incomeEvents";
import { badRequest } from "./routes/httpSupport";
import { normalizeCurrency } from "./fx";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const COUPON_SCHEDULE_TYPES = ["coupon", "amortization"] as const;
export type CouponScheduleType = (typeof COUPON_SCHEDULE_TYPES)[number];

const SCHEDULE_SET = new Set<string>(COUPON_SCHEDULE_TYPES);
const COUPON_INSTRUMENT_TYPES = new Set(["BOND", "ETF"]);

export type CouponScheduleInput = {
  accountId: number;
  instrumentId: number;
  scheduleType: CouponScheduleType;
  paymentOn: Date;
  amount: number;
  currency: string;
  description?: string | null;
};

export function parseCouponScheduleType(value: unknown): CouponScheduleType {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!SCHEDULE_SET.has(raw)) {
    throw badRequest(`Invalid scheduleType: ${raw}`);
  }
  return raw as CouponScheduleType;
}

async function assertBondOrEtfHolding(
  db: DbClient,
  userId: number,
  accountId: number,
  instrumentId: number,
) {
  const account = await db.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw badRequest("Invalid accountId");
  if (account.accountType !== "BROKERAGE") {
    throw badRequest("Coupon schedules require a BROKERAGE account");
  }

  const instrument = await db.instrument.findUnique({ where: { id: instrumentId } });
  if (!instrument) throw badRequest("Invalid instrumentId");
  if (!COUPON_INSTRUMENT_TYPES.has(instrument.instrumentType.toUpperCase())) {
    throw badRequest("Coupon schedules require a BOND or ETF instrument");
  }

  const holding = await db.holding.findFirst({
    where: { accountId, instrumentId, quantity: { gt: 0 } },
  });
  if (!holding) throw badRequest("No open holding for this instrument on the account");

  return { account, instrument };
}

export async function listCouponSchedules(
  db: DbClient,
  userId: number,
  filters?: { accountId?: number; instrumentId?: number; from?: Date; to?: Date },
) {
  return db.couponSchedule.findMany({
    where: {
      userId,
      ...(filters?.accountId ? { accountId: filters.accountId } : {}),
      ...(filters?.instrumentId ? { instrumentId: filters.instrumentId } : {}),
      ...(filters?.from || filters?.to
        ? {
            paymentOn: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    include: {
      account: { select: { id: true, name: true } },
      instrument: { select: { id: true, symbol: true, instrumentType: true } },
      incomeEvent: { select: { id: true, occurredOn: true } },
    },
    orderBy: [{ paymentOn: "asc" }, { id: "asc" }],
  });
}

export async function getCouponScheduleForUser(db: DbClient, userId: number, id: number) {
  return db.couponSchedule.findFirst({
    where: { id, userId },
    include: {
      account: { select: { id: true, name: true } },
      instrument: { select: { id: true, symbol: true, instrumentType: true } },
      incomeEvent: { select: { id: true, occurredOn: true } },
    },
  });
}

export async function createCouponSchedule(
  db: DbClient,
  userId: number,
  input: CouponScheduleInput,
) {
  await assertBondOrEtfHolding(db, userId, input.accountId, input.instrumentId);
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw badRequest("amount must be positive");
  }

  return db.couponSchedule.create({
    data: {
      userId,
      accountId: input.accountId,
      instrumentId: input.instrumentId,
      scheduleType: input.scheduleType,
      paymentOn: input.paymentOn,
      amount: input.amount,
      currency: normalizeCurrency(input.currency),
      description: input.description?.trim() || null,
    },
    include: {
      account: { select: { id: true, name: true } },
      instrument: { select: { id: true, symbol: true, instrumentType: true } },
      incomeEvent: { select: { id: true, occurredOn: true } },
    },
  });
}

export async function deleteCouponSchedule(db: DbClient, userId: number, id: number): Promise<void> {
  const existing = await getCouponScheduleForUser(db, userId, id);
  if (!existing) throw badRequest("Coupon schedule not found");
  if (existing.incomeEventId) {
    throw badRequest("Cannot delete a schedule that was already recorded as income");
  }
  await db.couponSchedule.delete({ where: { id } });
}

export async function recordCouponScheduleAsIncome(db: DbClient, userId: number, id: number) {
  const schedule = await getCouponScheduleForUser(db, userId, id);
  if (!schedule) throw badRequest("Coupon schedule not found");
  if (schedule.incomeEventId) throw badRequest("Already recorded as income");

  const eventType = schedule.scheduleType === "coupon" ? "coupon" : "interest";
  const income = await createUserIncomeEvent(db, userId, {
    accountId: schedule.accountId,
    instrumentId: schedule.instrumentId,
    eventType,
    amount: Number(schedule.amount),
    currency: schedule.currency,
    occurredOn: schedule.paymentOn,
    description: schedule.description ?? `Scheduled ${schedule.scheduleType}`,
  });

  return db.couponSchedule.update({
    where: { id },
    data: { incomeEventId: income.id },
    include: {
      account: { select: { id: true, name: true } },
      instrument: { select: { id: true, symbol: true, instrumentType: true } },
      incomeEvent: { select: { id: true, occurredOn: true } },
    },
  });
}

export function serializeCouponSchedule(row: {
  id: number;
  accountId: number;
  instrumentId: number;
  scheduleType: string;
  paymentOn: Date;
  amount: unknown;
  currency: string;
  description: string | null;
  incomeEventId: number | null;
  createdAt: Date;
  account?: { id: number; name: string };
  instrument?: { id: number; symbol: string; instrumentType: string };
  incomeEvent?: { id: number; occurredOn: Date } | null;
}) {
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    instrumentId: row.instrumentId,
    instrumentSymbol: row.instrument?.symbol ?? null,
    instrumentType: row.instrument?.instrumentType ?? null,
    scheduleType: row.scheduleType,
    paymentOn: row.paymentOn.toISOString(),
    amount: Number(row.amount),
    currency: row.currency,
    description: row.description,
    incomeEventId: row.incomeEventId,
    recorded: row.incomeEventId != null,
    createdAt: row.createdAt.toISOString(),
  };
}
