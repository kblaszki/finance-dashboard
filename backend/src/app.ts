import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { convertAmount, getFxRatesPlnPerUnit, getMissingCurrencies } from "./fx";
import {
  AuthedRequest,
  hashPassword,
  normalizeEmail,
  requireAuth,
  signToken,
  validatePassword,
  verifyPassword,
} from "./auth";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

function normalizeCurrency(code: unknown): string {
  return String(code ?? "").trim().toUpperCase();
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (v && typeof v === "object") {
    const anyV = v as { toNumber?: () => number; toString?: () => string };
    if (typeof anyV.toNumber === "function") return anyV.toNumber();
    if (typeof anyV.toString === "function") return Number(anyV.toString());
  }
  return Number(v);
}

function budgetCategoryToDb(category: unknown): string {
  const c = String(category ?? "").trim();
  return c || "";
}

function budgetCategoryFromDb(category: string | null): string | null {
  if (!category) return null;
  return category;
}

function parseYearMonth(value: unknown): string | null {
  const ym = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  return ym;
}

function monthDateRange(yearMonth: string): { start: Date; end: Date } {
  const [y, m] = yearMonth.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end };
}

function parseDateQuery(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function transactionDateFilter(
  from?: unknown,
  to?: unknown,
): { gte?: Date; lte?: Date } | undefined {
  const fromDate = parseDateQuery(from);
  const toDate = parseDateQuery(to);
  if (!fromDate && !toDate) return undefined;

  const date: { gte?: Date; lte?: Date } = {};
  if (fromDate) {
    const gte = new Date(fromDate);
    gte.setHours(0, 0, 0, 0);
    date.gte = gte;
  }
  if (toDate) {
    const lte = new Date(toDate);
    lte.setHours(23, 59, 59, 999);
    date.lte = lte;
  }
  return date;
}

function yearMonthFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function listYearMonthsInRange(from: Date, to: Date): string[] {
  const months: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end) {
    months.push(yearMonthFromDate(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function serializeBudget(b: {
  id: number;
  userId: number;
  yearMonth: string;
  category: string | null;
  limitAmount: unknown;
  currency: string;
}) {
  return {
    id: b.id,
    userId: b.userId,
    yearMonth: b.yearMonth,
    category: budgetCategoryFromDb(b.category),
    limitAmount: toNumber(b.limitAmount),
    currency: normalizeCurrency(b.currency),
  };
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const passwordError = validatePassword(req.body.password);
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await hashPassword(String(req.body.password));
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });

    const token = signToken(user.id);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    if (error instanceof Error && error.message.includes("JWT_SECRET")) {
      return res.status(500).json({ error: "Server misconfigured" });
    }
    res.status(500).json({ error: "Failed to register" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password ?? "");
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user.id);
    res.json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    if (error instanceof Error && error.message.includes("JWT_SECRET")) {
      return res.status(500).json({ error: "Server misconfigured" });
    }
    res.status(500).json({ error: "Failed to login" });
  }
});

app.get("/api/auth/me", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, email: true },
    });
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    res.json(user);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

