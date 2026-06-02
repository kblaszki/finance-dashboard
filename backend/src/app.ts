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
import { computePortfolioCashBalance } from "./portfolioCash";

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
  lots: Array<{ side: string; quantity: unknown; tradePrice: unknown; currency: string }>,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
) {
  let qty = 0;
  let cost = 0;
  for (const l of lots) {
    const q = toNumber(l.quantity);
    const lotCost = convertAmount(
      q * toNumber(l.tradePrice),
      normalizeCurrency(l.currency),
      displayCurrency,
      plnPerUnit,
    );
    if (l.side === "BUY") {
      qty += q;
      cost += lotCost;
    } else {
      const sellQty = Math.min(q, qty);
      const avgCost = qty > 0 ? cost / qty : 0;
      qty -= sellQty;
      cost -= avgCost * sellQty;
    }
  }
  return cost;
}

function costBasisFifo(
  lots: Array<{ side: string; quantity: unknown; tradePrice: unknown; currency: string }>,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
) {
  const queue: Array<{ qty: number; unitCost: number }> = [];
  for (const l of lots) {
    const q = toNumber(l.quantity);
    const unitCost = convertAmount(
      toNumber(l.tradePrice),
      normalizeCurrency(l.currency),
      displayCurrency,
      plnPerUnit,
    );
    if (l.side === "BUY") {
      queue.push({ qty: q, unitCost });
      continue;
    }
    let toSell = q;
    while (toSell > 0 && queue.length > 0) {
      const first = queue[0];
      const used = Math.min(toSell, first.qty);
      first.qty -= used;
      toSell -= used;
      if (first.qty <= 0) queue.shift();
    }
  }
  return queue.reduce((acc, lot) => acc + lot.qty * lot.unitCost, 0);
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

function serializePortfolio(p: {
  id: number;
  userId: number;
  name: string;
  baseCurrency: string;
  cashBalance: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    baseCurrency: normalizeCurrency(p.baseCurrency),
    cashBalance: toNumber(p.cashBalance),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function recomputePortfolioCashBalance(
  prismaClient: PrismaClient,
  userId: number,
  portfolioId: number,
) {
  const [transfers, trades] = await Promise.all([
    prismaClient.transaction.findMany({
      where: { userId, portfolioId, type: "TRANSFER_TO_PORTFOLIO" },
      select: { amount: true },
    }),
    prismaClient.portfolioTrade.findMany({
      where: { userId, portfolioId },
      select: { side: true, quantity: true, tradePrice: true },
    }),
  ]);
  const balance = computePortfolioCashBalance(
    transfers.map((t) => ({ amount: toNumber(t.amount) })),
    trades.map((t) => ({
      side: t.side,
      quantity: toNumber(t.quantity),
      tradePrice: toNumber(t.tradePrice),
    })),
  );
  await prismaClient.investmentPortfolio.update({
    where: { id: portfolioId },
    data: { cashBalance: balance },
  });
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

app.get("/api/portfolios", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const portfolios = await prisma.investmentPortfolio.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    res.json(portfolios.map(serializePortfolio));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to fetch portfolios" });
  }
});

app.post("/api/portfolios", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const name = String(req.body.name ?? "").trim();
    const baseCurrency = normalizeCurrency(req.body.baseCurrency);
    if (!name || !baseCurrency) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const created = await prisma.investmentPortfolio.create({
      data: { userId, name, baseCurrency, cashBalance: 0 },
    });
    res.status(201).json(serializePortfolio(created));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return res.status(409).json({ error: "Portfolio name already exists" });
    }
    res.status(500).json({ error: "Failed to create portfolio" });
  }
});

app.put("/api/portfolios/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const existing = await prisma.investmentPortfolio.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ error: "Portfolio not found" });
    const data: Record<string, unknown> = {};
    if (req.body.name !== undefined) data.name = String(req.body.name).trim();
    if (req.body.baseCurrency !== undefined) data.baseCurrency = normalizeCurrency(req.body.baseCurrency);
    const updated = await prisma.investmentPortfolio.update({ where: { id }, data });
    res.json(serializePortfolio(updated));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to update portfolio" });
  }
});

app.delete("/api/portfolios/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const [tradeCount, txCount] = await Promise.all([
      prisma.portfolioTrade.count({ where: { userId, portfolioId: id } }),
      prisma.transaction.count({ where: { userId, portfolioId: id } }),
    ]);
    if (tradeCount > 0 || txCount > 0) {
      return res.status(400).json({ error: "Cannot delete portfolio with related operations" });
    }
    const result = await prisma.investmentPortfolio.deleteMany({ where: { id, userId } });
    if (!result.count) return res.status(404).json({ error: "Portfolio not found" });
    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to delete portfolio" });
  }
});

