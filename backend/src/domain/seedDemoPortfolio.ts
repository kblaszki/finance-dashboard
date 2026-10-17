import { Prisma, type PrismaClient } from "@prisma/client";
import { categoryNameKey, seedDefaultCategories } from "./categories";
import {
  signedDelta,
  signedMinor,
  type CashTxType,
  type LedgerTxType,
} from "./cashLedger";
import { createTransfer } from "./cashTransfers";
import { quantizeMajorToMinor } from "./money";

/** Demo-only TRANSFER children under seeded "Internal transfer". */
const DEMO_TRANSFER_CHILDREN = [
  "Investment",
  "Credit card payment",
  "Retirement savings",
  "Travel FX",
] as const;

type Db = PrismaClient | Prisma.TransactionClient;

export const DEMO_ACCOUNT_NAMES = {
  checking: "Everyday Checking",
  euro: "Euro Travel",
  brokerage: "Brokerage Cash",
  crypto: "Crypto Spot",
  creditCard: "Everyday Credit Card",
  ike: "IKE Brokerage",
} as const;

export type DemoAccountKey = keyof typeof DEMO_ACCOUNT_NAMES;

/** Deterministic seed for mulberry32 PRNG. */
export const DEMO_LEDGER_RNG_SEED = "demo-portfolio-v2";
export const DEMO_LEDGER_MONTHS = 24;
export const DEMO_TXS_PER_ACCOUNT_MONTH = 5;
/** Fixed monthly checking → credit card payment (PLN). */
export const DEMO_CARD_PAYMENT = 450;
/** Fixed monthly checking → IKE contribution (PLN). */
export const DEMO_IKE_CONTRIBUTION = 500;

export const DEMO_OPENINGS: Record<DemoAccountKey, number> = {
  checking: 2500,
  euro: 400,
  brokerage: 10000,
  crypto: 1500,
  creditCard: -800,
  ike: 3000,
};

export type LedgerDeltaInput = {
  type: LedgerTxType;
  amount: number;
};

export type DemoPlannedTx = {
  accountKey: DemoAccountKey;
  type: CashTxType;
  amount: number;
  occurredAt: Date;
  description: string;
  category?: string;
};

export type DemoPlannedTransfer = {
  fromKey: DemoAccountKey;
  toKey: DemoAccountKey;
  amountFrom: number;
  /** Required when from/to currencies differ; omitted → equals amountFrom. */
  amountTo?: number;
  occurredAt: Date;
  description: string;
  /** TRANSFER-group category name (root or demo child). */
  category: string;
};

/** openingBalance + Σ signedDelta(type, amount). */
export function recomputeCashBalance(
  openingBalance: number,
  txs: LedgerDeltaInput[],
): Prisma.Decimal {
  let balance = new Prisma.Decimal(openingBalance);
  for (const tx of txs) {
    balance = balance.add(signedDelta(tx.type, new Prisma.Decimal(tx.amount)));
  }
  return balance;
}

/** Minor units matching what seedDemoPortfolio writes. */
export function recomputeCashMinor(
  openingBalance: number,
  txs: LedgerDeltaInput[],
): number {
  let minor = quantizeMajorToMinor(openingBalance, "openingBalance");
  for (const tx of txs) {
    const amount = quantizeMajorToMinor(tx.amount);
    minor += signedMinor(tx.type, amount);
  }
  return minor;
}

export function utcMonthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

/** Mid-month UTC timestamp for YYYY-MM (avoids month boundaries). */
export function utcMidMonth(monthKey: string, day = 15): Date {
  const year = Number(monthKey.slice(0, 4));
  const monthIndex = Number(monthKey.slice(5, 7)) - 1;
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

export function priorUtcMonthKey(monthKey: string): string {
  const year = Number(monthKey.slice(0, 4));
  const monthIndex = Number(monthKey.slice(5, 7)) - 1;
  const prior = new Date(Date.UTC(year, monthIndex - 1, 1));
  return prior.toISOString().slice(0, 7);
}

/** Oldest → newest YYYY-MM keys ending at endMonth (inclusive). */
export function listMonthsEndingAt(endMonth: string, n: number): string[] {
  const year = Number(endMonth.slice(0, 4));
  const monthIndex = Number(endMonth.slice(5, 7)) - 1;
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, monthIndex - i, 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }
  return months;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — deterministic [0, 1). */
export function createDemoRng(seed = DEMO_LEDGER_RNG_SEED): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function money(rng: () => number, min: number, max: number): number {
  const raw = min + rng() * (max - min);
  return Math.round(raw * 100) / 100;
}

function pickDay(rng: () => number, used: Set<number>): number {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const day = 1 + Math.floor(rng() * 28);
    if (!used.has(day)) {
      used.add(day);
      return day;
    }
  }
  for (let day = 1; day <= 28; day += 1) {
    if (!used.has(day)) {
      used.add(day);
      return day;
    }
  }
  return 1;
}