app.get("/api/transactions", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const { from, to, type, category, currency } = req.query;
    const displayCurrency = normalizeCurrency(currency);

    const where: {
      userId: number;
      date?: { gte?: Date; lte?: Date };
      type?: string;
      category?: string;
    } = { userId };

    if (from || to) {
      where.date = {};
      if (from) {
        where.date.gte = new Date(String(from));
      }
      if (to) {
        where.date.lte = new Date(String(to));
      }
    }

    if (type) {
      where.type = String(type).toUpperCase();
    }

    if (category) {
      where.category = String(category);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
    });

    if (!displayCurrency) {
      res.json(
        transactions.map((t) => ({
          ...t,
          amount: toNumber(t.amount),
          currency: normalizeCurrency(t.currency),
        })),
      );
      return;
    }

    const { plnPerUnit, asOf } = await getFxRatesPlnPerUnit();
    const missing = getMissingCurrencies(
      transactions.map((t) => normalizeCurrency(t.currency)),
      plnPerUnit,
    );
    if (missing.length) {
      res.status(400).json({
        error: "Missing FX rates for some currencies",
        missingCurrencies: missing,
        asOf,
      });
      return;
    }

    res.json(
      transactions.map((t) => {
        const amount = toNumber(t.amount);
        const fromCcy = normalizeCurrency(t.currency);
        const amountConverted = convertAmount(amount, fromCcy, displayCurrency, plnPerUnit);
        return {
          ...t,
          amount,
          currency: fromCcy,
          amountConverted,
          convertedCurrency: displayCurrency,
          fxAsOf: asOf,
        };
      }),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

app.post("/api/transactions", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const { type, amount, currency, category, date, description } = req.body;

    if (!type || !amount || !currency || !category || !date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const created = await prisma.transaction.create({
      data: {
        userId,
        type,
        amount,
        currency: normalizeCurrency(currency),
        category,
        date: new Date(date),
        description: description ?? null,
      },
    });

    res.status(201).json({
      ...created,
      amount: toNumber(created.amount),
      currency: normalizeCurrency(created.currency),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

app.put("/api/transactions/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const { type, amount, currency, category, date, description } = req.body;

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        type,
        amount,
        currency: currency ? normalizeCurrency(currency) : undefined,
        category,
        date: date ? new Date(date) : undefined,
        description,
      },
    });

    res.json({
      ...updated,
      amount: toNumber(updated.amount),
      currency: normalizeCurrency(updated.currency),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

app.delete("/api/transactions/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const result = await prisma.transaction.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

app.get("/api/portfolio", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const displayCurrency = normalizeCurrency(req.query.currency);

    const positions = await prisma.portfolioPosition.findMany({ where: { userId } });

    const normalized = positions.map((p) => ({
      ...p,
      quantity: toNumber(p.quantity),
      buyPrice: toNumber(p.buyPrice),
      currentPrice: toNumber(p.currentPrice),
      currency: normalizeCurrency(p.currency),
    }));

    if (!displayCurrency) {
      res.json(normalized);
      return;
    }

    const { plnPerUnit, asOf } = await getFxRatesPlnPerUnit();
    const missing = getMissingCurrencies(
      normalized.map((p) => p.currency),
      plnPerUnit,
    );
    if (missing.length) {
      res.status(400).json({
        error: "Missing FX rates for some currencies",
        missingCurrencies: missing,
        asOf,
      });
      return;
    }

    res.json(
      normalized.map((p) => {
        const fromCcy = p.currency;
        const buyPriceConverted = convertAmount(p.buyPrice, fromCcy, displayCurrency, plnPerUnit);
        const currentPriceConverted = convertAmount(
          p.currentPrice,
          fromCcy,
          displayCurrency,
          plnPerUnit,
        );
        const positionValue = p.quantity * p.currentPrice;
        const positionValueConverted = convertAmount(
          positionValue,
          fromCcy,
          displayCurrency,
          plnPerUnit,
        );
        return {
          ...p,
          buyPriceConverted,
          currentPriceConverted,
          positionValueConverted,
          convertedCurrency: displayCurrency,
          fxAsOf: asOf,
        };
      }),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to fetch portfolio positions" });
  }
});

app.post("/api/portfolio", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const { symbol, quantity, buyPrice, currentPrice, currency, category } = req.body;

    if (!symbol || !quantity || !buyPrice || !currentPrice || !currency) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const created = await prisma.portfolioPosition.create({
      data: {
        userId,
        symbol,
        quantity,
        buyPrice,
        currentPrice,
        currency: normalizeCurrency(currency),
        category: category ?? "UNSPECIFIED",
      },
    });

    res.status(201).json({
      ...created,
      quantity: toNumber(created.quantity),
      buyPrice: toNumber(created.buyPrice),
      currentPrice: toNumber(created.currentPrice),
      currency: normalizeCurrency(created.currency),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to create portfolio position" });
  }
});

app.put("/api/portfolio/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const existing = await prisma.portfolioPosition.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: "Portfolio position not found" });
    }

    const { symbol, quantity, buyPrice, currentPrice, currency, category } = req.body;

    const updated = await prisma.portfolioPosition.update({
      where: { id },
      data: {
        symbol,
        quantity,
        buyPrice,
        currentPrice,
        currency: currency ? normalizeCurrency(currency) : undefined,
        category,
      },
    });

    res.json({
      ...updated,
      quantity: toNumber(updated.quantity),
      buyPrice: toNumber(updated.buyPrice),
      currentPrice: toNumber(updated.currentPrice),
      currency: normalizeCurrency(updated.currency),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to update portfolio position" });
  }
});

app.delete("/api/portfolio/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const result = await prisma.portfolioPosition.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      return res.status(404).json({ error: "Portfolio position not found" });
    }
    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to delete portfolio position" });
  }
});

app.get("/api/budgets", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const yearMonth = req.query.yearMonth ? String(req.query.yearMonth) : undefined;
    const where: { userId: number; yearMonth?: string } = { userId };
    if (yearMonth) {
      if (!parseYearMonth(yearMonth)) {
        return res.status(400).json({ error: "Invalid yearMonth format (YYYY-MM)" });
      }
      where.yearMonth = yearMonth;
    }

    const budgets = await prisma.budget.findMany({
      where,
      orderBy: [{ yearMonth: "desc" }, { category: "asc" }],
    });

    res.json(budgets.map(serializeBudget));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to fetch budgets" });
  }
});