app.get("/api/transactions", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const { from, to, type, category, currency, portfolioId } = req.query;
    const displayCurrency = normalizeCurrency(currency);

    const where: {
      userId: number;
      date?: { gte?: Date; lte?: Date };
      type?: string;
      category?: string;
      portfolioId?: number;
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
    if (portfolioId) {
      where.portfolioId = Number(portfolioId);
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
    const { type, amount, currency, category, date, description, portfolioId } = req.body;
    const prevPortfolioId = existing.portfolioId;

    if (!type || !amount || !currency || !category || !date) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    let normalizedPortfolioId: number | null = null;
    if (type === "TRANSFER_TO_PORTFOLIO") {
      if (!portfolioId) return res.status(400).json({ error: "portfolioId is required for transfer" });
      normalizedPortfolioId = Number(portfolioId);
      const portfolio = await prisma.investmentPortfolio.findFirst({
        where: { id: normalizedPortfolioId, userId },
      });
      if (!portfolio) return res.status(404).json({ error: "Portfolio not found" });
      if (normalizeCurrency(portfolio.baseCurrency) !== normalizeCurrency(currency)) {
        return res.status(400).json({ error: "Transfer currency must match portfolio base currency" });
      }
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
        portfolioId: normalizedPortfolioId,
      },
    });

    res.status(201).json({
      ...created,
      amount: toNumber(created.amount),
      currency: normalizeCurrency(created.currency),
    });
    if (normalizedPortfolioId) {
      await recomputePortfolioCashBalance(prisma, userId, normalizedPortfolioId);
    }
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

    const { type, amount, currency, category, date, description, portfolioId } = req.body;

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        type,
        amount,
        currency: currency ? normalizeCurrency(currency) : undefined,
        category,
        date: date ? new Date(date) : undefined,
        description,
        portfolioId: portfolioId != null ? Number(portfolioId) : undefined,
      },
    });

    res.json({
      ...updated,
      amount: toNumber(updated.amount),
      currency: normalizeCurrency(updated.currency),
    });
    if (prevPortfolioId) await recomputePortfolioCashBalance(prisma, userId, prevPortfolioId);
    if (updated.portfolioId && updated.portfolioId !== prevPortfolioId) {
      await recomputePortfolioCashBalance(prisma, userId, updated.portfolioId);
    }
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
    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    const result = await prisma.transaction.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    if (existing?.portfolioId) await recomputePortfolioCashBalance(prisma, userId, existing.portfolioId);
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
    const portfolioId = req.query.portfolioId ? Number(req.query.portfolioId) : null;
    if (!portfolioId) {
      return res.status(400).json({ error: "portfolioId is required" });
    }
    const portfolio = await prisma.investmentPortfolio.findFirst({ where: { id: portfolioId, userId } });
    if (!portfolio) return res.status(404).json({ error: "Portfolio not found" });
    const trades = await prisma.portfolioTrade.findMany({
      where: { userId, portfolioId },
      orderBy: [{ symbol: "asc" }, { tradeDate: "asc" }],
    });
    const symbols = [...new Set(trades.map((t) => normalizeSymbol(t.symbol)))];
    const snapshotsBySymbol = await getLatestSnapshotsForSymbols(prisma, symbols);
    const { plnPerUnit, asOf } = await getFxRatesPlnPerUnit();

    const missing = getMissingCurrencies(
      [
        displayCurrency,
        ...trades.map((t) => normalizeCurrency(t.currency)),
        ...[...snapshotsBySymbol.values()].map((s) => normalizeCurrency(s.currency)),
      ],
      plnPerUnit,
    );
    if (missing.length) {
      return res.status(400).json({ error: "Missing FX rates for some currencies", missingCurrencies: missing, asOf });
    }

    const tradesBySymbol = new Map<string, typeof trades>();
    for (const trade of trades) {
      const symbol = normalizeSymbol(trade.symbol);
      const arr = tradesBySymbol.get(symbol) ?? [];
      arr.push(trade);
      tradesBySymbol.set(symbol, arr);
    }

    const rows = symbols.map((symbol) => {
      const symbolTrades = tradesBySymbol.get(symbol) ?? [];
      const snapshot = snapshotsBySymbol.get(symbol);
      const marketCurrency = normalizeCurrency(snapshot?.currency ?? symbolTrades[0]?.currency ?? "USD");
      let quantity = 0;
      for (const trade of symbolTrades) {
        const q = toNumber(trade.quantity);
        quantity += trade.side === "BUY" ? q : -q;
      }
      quantity = Math.max(0, quantity);
      const weightedBuyPrice =
        quantity > 0
          ? costBasisWeighted(symbolTrades, marketCurrency, plnPerUnit) / quantity
          : 0;
      const lastClose = snapshot ? toNumber(snapshot.close) : null;
      const status = classifyMarketDataStatus(new Date(), snapshot?.priceDate, 2, MARKET_DATA_EXPIRE_DAYS);
      const positionCostConverted = costBasisWeighted(symbolTrades, displayCurrency, plnPerUnit);
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
        buyDate: symbolTrades[0]?.tradeDate ?? null,
        currency: marketCurrency,
        category: symbolTrades[0]?.category ?? "UNSPECIFIED",
        lotsCount: symbolTrades.length,
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
        portfolioId,
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
    const { side, symbol, quantity, tradePrice, tradeDate, currency, category, portfolioId } = req.body;
    const normalizedSide = String(side ?? "BUY").toUpperCase();
    if (!symbol || !quantity || !tradePrice || !tradeDate || !currency || !portfolioId || !["BUY", "SELL"].includes(normalizedSide)) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const pid = Number(portfolioId);
    const portfolio = await prisma.investmentPortfolio.findFirst({ where: { id: pid, userId } });
    if (!portfolio) return res.status(404).json({ error: "Portfolio not found" });
    if (normalizeCurrency(portfolio.baseCurrency) !== normalizeCurrency(currency)) {
      return res.status(400).json({ error: "Trade currency must match portfolio base currency" });
    }
    if (normalizedSide === "SELL") {
      const existingTrades = await prisma.portfolioTrade.findMany({ where: { userId, portfolioId: pid, symbol: normalizeSymbol(symbol) } });
      const netQty = existingTrades.reduce((acc, l) => {
        const q = toNumber(l.quantity);
        return acc + (l.side === "BUY" ? q : -q);
      }, 0);
      if (toNumber(quantity) > netQty) {
        return res.status(400).json({ error: "Sell quantity exceeds current holdings" });
      }
    } else {
      const cash = toNumber(portfolio.cashBalance);
      const grossValue = toNumber(quantity) * toNumber(tradePrice);
      if (grossValue > cash) return res.status(400).json({ error: "Insufficient portfolio cash balance" });
    }

    const created = await prisma.portfolioTrade.create({
      data: {
        userId,
        portfolioId: pid,
        side: normalizedSide,
        symbol: normalizeSymbol(symbol),
        quantity,
        tradePrice,
        tradeDate: new Date(String(tradeDate)),
        currency: normalizeCurrency(currency),
        category: category ?? "UNSPECIFIED",
      },
    });
    res.status(201).json({
      ...created,
      quantity: toNumber(created.quantity),
      tradePrice: toNumber(created.tradePrice),
      currency: normalizeCurrency(created.currency),
    });
    await recomputePortfolioCashBalance(prisma, userId, pid);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to create portfolio trade" });
  }
});