type MonthPlan = {
  type: CashTxType;
  amountMin: number;
  amountMax: number;
  description: string;
  category?: string;
};

function monthPlansForAccount(
  accountKey: DemoAccountKey,
  rng: () => number,
): MonthPlan[] {
  switch (accountKey) {
    case "checking":
      return [
        {
          type: "INCOME",
          amountMin: 5100,
          amountMax: 5400,
          description: "Monthly salary",
          category: "Salary",
        },
        {
          type: "EXPENSE",
          amountMin: 1700,
          amountMax: 1900,
          description: "Rent",
          category: "Housing",
        },
        {
          type: "EXPENSE",
          amountMin: 320,
          amountMax: 480,
          description: "Groceries",
          category: "Food",
        },
        {
          type: "EXPENSE",
          amountMin: 180,
          amountMax: 320,
          description: "Transit",
          category: "Transport",
        },
        rng() < 0.55
          ? {
              type: "EXPENSE",
              amountMin: 40,
              amountMax: 120,
              description: "Misc uncategorized",
            }
          : {
              type: "EXPENSE",
              amountMin: 60,
              amountMax: 150,
              description: "Household",
              category: "Other",
            },
      ];
    case "euro":
      return [
        {
          type: "INCOME",
          amountMin: 90,
          amountMax: 140,
          description: "EUR top-up",
          category: "Other income",
        },
        {
          type: "EXPENSE",
          amountMin: 18,
          amountMax: 45,
          description: "Café",
          category: "Food",
        },
        {
          type: "EXPENSE",
          amountMin: 22,
          amountMax: 55,
          description: "Train",
          category: "Transport",
        },
        {
          type: "EXPENSE",
          amountMin: 15,
          amountMax: 40,
          description: "Lunch",
          category: "Food",
        },
        rng() < 0.4
          ? {
              type: "EXPENSE",
              amountMin: 8,
              amountMax: 25,
              description: "Travel misc",
            }
          : {
              type: "EXPENSE",
              amountMin: 10,
              amountMax: 30,
              description: "Souvenirs",
              category: "Other",
            },
      ];
    case "brokerage":
      return [
        {
          type: "INCOME",
          amountMin: 220,
          amountMax: 420,
          description: "Dividend cash",
          category: "Other income",
        },
        {
          type: "EXPENSE",
          amountMin: 25,
          amountMax: 55,
          description: "Account fee",
          category: "Other",
        },
        {
          type: "INCOME",
          amountMin: 40,
          amountMax: 120,
          description: "Interest credit",
          category: "Other income",
        },
        {
          type: "EXPENSE",
          amountMin: 15,
          amountMax: 45,
          description: "Wire fee",
          category: "Other",
        },
        rng() < 0.35
          ? {
              type: "EXPENSE",
              amountMin: 10,
              amountMax: 35,
              description: "Brokerage misc",
            }
          : {
              type: "EXPENSE",
              amountMin: 12,
              amountMax: 40,
              description: "Platform fee",
              category: "Other",
            },
      ];
    case "crypto":
      return [
        {
          type: "INCOME",
          amountMin: 120,
          amountMax: 260,
          description: "Stablecoin yield",
          category: "Other income",
        },
        {
          type: "EXPENSE",
          amountMin: 12,
          amountMax: 40,
          description: "Network fee",
          category: "Other",
        },
        {
          type: "INCOME",
          amountMin: 30,
          amountMax: 90,
          description: "Airdrop cash-out",
          category: "Other income",
        },
        {
          type: "EXPENSE",
          amountMin: 8,
          amountMax: 28,
          description: "Withdrawal fee",
          category: "Other",
        },
        rng() < 0.4
          ? {
              type: "EXPENSE",
              amountMin: 5,
              amountMax: 22,
              description: "Crypto misc",
            }
          : {
              type: "EXPENSE",
              amountMin: 6,
              amountMax: 24,
              description: "Exchange fee",
              category: "Other",
            },
      ];
    case "creditCard":
      return [
        {
          type: "EXPENSE",
          amountMin: 100,
          amountMax: 220,
          description: "Online shopping",
          category: "Other",
        },
        {
          type: "EXPENSE",
          amountMin: 60,
          amountMax: 150,
          description: "Restaurant",
          category: "Food",
        },
        {
          type: "EXPENSE",
          amountMin: 80,
          amountMax: 180,
          description: "Card groceries",
          category: "Food",
        },
        {
          type: "EXPENSE",
          amountMin: 35,
          amountMax: 70,
          description: "Subscriptions",
          category: "Other",
        },
        rng() < 0.45
          ? {
              type: "EXPENSE",
              amountMin: 40,
              amountMax: 120,
              description: "Card misc",
            }
          : {
              type: "EXPENSE",
              amountMin: 50,
              amountMax: 110,
              description: "Fuel",
              category: "Transport",
            },
      ];
    case "ike":
      return [
        {
          type: "INCOME",
          amountMin: 8,
          amountMax: 28,
          description: "IKE interest credit",
          category: "Other income",
        },
        {
          type: "EXPENSE",
          amountMin: 2,
          amountMax: 8,
          description: "IKE account fee",
          category: "Other",
        },
        {
          type: "INCOME",
          amountMin: 12,
          amountMax: 40,
          description: "IKE dividend cash",
          category: "Other income",
        },
        {
          type: "EXPENSE",
          amountMin: 1,
          amountMax: 5,
          description: "IKE custody fee",
          category: "Other",
        },
        rng() < 0.35
          ? {
              type: "EXPENSE",
              amountMin: 1,
              amountMax: 6,
              description: "IKE misc",
            }
          : {
              type: "EXPENSE",
              amountMin: 2,
              amountMax: 7,
              description: "IKE platform fee",
              category: "Other",
            },
      ];
    default: {
      const _exhaustive: never = accountKey;
      return _exhaustive;
    }
  }
}