app.post("/api/budgets", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const yearMonth = parseYearMonth(req.body.yearMonth);
    const { limitAmount, currency } = req.body;
    const categoryDb = budgetCategoryToDb(req.body.category);

    if (!yearMonth || limitAmount == null || !currency) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const created = await prisma.budget.create({
      data: {
        userId,
        yearMonth,
        category: categoryDb,
        limitAmount,
        currency: normalizeCurrency(currency),
      },
    });

    res.status(201).json(serializeBudget(created));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return res.status(409).json({ error: "Budget already exists for this month and category" });
    }
    res.status(500).json({ error: "Failed to create budget" });
  }
});

app.put("/api/budgets/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const existing = await prisma.budget.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: "Budget not found" });
    }

    const yearMonth =
      req.body.yearMonth !== undefined ? parseYearMonth(req.body.yearMonth) : existing.yearMonth;
    if (req.body.yearMonth !== undefined && !yearMonth) {
      return res.status(400).json({ error: "Invalid yearMonth format (YYYY-MM)" });
    }

    const categoryDb =
      req.body.category !== undefined
        ? budgetCategoryToDb(req.body.category)
        : existing.category ?? "";

    const updated = await prisma.budget.update({
      where: { id },
      data: {
        yearMonth: yearMonth ?? undefined,
        category: categoryDb,
        limitAmount: req.body.limitAmount ?? undefined,
        currency: req.body.currency ? normalizeCurrency(req.body.currency) : undefined,
      },
    });

    res.json(serializeBudget(updated));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return res.status(409).json({ error: "Budget already exists for this month and category" });
    }
    res.status(500).json({ error: "Failed to update budget" });
  }
});

app.delete("/api/budgets/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const result = await prisma.budget.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      return res.status(404).json({ error: "Budget not found" });
    }
    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to delete budget" });
  }
});

