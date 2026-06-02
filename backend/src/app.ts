import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { convertAmount, getFxRatesPlnPerUnit, getMissingCurrencies } from "./fx";
import {
  classifyMarketDataStatus,
  getLatestSnapshotsForSymbols,
  TwelveDataProvider,
  upsertPriceHistory,
} from "./marketData";
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
const MARKET_DATA_SOURCE = "twelve_data";
const MARKET_DATA_EXPIRE_DAYS = 7;
const MARKET_REFRESH_COOLDOWN_MS = 60 * 1000;
const lastManualRefreshAtByUser = new Map<number, number>();
let marketRefreshInFlight = false;

const twelveDataProvider = (() => {
  try {
    return new TwelveDataProvider();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Market data provider not initialized:", error);
    return null;
  }
})();

function normalizeCurrency(code: unknown): string {
  return String(code ?? "").trim().toUpperCase();
}

function normalizeSymbol(symbol: unknown): string {
  return String(symbol ?? "").trim().toUpperCase();
}

function startOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
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

function costBasisWeighted(
  lots: Array<{ quantity: unknown; buyPrice: unknown; currency: string }>,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
) {
  return lots.reduce((acc, l) => {
    const lotCost = toNumber(l.quantity) * toNumber(l.buyPrice);
    return acc + convertAmount(lotCost, normalizeCurrency(l.currency), displayCurrency, plnPerUnit);
  }, 0);
}

function costBasisFifo(
  lots: Array<{ quantity: unknown; buyPrice: unknown; currency: string }>,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
) {
  // FIFO lot valuation groundwork (equivalent to weighted while there are only BUY lots).
  const queue = lots.map((l) => ({
    qty: toNumber(l.quantity),
    buyPrice: toNumber(l.buyPrice),
    currency: normalizeCurrency(l.currency),
  }));
  let total = 0;
  for (const lot of queue) {
    total += convertAmount(lot.qty * lot.buyPrice, lot.currency, displayCurrency, plnPerUnit);
  }
  return total;
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
    const displayCurrency = normalizeCurrency(req.query.currency) || "PLN";
    const lots = await prisma.portfolioLot.findMany({
      where: { userId },
      orderBy: [{ symbol: "asc" }, { buyDate: "asc" }],
    });
    const symbols = [...new Set(lots.map((l) => normalizeSymbol(l.symbol)))];
    const snapshotsBySymbol = await getLatestSnapshotsForSymbols(prisma, symbols);
    const { plnPerUnit, asOf } = await getFxRatesPlnPerUnit();

    const missing = getMissingCurrencies(
      [
        displayCurrency,
        ...lots.map((l) => normalizeCurrency(l.currency)),
        ...[...snapshotsBySymbol.values()].map((s) => normalizeCurrency(s.currency)),
      ],
      plnPerUnit,
    );
    if (missing.length) {
      return res.status(400).json({ error: "Missing FX rates for some currencies", missingCurrencies: missing, asOf });
    }

    const lotsBySymbol = new Map<string, typeof lots>();
    for (const lot of lots) {
      const symbol = normalizeSymbol(lot.symbol);
      const arr = lotsBySymbol.get(symbol) ?? [];
      arr.push(lot);
      lotsBySymbol.set(symbol, arr);
    }

    const rows = symbols.map((symbol) => {
      const symbolLots = lotsBySymbol.get(symbol) ?? [];
      const quantity = symbolLots.reduce((acc, l) => acc + toNumber(l.quantity), 0);
      const weightedBuyPrice =
        quantity > 0
          ? symbolLots.reduce((acc, l) => acc + toNumber(l.quantity) * toNumber(l.buyPrice), 0) / quantity
          : 0;
      const snapshot = snapshotsBySymbol.get(symbol);
      const marketCurrency = normalizeCurrency(snapshot?.currency ?? symbolLots[0]?.currency ?? "USD");
      const lastClose = snapshot ? toNumber(snapshot.close) : null;
      const status = classifyMarketDataStatus(new Date(), snapshot?.priceDate, 2, MARKET_DATA_EXPIRE_DAYS);
      const positionCostConverted = symbolLots.reduce((acc, l) => {
        return (
          acc +
          convertAmount(
            toNumber(l.quantity) * toNumber(l.buyPrice),
            normalizeCurrency(l.currency),
            displayCurrency,
            plnPerUnit,
          )
        );
      }, 0);
      const positionValueConverted =
        lastClose != null
          ? convertAmount(quantity * lastClose, marketCurrency, displayCurrency, plnPerUnit)
          : null;
      const profitAbs = positionValueConverted != null ? positionValueConverted - positionCostConverted : null;
      const profitPct =
        positionValueConverted != null && positionCostConverted > 0
          ? (profitAbs! / positionCostConverted) * 100
          : null;

      return {
        id: symbol,
        symbol,
        quantity,
        buyPrice: weightedBuyPrice,
        buyDate: symbolLots[0]?.buyDate ?? null,
        currency: marketCurrency,
        category: symbolLots[0]?.category ?? "UNSPECIFIED",
        lotsCount: symbolLots.length,
        lastClose,
        lastCloseDate: snapshot?.priceDate ?? null,
        marketDataStatus: status,
        marketDataCurrency: marketCurrency,
        marketDataSource: snapshot?.source ?? MARKET_DATA_SOURCE,
        marketDataFetchedAt: snapshot?.fetchedAt ?? null,
        buyPriceConverted: convertAmount(weightedBuyPrice, marketCurrency, displayCurrency, plnPerUnit),
        currentPriceConverted:
          lastClose != null
            ? convertAmount(lastClose, marketCurrency, displayCurrency, plnPerUnit)
            : null,
        positionCostConverted,
        positionValueConverted,
        profitAbs,
        profitPct,
        convertedCurrency: displayCurrency,
        fxAsOf: asOf,
      };
    });

    res.json(rows);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to fetch portfolio positions" });
  }
});

