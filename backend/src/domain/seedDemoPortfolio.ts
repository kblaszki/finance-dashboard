import { Prisma, type PrismaClient } from "@prisma/client";
import { seedDefaultCategories } from "./categories";
import { signedDelta, type CashTxType } from "./cashLedger";

type Db = PrismaClient | Prisma.TransactionClient;

export const DEMO_ACCOUNT_NAMES = {
  checking: "Everyday Checking",
  euro: "Euro Travel",
  brokerage: "Brokerage Cash",
  crypto: "Crypto Spot",
} as const;

/** Expected Everyday Checking cashBalance after full demo seed. */
export const DEMO_CHECKING_CASH_BALANCE = 8155;
/** Euro Travel: 400 - 45 - 30 */
export const DEMO_EURO_CASH_BALANCE = 325;
/** Brokerage Cash: 10000 + 350 - 40 */
export const DEMO_BROKERAGE_CASH_BALANCE = 10310;
/** Crypto Spot: 1500 + 200 - 35 */
export const DEMO_CRYPTO_CASH_BALANCE = 1665;

export type LedgerDeltaInput = {
  type: CashTxType;
  amount: number;
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

async function wipeDemoPortfolio(db: Db, userId: number): Promise<void> {
  await db.account.deleteMany({ where: { userId } });
  await db.category.updateMany({
    where: { userId },
    data: { parentId: null },
  });
  await db.category.deleteMany({ where: { userId } });
}

async function categoryIdByParentChild(
  db: Db,
  userId: number,
  parentName: string,
  childName: string,
): Promise<number> {
  const parent = await db.category.findFirst({
    where: { userId, name: parentName, parentId: null },
    select: { id: true },
  });
  if (!parent) {
    throw new Error(`Demo seed missing parent category: ${parentName}`);
  }
  const child = await db.category.findFirst({
    where: { userId, name: childName, parentId: parent.id },
    select: { id: true },
  });
  if (!child) {
    throw new Error(`Demo seed missing category: ${parentName}/${childName}`);
  }
  return child.id;
}

type PlannedTx = {
  accountKey: keyof typeof DEMO_ACCOUNT_NAMES;
  type: CashTxType;
  amount: number;
  occurredAt: Date;
  description: string;
  category?: { parent: string; child: string };
};

function buildPlannedTxs(now = new Date()): PlannedTx[] {
  const current = utcMonthKey(now);
  const prior = priorUtcMonthKey(current);
  return [
    {
      accountKey: "checking",
      type: "INCOME",
      amount: 5200,
      occurredAt: utcMidMonth(current, 1),
      description: "Monthly salary",
      category: { parent: "Income", child: "Salary" },
    },
    {
      accountKey: "checking",
      type: "EXPENSE",
      amount: 420,
      occurredAt: utcMidMonth(current, 5),
      description: "Groceries",
      category: { parent: "Expense", child: "Food" },
    },
    {
      accountKey: "checking",
      type: "EXPENSE",
      amount: 1800,
      occurredAt: utcMidMonth(current, 3),
      description: "Rent",
      category: { parent: "Expense", child: "Housing" },
    },
    {
      accountKey: "checking",
      type: "EXPENSE",
      amount: 260,
      occurredAt: utcMidMonth(current, 8),
      description: "Transit pass",
      category: { parent: "Expense", child: "Transport" },
    },
    {
      accountKey: "checking",
      type: "EXPENSE",
      amount: 85,
      occurredAt: utcMidMonth(current, 12),
      description: "Misc uncategorized",
    },
    {
      accountKey: "checking",
      type: "INCOME",
      amount: 5200,
      occurredAt: utcMidMonth(prior, 1),
      description: "Monthly salary (prior)",
      category: { parent: "Income", child: "Salary" },
    },
    {
      accountKey: "checking",
      type: "EXPENSE",
      amount: 380,
      occurredAt: utcMidMonth(prior, 6),
      description: "Groceries (prior)",
      category: { parent: "Expense", child: "Food" },
    },
    {
      accountKey: "checking",
      type: "EXPENSE",
      amount: 1800,
      occurredAt: utcMidMonth(prior, 3),
      description: "Rent (prior)",
      category: { parent: "Expense", child: "Housing" },
    },
    {
      accountKey: "euro",
      type: "EXPENSE",
      amount: 45,
      occurredAt: utcMidMonth(current, 10),
      description: "Café",
      category: { parent: "Expense", child: "Food" },
    },
    {
      accountKey: "euro",
      type: "EXPENSE",
      amount: 30,
      occurredAt: utcMidMonth(current, 11),
      description: "Train",
      category: { parent: "Expense", child: "Transport" },
    },
    {
      accountKey: "brokerage",
      type: "INCOME",
      amount: 350,
      occurredAt: utcMidMonth(current, 7),
      description: "Dividend cash",
      category: { parent: "Income", child: "Other income" },
    },
    {
      accountKey: "brokerage",
      type: "EXPENSE",
      amount: 40,
      occurredAt: utcMidMonth(current, 9),
      description: "Account fee",
      category: { parent: "Expense", child: "Other" },
    },
    {
      accountKey: "crypto",
      type: "INCOME",
      amount: 200,
      occurredAt: utcMidMonth(current, 4),
      description: "Stablecoin yield",
      category: { parent: "Income", child: "Other income" },
    },
    {
      accountKey: "crypto",
      type: "EXPENSE",
      amount: 35,
      occurredAt: utcMidMonth(current, 14),
      description: "Network fee",
      category: { parent: "Expense", child: "Other" },
    },
  ];
}

/**
 * Wipe and rebuild demo portfolio for userId (categories, accounts, cash txs).
 * Must be called with a demo (or test) user — scopes all deletes by userId.
 */
export async function seedDemoPortfolio(db: Db, userId: number, now = new Date()): Promise<void> {
  await wipeDemoPortfolio(db, userId);
  await seedDefaultCategories(db, userId);

  const salaryId = await categoryIdByParentChild(db, userId, "Income", "Salary");
  const otherIncomeId = await categoryIdByParentChild(db, userId, "Income", "Other income");
  const foodId = await categoryIdByParentChild(db, userId, "Expense", "Food");
  const housingId = await categoryIdByParentChild(db, userId, "Expense", "Housing");
  const transportId = await categoryIdByParentChild(db, userId, "Expense", "Transport");
  const otherExpenseId = await categoryIdByParentChild(db, userId, "Expense", "Other");

  const categoryMap: Record<string, number> = {
    "Income/Salary": salaryId,
    "Income/Other income": otherIncomeId,
    "Expense/Food": foodId,
    "Expense/Housing": housingId,
    "Expense/Transport": transportId,
    "Expense/Other": otherExpenseId,
  };

  const checking = await db.account.create({
    data: {
      userId,
      name: DEMO_ACCOUNT_NAMES.checking,
      accountType: "BANK",
      currency: "PLN",
      openingBalance: 2500,
      cashBalance: 2500,
      description: "Primary PLN checking — salary and everyday expenses",
    },
  });
  const euro = await db.account.create({
    data: {
      userId,
      name: DEMO_ACCOUNT_NAMES.euro,
      accountType: "BANK",
      currency: "EUR",
      openingBalance: 400,
      cashBalance: 400,
      description: "EUR travel wallet — multi-currency stats demo",
    },
  });
  const brokerage = await db.account.create({
    data: {
      userId,
      name: DEMO_ACCOUNT_NAMES.brokerage,
      accountType: "BROKERAGE",
      currency: "PLN",
      openingBalance: 10000,
      cashBalance: 10000,
      description: "Brokerage cash sleeve (no holdings yet)",
    },
  });
  const crypto = await db.account.create({
    data: {
      userId,
      name: DEMO_ACCOUNT_NAMES.crypto,
      accountType: "CRYPTO",
      currency: "USD",
      openingBalance: 1500,
      cashBalance: 1500,
      description: "Crypto spot cash (USD)",
    },
  });

  const accounts = {
    checking,
    euro,
    brokerage,
    crypto,
  };

  const planned = buildPlannedTxs(now);
  const deltasByAccount = new Map<number, LedgerDeltaInput[]>();

  for (const tx of planned) {
    const account = accounts[tx.accountKey];
    const categoryId = tx.category
      ? categoryMap[`${tx.category.parent}/${tx.category.child}`]
      : null;
    await db.cashTransaction.create({
      data: {
        accountId: account.id,
        type: tx.type,
        amount: tx.amount,
        occurredAt: tx.occurredAt,
        description: tx.description,
        categoryId: categoryId ?? null,
      },
    });
    const list = deltasByAccount.get(account.id) ?? [];
    list.push({ type: tx.type, amount: tx.amount });
    deltasByAccount.set(account.id, list);
  }

  const openings: Record<number, number> = {
    [checking.id]: 2500,
    [euro.id]: 400,
    [brokerage.id]: 10000,
    [crypto.id]: 1500,
  };

  for (const [accountId, deltas] of deltasByAccount) {
    const cashBalance = recomputeCashBalance(openings[accountId] ?? 0, deltas);
    await db.account.update({
      where: { id: accountId },
      data: { cashBalance },
    });
  }
}