app.get("/api/stats/summary", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const displayCurrency = normalizeCurrency(req.query.currency) || "PLN";
    const dateFilter = transactionDateFilter(req.query.from, req.query.to);
    const txWhere = dateFilter ? { userId, date: dateFilter } : { userId };

    const [transactions, portfolioPositions, txCount, fx] = await Promise.all([
      prisma.transaction.findMany({ where: txWhere }),
      prisma.portfolioPosition.findMany({ where: { userId } }),
      prisma.transaction.count({ where: txWhere }),
      getFxRatesPlnPerUnit(),
    ]);

    const allCurrencies = [
      ...transactions.map((t) => normalizeCurrency(t.currency)),
      ...portfolioPositions.map((p) => normalizeCurrency(p.currency)),
      displayCurrency,
    ];
    const missing = getMissingCurrencies(allCurrencies, fx.plnPerUnit);
    if (missing.length) {
      res.status(400).json({
        error: "Missing FX rates for some currencies",
        missingCurrencies: missing,
        fxAsOf: fx.asOf,
      });
      return;
    }

    let income = 0;
    let expenses = 0;

    for (const t of transactions) {
      const amount = toNumber(t.amount);
      const fromCcy = normalizeCurrency(t.currency);
      const converted = convertAmount(amount, fromCcy, displayCurrency, fx.plnPerUnit);
      if (t.type === "INCOME") income += converted;
      if (t.type === "EXPENSE") expenses += converted;
    }

    const balance = income - expenses;

    const portfolioValue = portfolioPositions.reduce((acc, p) => {
      const qty = toNumber(p.quantity);
      const price = toNumber(p.currentPrice);
      const fromCcy = normalizeCurrency(p.currency);
      const value = qty * price;
      return acc + convertAmount(value, fromCcy, displayCurrency, fx.plnPerUnit);
    }, 0);

    res.json({
      currency: displayCurrency,
      fxAsOf: fx.asOf,
      income,
      expenses,
      balance,
      portfolioValue,
      transactionsCount: txCount,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to compute summary stats" });
  }
});

async function aggregateByCategory(
  userId: number,
  type: "INCOME" | "EXPENSE",
  displayCurrency: string,
  from?: unknown,
  to?: unknown,
) {
  const dateFilter = transactionDateFilter(from, to);
  const where: {
    userId: number;
    type: string;
    date?: { gte?: Date; lte?: Date };
  } = { userId, type };
  if (dateFilter) where.date = dateFilter;

  const [rows, fx] = await Promise.all([
    prisma.transaction.findMany({ where }),
    getFxRatesPlnPerUnit(),
  ]);

  const missing = getMissingCurrencies(
    [...rows.map((t) => normalizeCurrency(t.currency)), displayCurrency],
    fx.plnPerUnit,
  );
  if (missing.length) {
    return {
      error: {
        status: 400,
        body: {
          error: "Missing FX rates for some currencies",
          missingCurrencies: missing,
          fxAsOf: fx.asOf,
        },
      },
    };
  }

  const byCategory = new Map<string, number>();
  for (const t of rows) {
    const amount = toNumber(t.amount);
    const fromCcy = normalizeCurrency(t.currency);
    const converted = convertAmount(amount, fromCcy, displayCurrency, fx.plnPerUnit);
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + converted);
  }

  return {
    data: [...byCategory.entries()].map(([category, amount]) => ({
      category,
      amount,
      currency: displayCurrency,
      fxAsOf: fx.asOf,
    })),
  };
}

app.get("/api/stats/expenses-by-category", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const displayCurrency = normalizeCurrency(req.query.currency) || "PLN";
    const result = await aggregateByCategory(
      req.userId!,
      "EXPENSE",
      displayCurrency,
      req.query.from,
      req.query.to,
    );
    if (result.error) {
      res.status(result.error.status).json(result.error.body);
      return;
    }
    res.json(result.data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to compute expenses by category" });
  }
});

app.get("/api/stats/income-by-category", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const displayCurrency = normalizeCurrency(req.query.currency) || "PLN";
    const result = await aggregateByCategory(
      req.userId!,
      "INCOME",
      displayCurrency,
      req.query.from,
      req.query.to,
    );
    if (result.error) {
      res.status(result.error.status).json(result.error.body);
      return;
    }
    res.json(result.data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to compute income by category" });
  }
});