/**
 * Deterministic ledger: DEMO_LEDGER_MONTHS × DEMO_TXS_PER_ACCOUNT_MONTH
 * per demo account, ending at the UTC month of `now`.
 */
export function buildDemoLedgerTxs(now = new Date()): DemoPlannedTx[] {
  const rng = createDemoRng(DEMO_LEDGER_RNG_SEED);
  const months = listMonthsEndingAt(utcMonthKey(now), DEMO_LEDGER_MONTHS);
  const accountKeys = Object.keys(DEMO_ACCOUNT_NAMES) as DemoAccountKey[];
  const planned: DemoPlannedTx[] = [];

  for (const month of months) {
    for (const accountKey of accountKeys) {
      const plans = monthPlansForAccount(accountKey, rng);
      const usedDays = new Set<number>();
      for (const plan of plans) {
        const day = pickDay(rng, usedDays);
        planned.push({
          accountKey,
          type: plan.type,
          amount: money(rng, plan.amountMin, plan.amountMax),
          occurredAt: utcMidMonth(month, day),
          description: `${plan.description} (${month})`,
          ...(plan.category ? { category: plan.category } : {}),
        });
      }
    }
  }

  return planned;
}

/**
 * Deterministic internal transfers: showcase same-/cross-currency flows, plus
 * monthly credit-card payments and IKE contributions from checking.
 */