app.post("/api/portfolio", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const { symbol, quantity, buyPrice, buyDate, currency, category } = req.body;
    if (!symbol || !quantity || !buyPrice || !buyDate || !currency) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const created = await prisma.portfolioLot.create({
      data: {
        userId,
        symbol: normalizeSymbol(symbol),
        quantity,
        buyPrice,
        buyDate: new Date(String(buyDate)),
        currency: normalizeCurrency(currency),
        category: category ?? "UNSPECIFIED",
      },
    });
    res.status(201).json({
      ...created,
      quantity: toNumber(created.quantity),
      buyPrice: toNumber(created.buyPrice),
      currency: normalizeCurrency(created.currency),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to create portfolio lot" });
  }
});

app.get("/api/portfolio/lots", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const lots = await prisma.portfolioLot.findMany({
      where: { userId },
      orderBy: [{ symbol: "asc" }, { buyDate: "desc" }],
    });
    res.json(
      lots.map((l) => ({
        ...l,
        symbol: normalizeSymbol(l.symbol),
        quantity: toNumber(l.quantity),
        buyPrice: toNumber(l.buyPrice),
        currency: normalizeCurrency(l.currency),
      })),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to fetch portfolio lots" });
  }
});

app.put("/api/portfolio/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const existing = await prisma.portfolioLot.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ error: "Portfolio lot not found" });

    const data: Record<string, unknown> = {};
    if (req.body.symbol !== undefined) data.symbol = normalizeSymbol(req.body.symbol);
    if (req.body.quantity !== undefined) data.quantity = req.body.quantity;
    if (req.body.buyPrice !== undefined) data.buyPrice = req.body.buyPrice;
    if (req.body.buyDate !== undefined) data.buyDate = new Date(String(req.body.buyDate));
    if (req.body.currency !== undefined) data.currency = normalizeCurrency(req.body.currency);
    if (req.body.category !== undefined) data.category = req.body.category;

    const updated = await prisma.portfolioLot.update({ where: { id }, data });
    res.json({
      ...updated,
      symbol: normalizeSymbol(updated.symbol),
      quantity: toNumber(updated.quantity),
      buyPrice: toNumber(updated.buyPrice),
      currency: normalizeCurrency(updated.currency),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to update portfolio lot" });
  }
});

app.delete("/api/portfolio/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const result = await prisma.portfolioLot.deleteMany({ where: { id, userId } });
    if (!result.count) return res.status(404).json({ error: "Portfolio lot not found" });
    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to delete portfolio lot" });
  }
});

