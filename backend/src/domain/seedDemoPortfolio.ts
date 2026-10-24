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
import { tagNameKey } from "./tags";

/**
 * Cross-cutting trip/project/event tags — categories stay the spend type.
 * Demo example: "Italy trip 2026" groups Food + Transport + Shopping on one trip.
 */
export const DEMO_TAG_NAMES = [
  "Italy trip 2026",
  "Client offsite",
  "Home renovation",
  "Kids birthday",
  "Ski weekend",
  "Moving day",
] as const;

export type DemoTagName = (typeof DEMO_TAG_NAMES)[number];

/** Demo-only TRANSFER children under seeded "Internal transfer". */
const DEMO_TRANSFER_CHILDREN = [
  "Investment",
  "Credit card payment",
  "Retirement savings",
  "Travel FX",
] as const;

/** Nested demo taxonomy under flat roots (depth 2–3). Leaf names are unique per ledgerType. */
type DemoCategoryNest = {
  name: string;
  children?: DemoCategoryNest[];
};

const DEMO_NESTED_UNDER_ROOT: Record<
  string,
  { ledgerType: "INCOME" | "EXPENSE"; children: DemoCategoryNest[] }
> = {
  Salary: {
    ledgerType: "INCOME",
    children: [
      {
        name: "Primary job",
        children: [{ name: "Base salary" }],
      },
      { name: "Bonus" },
    ],
  },
  "Other income": {
    ledgerType: "INCOME",
    children: [
      {
        name: "Dividends",
        children: [{ name: "Equity dividends" }],
      },
      {
        name: "Yield",
        children: [{ name: "Interest credit" }],
      },
    ],
  },
  Food: {
    ledgerType: "EXPENSE",
    children: [
      {
        name: "Groceries",
        children: [{ name: "Supermarket" }, { name: "Markets" }],
      },
      {
        name: "Dining",
        children: [{ name: "Restaurants" }, { name: "Coffee" }],
      },
    ],
  },
  Housing: {
    ledgerType: "EXPENSE",
    children: [
      { name: "Rent" },
      {
        name: "Utilities",
        children: [{ name: "Electricity" }, { name: "Internet" }],
      },
    ],
  },
  Transport: {
    ledgerType: "EXPENSE",
    children: [
      { name: "Fuel" },
      {
        name: "Public transit",
        children: [{ name: "Monthly pass" }],
      },
    ],
  },
  Other: {
    ledgerType: "EXPENSE",
    children: [
      {
        name: "Household",
        children: [{ name: "Subscriptions" }],
      },
      {
        name: "Shopping",
        children: [{ name: "Online shopping" }],
      },
    ],
  },
};