export function buildDemoTransfers(now = new Date()): DemoPlannedTransfer[] {
  const months = listMonthsEndingAt(utcMonthKey(now), DEMO_LEDGER_MONTHS);
  const recent = months[months.length - 1]!;
  const previous = months[months.length - 2] ?? recent;
  const older = months[months.length - 4] ?? months[0]!;

  const transfers: DemoPlannedTransfer[] = [
    {
      fromKey: "checking",
      toKey: "brokerage",
      amountFrom: 2500,
      occurredAt: utcMidMonth(older, 8),
      description: `Monthly invest transfer (${older})`,
      category: "Investment",
    },
    {
      fromKey: "checking",
      toKey: "euro",
      amountFrom: 1200,
      amountTo: 280,
      occurredAt: utcMidMonth(previous, 12),
      description: `EUR travel top-up (${previous})`,
      category: "Travel FX",
    },
    {
      fromKey: "checking",
      toKey: "crypto",
      amountFrom: 800,
      amountTo: 200,
      occurredAt: utcMidMonth(recent, 5),
      description: `USD crypto float (${recent})`,
      category: "Investment",
    },
    {
      fromKey: "brokerage",
      toKey: "checking",
      amountFrom: 500,
      occurredAt: utcMidMonth(recent, 20),
      description: `Cash back from brokerage (${recent})`,
      category: "Internal transfer",
    },
  ];

  for (const month of months) {
    transfers.push({
      fromKey: "checking",
      toKey: "creditCard",
      amountFrom: DEMO_CARD_PAYMENT,
      occurredAt: utcMidMonth(month, 25),
      description: `Credit card payment (${month})`,
      category: "Credit card payment",
    });
    transfers.push({
      fromKey: "checking",
      toKey: "ike",
      amountFrom: DEMO_IKE_CONTRIBUTION,
      occurredAt: utcMidMonth(month, 3),
      description: `IKE contribution (${month})`,
      category: "Retirement savings",
    });
  }

  return transfers;
}

async function wipeDemoPortfolio(db: Db, userId: number): Promise<void> {
  // CashTransfer Restricts account delete — clear headers (cascades legs) first.
  await db.cashTransfer.deleteMany({ where: { userId } });
  await db.account.deleteMany({ where: { userId } });
  await db.category.updateMany({
    where: { userId },
    data: { parentId: null },
  });
  await db.category.deleteMany({ where: { userId } });
}

async function categoryIdByNameType(
  db: Db,
  userId: number,
  name: string,
  ledgerType: "INCOME" | "EXPENSE" | "TRANSFER",
  parentId: number | null = null,
): Promise<number> {
  const row = await db.category.findFirst({
    where: { userId, name, ledgerType, parentId },
    select: { id: true },
  });
  if (!row) {
    throw new Error(`Demo seed missing category: ${ledgerType}/${name}`);
  }
  return row.id;
}

/** Children under Internal transfer for varied demo transfer tags. */
async function seedDemoTransferCategories(
  db: Db,
  userId: number,
  parentId: number,
): Promise<void> {
  for (const name of DEMO_TRANSFER_CHILDREN) {
    await db.category.create({
      data: {
        userId,
        name,
        parentId,
        ledgerType: "TRANSFER",
        nameKey: categoryNameKey(parentId, name),
      },
    });
  }
}

/**
 * Wipe and rebuild demo portfolio for userId (categories, accounts, cash txs,
 * internal transfers). Must be called with a demo (or test) user — scopes all
 * deletes by userId.
 */