app.get("/api/portfolio/trades", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const symbol = req.query.symbol ? normalizeSymbol(req.query.symbol) : undefined;
    const portfolioId = req.query.portfolioId ? Number(req.query.portfolioId) : null;
    const trades = await prisma.portfolioTrade.findMany({
      where: symbol ? { userId, symbol, portfolioId: portfolioId ?? undefined } : { userId, portfolioId: portfolioId ?? undefined },
      orderBy: [{ symbol: "asc" }, { tradeDate: "desc" }],
    });
    res.json(
      trades.map((t) => ({
        ...t,
        symbol: normalizeSymbol(t.symbol),
        side: t.side,
        quantity: toNumber(t.quantity),
        tradePrice: toNumber(t.tradePrice),
        currency: normalizeCurrency(t.currency),
      })),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to fetch portfolio trades" });
  }
});

app.put("/api/portfolio/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const existing = await prisma.portfolioTrade.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ error: "Portfolio trade not found" });

    const data: Record<string, unknown> = {};
    if (req.body.symbol !== undefined) data.symbol = normalizeSymbol(req.body.symbol);
    if (req.body.side !== undefined) data.side = String(req.body.side).toUpperCase();
    if (req.body.quantity !== undefined) data.quantity = req.body.quantity;
    if (req.body.tradePrice !== undefined) data.tradePrice = req.body.tradePrice;
    if (req.body.tradeDate !== undefined) data.tradeDate = new Date(String(req.body.tradeDate));
    if (req.body.currency !== undefined) data.currency = normalizeCurrency(req.body.currency);
    if (req.body.category !== undefined) data.category = req.body.category;
    const portfolioId = Number(req.body.portfolioId ?? existing.portfolioId);
    const portfolio = await prisma.investmentPortfolio.findFirst({ where: { id: portfolioId, userId } });
    if (!portfolio) return res.status(404).json({ error: "Portfolio not found" });
    const nextCurrency = normalizeCurrency(String(req.body.currency ?? existing.currency));
    if (nextCurrency !== normalizeCurrency(portfolio.baseCurrency)) {
      return res.status(400).json({ error: "Trade currency must match portfolio base currency" });
    }
    data.portfolioId = portfolioId;

    const updated = await prisma.portfolioTrade.update({ where: { id }, data });
    res.json({
      ...updated,
      side: updated.side,
      symbol: normalizeSymbol(updated.symbol),
      quantity: toNumber(updated.quantity),
      tradePrice: toNumber(updated.tradePrice),
      currency: normalizeCurrency(updated.currency),
    });
    await recomputePortfolioCashBalance(prisma, userId, existing.portfolioId);
    if (portfolioId !== existing.portfolioId) {
      await recomputePortfolioCashBalance(prisma, userId, portfolioId);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to update portfolio trade" });
  }
});