app.get("/api/portfolio/:symbol/history", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const symbol = normalizeSymbol(req.params.symbol);
    const method = String(req.query.method ?? "weighted").toLowerCase();
    const displayCurrency = normalizeCurrency(req.query.currency) || "PLN";

    const lots = await prisma.portfolioLot.findMany({ where: { userId, symbol }, orderBy: { buyDate: "asc" } });
    const history = await prisma.marketPriceHistory.findMany({ where: { symbol }, orderBy: { priceDate: "asc" } });
    if (!lots.length || !history.length) return res.json([]);

    const { plnPerUnit } = await getFxRatesPlnPerUnit();
    const series = history.map((h) => {
      const day = new Date(h.priceDate);
      const activeLots = lots.filter((l) => new Date(l.buyDate) <= day);
      const qty = activeLots.reduce((acc, l) => acc + toNumber(l.quantity), 0);
      const close = toNumber(h.close);
      const closeCurrency = normalizeCurrency(h.currency);
      const positionValue = convertAmount(qty * close, closeCurrency, displayCurrency, plnPerUnit);
      const weightedCost = costBasisWeighted(activeLots, displayCurrency, plnPerUnit);
      const fifoCost = costBasisFifo(activeLots, displayCurrency, plnPerUnit);
      const costBasis = method === "fifo" ? fifoCost : weightedCost;
      const profitAbs = positionValue - costBasis;
      const profitPct = costBasis > 0 ? (profitAbs / costBasis) * 100 : 0;
      return { date: day, close, closeCurrency, quantity: qty, positionValue, costBasis, profitAbs, profitPct, currency: displayCurrency };
    });
    res.json(series);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to fetch portfolio history" });
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

    const [transactions, portfolioLots, txCount, fx] = await Promise.all([
      prisma.transaction.findMany({ where: txWhere }),
      prisma.portfolioLot.findMany({ where: { userId } }),
      prisma.transaction.count({ where: txWhere }),
      getFxRatesPlnPerUnit(),
    ]);
    const snapshotsBySymbol = await getLatestSnapshotsForSymbols(
      prisma,
      portfolioLots.map((p) => p.symbol),
    );

    const allCurrencies = [
      ...transactions.map((t) => normalizeCurrency(t.currency)),
      ...portfolioLots.map((p) => {
        const symbol = String(p.symbol).trim().toUpperCase();
        const snapshot = snapshotsBySymbol.get(symbol);
        return normalizeCurrency(snapshot?.currency ?? p.currency);
      }),
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

    let stalePositionsCount = 0;
    let pricedPositionsCount = 0;
    let portfolioValuationAsOf: Date | null = null;
    const portfolioValue = portfolioLots.reduce((acc, p) => {
      const qty = toNumber(p.quantity);
      const symbol = String(p.symbol).trim().toUpperCase();
      const snapshot = snapshotsBySymbol.get(symbol);
      const status = classifyMarketDataStatus(
        new Date(),
        snapshot?.priceDate,
        2,
        MARKET_DATA_EXPIRE_DAYS,
      );
      if (status === "stale") stalePositionsCount += 1;
      if (!snapshot || status === "missing" || status === "expired") {
        return acc;
      }
      pricedPositionsCount += 1;
      if (!portfolioValuationAsOf || snapshot.priceDate < portfolioValuationAsOf) {
        portfolioValuationAsOf = snapshot.priceDate;
      }
      const price = toNumber(snapshot.close);
      const fromCcy = normalizeCurrency(snapshot.currency);
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
      portfolioValueMarketDataAsOf: portfolioValuationAsOf,
      stalePositionsCount,
      pricedPositionsCount,
      totalPositionsCount: portfolioLots.length,
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

app.post("/api/market-data/refresh", requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!twelveDataProvider) {
      return res.status(503).json({
        error: "Market data provider is not configured",
      });
    }

    const userId = req.userId!;
    const now = Date.now();
    const lastRun = lastManualRefreshAtByUser.get(userId);
    if (lastRun && now - lastRun < MARKET_REFRESH_COOLDOWN_MS) {
      return res.status(429).json({
        error: "Refresh is cooling down. Try again in a minute.",
      });
    }
    if (marketRefreshInFlight) {
      return res.status(409).json({ error: "Market refresh already running" });
    }

    const payloadSymbols = Array.isArray(req.body?.symbols)
      ? req.body.symbols.map((s: unknown) => String(s))
      : [];
    const lotsForScope = await prisma.portfolioLot.findMany({
      select: { symbol: true, buyDate: true },
      where: payloadSymbols.length
        ? { symbol: { in: payloadSymbols.map((s) => normalizeSymbol(s)) } }
        : undefined,
    });
    const lotsBySymbol = new Map<string, Date>();
    for (const lot of lotsForScope) {
      const symbol = normalizeSymbol(lot.symbol);
      const currentMin = lotsBySymbol.get(symbol);
      const buyDate = new Date(lot.buyDate);
      if (!currentMin || buyDate < currentMin) {
        lotsBySymbol.set(symbol, buyDate);
      }
    }
    const symbols = [...lotsBySymbol.keys()];
    marketRefreshInFlight = true;
    let rowsInserted = 0;
    let rowsUpdated = 0;
    const errors: Array<{ symbol: string; error: string }> = [];
    for (const symbol of symbols) {
      try {
        const minBuy = lotsBySymbol.get(symbol)!;
        const startDate = startOfYear(minBuy);
        const latest = await prisma.marketPriceHistory.findFirst({
          where: { symbol },
          orderBy: { priceDate: "desc" },
        });
        const incrementalStart =
          latest && latest.priceDate > startDate
            ? new Date(new Date(latest.priceDate).getTime() + 24 * 60 * 60 * 1000)
            : startDate;
        const endDate = new Date();
        if (incrementalStart > endDate) continue;
        const points = await twelveDataProvider.fetchDailyHistory(symbol, incrementalStart, endDate);
        const upsertResult = await upsertPriceHistory(prisma, points);
        rowsInserted += upsertResult.insertedOrUpdated;
      } catch (error) {
        errors.push({
          symbol,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    marketRefreshInFlight = false;
    lastManualRefreshAtByUser.set(userId, now);
    res.json({
      source: twelveDataProvider.source,
      requested: symbols.length,
      symbolsProcessed: symbols.length - errors.length,
      rowsInserted,
      rowsUpdated,
      errors,
    });
  } catch (error) {
    marketRefreshInFlight = false;
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to refresh market data" });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend server running on http://localhost:${PORT}`);
});