/** Depth-3 leaves under TRANSFER child "Investment". */
const DEMO_INVESTMENT_LEAVES = ["Brokerage cash", "ETF contribution"] as const;

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
  /** Purpose/context tags (not categories); EXPENSE only in seed. */
  tags?: DemoTagName[];
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
  tags?: DemoTagName[];
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
          category: "Base salary",
        },
        {
          type: "EXPENSE",
          amountMin: 1700,
          amountMax: 1900,
          description: "Rent",
          category: "Rent",
          tags: ["Home renovation"],
        },
        {
          type: "EXPENSE",
          amountMin: 320,
          amountMax: 480,
          description: "Groceries",
          category: "Supermarket",
        },
        {
          type: "EXPENSE",
          amountMin: 180,
          amountMax: 320,
          description: "Transit",
          category: "Monthly pass",
        },
        rng() < 0.55
          ? {
              type: "EXPENSE" as const,
              amountMin: 40,
              amountMax: 120,
              description: "Misc uncategorized",
              ...(rng() < 0.35
                ? { tags: ["Kids birthday"] as DemoTagName[] }
                : {}),
            }
          : {
              type: "EXPENSE",
              amountMin: 60,
              amountMax: 150,
              description: "Household",
              category: "Subscriptions",
              tags: ["Home renovation"],
            },
      ];
    case "euro":
      return [
        {
          type: "INCOME",
          amountMin: 90,
          amountMax: 140,
          description: "EUR top-up",
          category: "Interest credit",
        },
        {
          type: "EXPENSE",
          amountMin: 18,
          amountMax: 45,
          description: "Café",
          category: "Coffee",
          tags: ["Italy trip 2026"],
        },
        {
          type: "EXPENSE",
          amountMin: 22,
          amountMax: 55,
          description: "Train",
          category: "Monthly pass",
          tags:
            rng() < 0.4
              ? ["Italy trip 2026", "Client offsite"]
              : ["Italy trip 2026"],
        },
        {
          type: "EXPENSE",
          amountMin: 15,
          amountMax: 40,
          description: "Lunch",
          category: "Restaurants",
          tags: ["Italy trip 2026"],
        },
        rng() < 0.4
          ? {
              type: "EXPENSE",
              amountMin: 8,
              amountMax: 25,
              description: "Travel misc",
              tags: ["Italy trip 2026"],
            }
          : {
              type: "EXPENSE",
              amountMin: 10,
              amountMax: 30,
              description: "Souvenirs",
              category: "Online shopping",
              tags: ["Italy trip 2026", "Kids birthday"],
            },
      ];
    case "brokerage":
      return [
        {
          type: "INCOME",
          amountMin: 220,
          amountMax: 420,
          description: "Dividend cash",
          category: "Equity dividends",
        },
        {
          type: "EXPENSE",
          amountMin: 25,
          amountMax: 55,
          description: "Account fee",
          category: "Subscriptions",
        },
        {
          type: "INCOME",
          amountMin: 40,
          amountMax: 120,
          description: "Interest credit",
          category: "Interest credit",
        },
        {
          type: "EXPENSE",
          amountMin: 15,
          amountMax: 45,
          description: "Wire fee",
          category: "Subscriptions",
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
              category: "Subscriptions",
            },
      ];
    case "crypto":
      return [
        {
          type: "INCOME",
          amountMin: 120,
          amountMax: 260,
          description: "Stablecoin yield",
          category: "Interest credit",
        },
        {
          type: "EXPENSE",
          amountMin: 12,
          amountMax: 40,
          description: "Network fee",
          category: "Subscriptions",
        },
        {
          type: "INCOME",
          amountMin: 30,
          amountMax: 90,
          description: "Airdrop cash-out",
          category: "Equity dividends",
        },
        {
          type: "EXPENSE",
          amountMin: 8,
          amountMax: 28,
          description: "Withdrawal fee",
          category: "Subscriptions",
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
              category: "Subscriptions",
            },
      ];
    case "creditCard":
      return [
        {
          type: "EXPENSE",
          amountMin: 100,
          amountMax: 220,
          description: "Online shopping",
          category: "Online shopping",
          tags: ["Moving day"],
        },
        {
          type: "EXPENSE" as const,
          amountMin: 60,
          amountMax: 150,
          description: "Restaurant",
          category: "Restaurants",
          ...(rng() < 0.3
            ? { tags: ["Kids birthday"] as DemoTagName[] }
            : {}),
        },
        {
          type: "EXPENSE",
          amountMin: 80,
          amountMax: 180,
          description: "Card groceries",
          category: "Supermarket",
        },
        {
          type: "EXPENSE",
          amountMin: 35,
          amountMax: 70,
          description: "Subscriptions",
          category: "Subscriptions",
        },
        rng() < 0.45
          ? {
              type: "EXPENSE" as const,
              amountMin: 40,
              amountMax: 120,
              description: "Card misc",
              ...(rng() < 0.5
                ? { tags: ["Moving day"] as DemoTagName[] }
                : {}),
            }
          : {
              type: "EXPENSE",
              amountMin: 50,
              amountMax: 110,
              description: "Fuel",
              category: "Fuel",
              tags: ["Ski weekend"],
            },
      ];
    case "ike":
      return [
        {
          type: "INCOME",
          amountMin: 8,
          amountMax: 28,
          description: "IKE interest credit",
          category: "Interest credit",
        },
        {
          type: "EXPENSE",
          amountMin: 2,
          amountMax: 8,
          description: "IKE account fee",
          category: "Subscriptions",
        },
        {
          type: "INCOME",
          amountMin: 12,
          amountMax: 40,
          description: "IKE dividend cash",
          category: "Equity dividends",
        },
        {
          type: "EXPENSE",
          amountMin: 1,
          amountMax: 5,
          description: "IKE custody fee",
          category: "Subscriptions",
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
              category: "Subscriptions",
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
          ...(plan.tags && plan.tags.length > 0 ? { tags: plan.tags } : {}),
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
      category: "Brokerage cash",
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
      category: "ETF contribution",
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
  await db.tag.deleteMany({ where: { userId } });
  await db.category.updateMany({
    where: { userId },
    data: { parentId: null },
  });
  await db.category.deleteMany({ where: { userId } });
}

/** Resolve by unique name within user + ledgerType (demo leaf names are unique). */
async function categoryIdByNameType(
  db: Db,
  userId: number,
  name: string,
  ledgerType: "INCOME" | "EXPENSE" | "TRANSFER",
): Promise<number> {
  const row = await db.category.findFirst({
    where: { userId, name, ledgerType },
    select: { id: true },
  });
  if (!row) {
    throw new Error(`Demo seed missing category: ${ledgerType}/${name}`);
  }
  return row.id;
}

async function createDemoCategoryChildren(
  db: Db,
  userId: number,
  parentId: number,
  ledgerType: "INCOME" | "EXPENSE" | "TRANSFER",
  nodes: DemoCategoryNest[],
): Promise<void> {
  for (const node of nodes) {
    const created = await db.category.create({
      data: {
        userId,
        name: node.name,
        parentId,
        ledgerType,
        nameKey: categoryNameKey(parentId, node.name),
      },
      select: { id: true },
    });
    if (node.children && node.children.length > 0) {
      await createDemoCategoryChildren(
        db,
        userId,
        created.id,
        ledgerType,
        node.children,
      );
    }
  }
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
 * Demo-only nesting under flat default roots (and Investment leaves) so
 * Statistics can exercise root rollup vs leaf detail (depth up to 3).
 */
async function seedDemoNestedCategories(
  db: Db,
  userId: number,
): Promise<void> {
  for (const [rootName, spec] of Object.entries(DEMO_NESTED_UNDER_ROOT)) {
    const root = await db.category.findFirst({
      where: {
        userId,
        name: rootName,
        ledgerType: spec.ledgerType,
        parentId: null,
      },
      select: { id: true },
    });
    if (!root) {
      throw new Error(`Demo seed missing root category "${rootName}"`);
    }
    await createDemoCategoryChildren(
      db,
      userId,
      root.id,
      spec.ledgerType,
      spec.children,
    );
  }

  const investment = await db.category.findFirst({
    where: { userId, name: "Investment", ledgerType: "TRANSFER" },
    select: { id: true },
  });
  if (!investment) {
    throw new Error('Demo seed missing category "Investment"');
  }
  await createDemoCategoryChildren(
    db,
    userId,
    investment.id,
    "TRANSFER",
    DEMO_INVESTMENT_LEAVES.map((name) => ({ name })),
  );
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
  await seedDemoNestedCategories(db, userId);

  const categoryMap: Record<string, number> = {
    "Base salary": await categoryIdByNameType(
      db,
      userId,
      "Base salary",
      "INCOME",
    ),
    "Equity dividends": await categoryIdByNameType(
      db,
      userId,
      "Equity dividends",
      "INCOME",
    ),
    "Interest credit": await categoryIdByNameType(
      db,
      userId,
      "Interest credit",
      "INCOME",
    ),
    Supermarket: await categoryIdByNameType(
      db,
      userId,
      "Supermarket",
      "EXPENSE",
    ),
    Restaurants: await categoryIdByNameType(
      db,
      userId,
      "Restaurants",
      "EXPENSE",
    ),
    Coffee: await categoryIdByNameType(db, userId, "Coffee", "EXPENSE"),
    Rent: await categoryIdByNameType(db, userId, "Rent", "EXPENSE"),
    "Monthly pass": await categoryIdByNameType(
      db,
      userId,
      "Monthly pass",
      "EXPENSE",
    ),
    Fuel: await categoryIdByNameType(db, userId, "Fuel", "EXPENSE"),
    Subscriptions: await categoryIdByNameType(
      db,
      userId,
      "Subscriptions",
      "EXPENSE",
    ),
    "Online shopping": await categoryIdByNameType(
      db,
      userId,
      "Online shopping",
      "EXPENSE",
    ),
    "Internal transfer": internalTransferId,
    "Brokerage cash": await categoryIdByNameType(
      db,
      userId,
      "Brokerage cash",
      "TRANSFER",
    ),
    "ETF contribution": await categoryIdByNameType(
      db,
      userId,
      "ETF contribution",
      "TRANSFER",
    ),
    "Credit card payment": await categoryIdByNameType(
      db,
      userId,
      "Credit card payment",
      "TRANSFER",
    ),
    "Retirement savings": await categoryIdByNameType(
      db,
      userId,
      "Retirement savings",
      "TRANSFER",
    ),
    "Travel FX": await categoryIdByNameType(
      db,
      userId,
      "Travel FX",
      "TRANSFER",
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

  const tagIdsByName: Record<string, number> = {};
  for (const name of DEMO_TAG_NAMES) {
    const tag = await db.tag.create({
      data: {
        userId,
        name,
        nameKey: tagNameKey(name),
      },
    });
    tagIdsByName[name] = tag.id;
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

  // Purpose tags from the plan (createMany order = planned order under SQLite).
  const ledgerRows = await db.cashTransaction.findMany({
    where: {
      account: { userId },
      transferId: null,
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (ledgerRows.length !== planned.length) {
    throw new Error(
      `Demo seed tag attach: expected ${planned.length} ledger rows, got ${ledgerRows.length}`,
    );
  }
  const tagLinks: Array<{ cashTransactionId: number; tagId: number }> = [];
  for (let i = 0; i < planned.length; i++) {
    const tags = planned[i]!.tags;
    if (!tags || tags.length === 0) continue;
    const cashTransactionId = ledgerRows[i]!.id;
    for (const name of tags) {
      const tagId = tagIdsByName[name];
      if (tagId == null) {
        throw new Error(`Demo seed missing tag "${name}"`);
      }
      tagLinks.push({ cashTransactionId, tagId });
    }
  }
  if (tagLinks.length > 0) {
    await db.cashTransactionTag.createMany({ data: tagLinks });
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