app.delete("/api/portfolio/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const existing = await prisma.portfolioTrade.findFirst({ where: { id, userId } });
    const result = await prisma.portfolioTrade.deleteMany({ where: { id, userId } });
    if (!result.count) return res.status(404).json({ error: "Portfolio trade not found" });
    if (existing?.portfolioId) await recomputePortfolioCashBalance(prisma, userId, existing.portfolioId);
    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to delete portfolio trade" });
  }
});

app.get("/api/portfolio/:symbol/history", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const symbol = normalizeSymbol(req.params.symbol);
    const method = String(req.query.method ?? "weighted").toLowerCase();
    const displayCurrency = normalizeCurrency(req.query.currency) || "PLN";
    const portfolioId = req.query.portfolioId ? Number(req.query.portfolioId) : null;
    if (!portfolioId) return res.status(400).json({ error: "portfolioId is required" });

    const trades = await prisma.portfolioTrade.findMany({ where: { userId, symbol, portfolioId }, orderBy: { tradeDate: "asc" } });
    const history = await prisma.marketPriceHistory.findMany({ where: { symbol }, orderBy: { priceDate: "asc" } });
    if (!trades.length || !history.length) return res.json([]);

    const { plnPerUnit } = await getFxRatesPlnPerUnit();
    const series = history.map((h) => {
      const day = new Date(h.priceDate);
      const activeTrades = trades.filter((l) => new Date(l.tradeDate) <= day);
      let qty = 0;
      for (const l of activeTrades) {
        const q = toNumber(l.quantity);
        qty += l.side === "BUY" ? q : -q;
      }
      qty = Math.max(0, qty);
      const close = toNumber(h.close);
      const closeCurrency = normalizeCurrency(h.currency);
      const positionValue = convertAmount(qty * close, closeCurrency, displayCurrency, plnPerUnit);
      const weightedCost = costBasisWeighted(activeTrades, displayCurrency, plnPerUnit);
      const fifoCost = costBasisFifo(activeTrades, displayCurrency, plnPerUnit);
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

    const [transactions, portfolioTrades, txCount, fx] = await Promise.all([
      prisma.transaction.findMany({ where: txWhere }),
      prisma.portfolioTrade.findMany({ where: { userId } }),
      prisma.transaction.count({ where: txWhere }),
      getFxRatesPlnPerUnit(),
    ]);
    const snapshotsBySymbol = await getLatestSnapshotsForSymbols(
      prisma,
      portfolioTrades.map((p) => p.symbol),
    );

    const allCurrencies = [
      ...transactions.map((t) => normalizeCurrency(t.currency)),
      ...portfolioTrades.map((p) => {
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
    const portfolioValue = portfolioTrades.reduce((acc, p) => {
      const qtySigned = p.side === "BUY" ? toNumber(p.quantity) : -toNumber(p.quantity);
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
      const value = Math.max(0, qtySigned) * price;
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
      totalPositionsCount: portfolioTrades.length,
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
    const tradesForScope = await prisma.portfolioTrade.findMany({
      select: { symbol: true, tradeDate: true },
      where: payloadSymbols.length
        ? { symbol: { in: payloadSymbols.map((s) => normalizeSymbol(s)) } }
        : undefined,
    });
    const tradesBySymbol = new Map<string, Date>();
    for (const trade of tradesForScope) {
      const symbol = normalizeSymbol(trade.symbol);
      const currentMin = tradesBySymbol.get(symbol);
      const tradeDate = new Date(trade.tradeDate);
      if (!currentMin || tradeDate < currentMin) {
        tradesBySymbol.set(symbol, tradeDate);
      }
    }
    const symbols = [...tradesBySymbol.keys()];
    marketRefreshInFlight = true;
    let rowsInserted = 0;
    let rowsUpdated = 0;
    const errors: Array<{ symbol: string; error: string }> = [];
    for (const symbol of symbols) {
      try {
        const minBuy = tradesBySymbol.get(symbol)!;
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