app.get("/api/stats/cashflow-over-time", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const displayCurrency = normalizeCurrency(req.query.currency) || "PLN";
    const dateFilter = transactionDateFilter(req.query.from, req.query.to);

    if (!dateFilter?.gte || !dateFilter?.lte) {
      return res.status(400).json({ error: "from and to query parameters are required" });
    }

    const [transactions, fx] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, date: dateFilter },
      }),
      getFxRatesPlnPerUnit(),
    ]);

    const missing = getMissingCurrencies(
      [...transactions.map((t) => normalizeCurrency(t.currency)), displayCurrency],
      fx.plnPerUnit,
    );
    if (missing.length) {
      res.status(400).json({
        error: "Missing FX rates for some currencies",
        missingCurrencies: missing,
        fxAsOf: fx.asOf,
      });
      return;
    }

    const periods = listYearMonthsInRange(dateFilter.gte, dateFilter.lte);
    const incomeByPeriod = new Map<string, number>();
    const expensesByPeriod = new Map<string, number>();
    for (const p of periods) {
      incomeByPeriod.set(p, 0);
      expensesByPeriod.set(p, 0);
    }

    for (const t of transactions) {
      const period = yearMonthFromDate(new Date(t.date));
      const amount = toNumber(t.amount);
      const fromCcy = normalizeCurrency(t.currency);
      const converted = convertAmount(amount, fromCcy, displayCurrency, fx.plnPerUnit);
      if (t.type === "INCOME") {
        incomeByPeriod.set(period, (incomeByPeriod.get(period) ?? 0) + converted);
      }
      if (t.type === "EXPENSE") {
        expensesByPeriod.set(period, (expensesByPeriod.get(period) ?? 0) + converted);
      }
    }

    res.json(
      periods.map((period) => ({
        period,
        income: incomeByPeriod.get(period) ?? 0,
        expenses: expensesByPeriod.get(period) ?? 0,
        currency: displayCurrency,
        fxAsOf: fx.asOf,
      })),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to compute cashflow over time" });
  }
});

app.get("/api/stats/budget-progress", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const displayCurrency = normalizeCurrency(req.query.currency) || "PLN";
    const yearMonth =
      parseYearMonth(req.query.yearMonth) ||
      `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;

    const [budgets, fx] = await Promise.all([
      prisma.budget.findMany({ where: { userId, yearMonth } }),
      getFxRatesPlnPerUnit(),
    ]);

    if (budgets.length === 0) {
      res.json([]);
      return;
    }

    const { start, end } = monthDateRange(yearMonth);
    const expenses = await prisma.transaction.findMany({
      where: {
        userId,
        type: "EXPENSE",
        date: { gte: start, lte: end },
      },
    });

    const expenseCurrencies = [
      ...expenses.map((t) => normalizeCurrency(t.currency)),
      ...budgets.map((b) => normalizeCurrency(b.currency)),
      displayCurrency,
    ];
    const missing = getMissingCurrencies(expenseCurrencies, fx.plnPerUnit);
    if (missing.length) {
      res.status(400).json({
        error: "Missing FX rates for some currencies",
        missingCurrencies: missing,
        fxAsOf: fx.asOf,
      });
      return;
    }

    const progress = budgets.map((b) => {
      const limitAmount = convertAmount(
        toNumber(b.limitAmount),
        normalizeCurrency(b.currency),
        displayCurrency,
        fx.plnPerUnit,
      );

      const categoryFilter = budgetCategoryFromDb(b.category);
      const relevant = categoryFilter
        ? expenses.filter((e) => e.category === categoryFilter)
        : expenses;

      const spent = relevant.reduce((acc, t) => {
        const amount = toNumber(t.amount);
        const fromCcy = normalizeCurrency(t.currency);
        return acc + convertAmount(amount, fromCcy, displayCurrency, fx.plnPerUnit);
      }, 0);

      const remaining = limitAmount - spent;
      const percentUsed = limitAmount > 0 ? (spent / limitAmount) * 100 : 0;

      return {
        id: b.id,
        yearMonth: b.yearMonth,
        category: categoryFilter,
        limitAmount,
        spent,
        remaining,
        percentUsed,
        currency: displayCurrency,
        fxAsOf: fx.asOf,
      };
    });

    res.json(progress);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to compute budget progress" });
  }
});

app.get("/api/fx/rates", async (_req, res) => {
  try {
    const fx = await getFxRatesPlnPerUnit();
    res.json({
      base: "PLN",
      asOf: fx.asOf,
      plnPerUnit: fx.plnPerUnit,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to fetch FX rates" });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend server running on http://localhost:${PORT}`);
});