export async function seedDemoPortfolio(
  db: Db,
  userId: number,
  now = new Date(),
): Promise<void> {
  await wipeDemoPortfolio(db, userId);
  await seedDefaultCategories(db, userId);

  const internalTransferId = await categoryIdByNameType(
    db,
    userId,
    "Internal transfer",
    "TRANSFER",
  );
  await seedDemoTransferCategories(db, userId, internalTransferId);

  const categoryMap: Record<string, number> = {
    Salary: await categoryIdByNameType(db, userId, "Salary", "INCOME"),
    "Other income": await categoryIdByNameType(
      db,
      userId,
      "Other income",
      "INCOME",
    ),
    Food: await categoryIdByNameType(db, userId, "Food", "EXPENSE"),
    Housing: await categoryIdByNameType(db, userId, "Housing", "EXPENSE"),
    Transport: await categoryIdByNameType(db, userId, "Transport", "EXPENSE"),
    Other: await categoryIdByNameType(db, userId, "Other", "EXPENSE"),
    "Internal transfer": internalTransferId,
    Investment: await categoryIdByNameType(
      db,
      userId,
      "Investment",
      "TRANSFER",
      internalTransferId,
    ),
    "Credit card payment": await categoryIdByNameType(
      db,
      userId,
      "Credit card payment",
      "TRANSFER",
      internalTransferId,
    ),
    "Retirement savings": await categoryIdByNameType(
      db,
      userId,
      "Retirement savings",
      "TRANSFER",
      internalTransferId,
    ),
    "Travel FX": await categoryIdByNameType(
      db,
      userId,
      "Travel FX",
      "TRANSFER",
      internalTransferId,
    ),
  };

  const accountSpecs: Record<
    DemoAccountKey,
    { accountType: string; currency: string; description: string }
  > = {
    checking: {
      accountType: "BANK",
      currency: "PLN",
      description: "Primary PLN checking — salary and everyday expenses",
    },
    euro: {
      accountType: "BANK",
      currency: "EUR",
      description: "EUR travel wallet — multi-currency stats demo",
    },
    brokerage: {
      accountType: "BROKERAGE",
      currency: "PLN",
      description: "Brokerage cash sleeve (no holdings yet)",
    },
    crypto: {
      accountType: "CRYPTO",
      currency: "USD",
      description: "Crypto spot cash (USD)",
    },
    creditCard: {
      accountType: "CREDIT_CARD",
      currency: "PLN",
      description: "Credit card — negative balance is amount owed",
    },
    ike: {
      accountType: "IKE",
      currency: "PLN",
      description: "IKE cash sleeve (holdings later)",
    },
  };

  const accountsByKey = {} as Record<DemoAccountKey, { id: number }>;
  for (const key of Object.keys(DEMO_ACCOUNT_NAMES) as DemoAccountKey[]) {
    const spec = accountSpecs[key];
    const opening = quantizeMajorToMinor(DEMO_OPENINGS[key], "openingBalance");
    accountsByKey[key] = await db.account.create({
      data: {
        userId,
        name: DEMO_ACCOUNT_NAMES[key],
        accountType: spec.accountType,
        currency: spec.currency,
        openingBalance: opening,
        cashBalance: opening,
        description: spec.description,
      },
    });
  }

  const planned = buildDemoLedgerTxs(now);
  const rows = planned.map((tx) => {
    const account = accountsByKey[tx.accountKey];
    const categoryId = tx.category ? categoryMap[tx.category] : null;
    return {
      accountId: account.id,
      type: tx.type,
      amount: quantizeMajorToMinor(tx.amount),
      occurredAt: tx.occurredAt,
      description: tx.description,
      categoryId: categoryId ?? null,
    };
  });

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await db.cashTransaction.createMany({
      data: rows.slice(i, i + chunkSize),
    });
  }

  const deltasByKey = new Map<DemoAccountKey, LedgerDeltaInput[]>();
  for (const tx of planned) {
    const list = deltasByKey.get(tx.accountKey) ?? [];
    list.push({ type: tx.type, amount: tx.amount });
    deltasByKey.set(tx.accountKey, list);
  }

  for (const key of Object.keys(DEMO_ACCOUNT_NAMES) as DemoAccountKey[]) {
    const cashBalance = recomputeCashMinor(
      DEMO_OPENINGS[key],
      deltasByKey.get(key) ?? [],
    );
    await db.account.update({
      where: { id: accountsByKey[key].id },
      data: { cashBalance },
    });
  }

  for (const transfer of buildDemoTransfers(now)) {
    const amountTo = transfer.amountTo ?? transfer.amountFrom;
    const categoryId = categoryMap[transfer.category];
    if (categoryId == null) {
      throw new Error(`Demo seed missing transfer category: ${transfer.category}`);
    }
    await createTransfer(db, userId, {
      fromAccountId: accountsByKey[transfer.fromKey].id,
      toAccountId: accountsByKey[transfer.toKey].id,
      amountFrom: new Prisma.Decimal(transfer.amountFrom.toString()),
      amountTo: new Prisma.Decimal(amountTo.toString()),
      occurredAt: transfer.occurredAt,
      description: transfer.description,
      categoryId,
    });
  }
}
