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
import {
  computeBrokerSecuritiesValuation,
  computePortfolioValueOverTime,
  sumBrokerCash,
  validateSellQuantity,
  type TradeLot,
} from "./portfolioValuation";
import { computeNetWorth } from "./netWorth";
import { computeBankBalancesForUser, syncBondAccountManualValue } from "./accounts";
import { buildCategoryPath, listCategoriesWithPaths, rollupCategoryAmounts } from "./categories";
import { mapCsvRows, parseCsvText } from "./csvImport";

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
    const { from, to, type, category, currency, portfolioId, accountId } = req.query;
    const displayCurrency = normalizeCurrency(currency);

    const where: {
      userId: number;
      date?: { gte?: Date; lte?: Date };
      type?: string;
      category?: string;
      portfolioId?: number;
      accountId?: number;
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
    if (accountId) {
      where.accountId = Number(accountId);
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

async function resolveCategoryFields(
  userId: number,
  category: unknown,
  categoryId: unknown,
): Promise<{ category: string; categoryId: number | null }> {
  if (categoryId != null && categoryId !== "") {
    const id = Number(categoryId);
    const path = await buildCategoryPath(prisma, userId, id);
    if (!path) throw new Error("Category not found");
    return { category: path, categoryId: id };
  }
  const c = String(category ?? "").trim();
  return { category: c, categoryId: null };
}

app.post("/api/transactions", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const { type, amount, currency, category, categoryId, date, description, portfolioId, accountId } =
      req.body;

    if (!type || !amount || !currency || !date) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    let categoryFields: { category: string; categoryId: number | null };
    try {
      categoryFields = await resolveCategoryFields(userId, category, categoryId);
    } catch {
      return res.status(404).json({ error: "Category not found" });
    }
    if (!categoryFields.category && type !== "TRANSFER_TO_PORTFOLIO") {
      return res.status(400).json({ error: "Category is required" });
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

    let normalizedAccountId: number | null = null;
    if (accountId != null && accountId !== "") {
      normalizedAccountId = Number(accountId);
      const bank = await prisma.financialAccount.findFirst({
        where: { id: normalizedAccountId, userId, type: "BANK" },
      });
      if (!bank) return res.status(404).json({ error: "Bank account not found" });
    }

    const created = await prisma.transaction.create({
      data: {
        userId,
        type,
        amount,
        currency: normalizeCurrency(currency),
        category: categoryFields.category,
        categoryId: categoryFields.categoryId,
        date: new Date(date),
        description: description ?? null,
        portfolioId: normalizedPortfolioId,
        accountId: normalizedAccountId,
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

    const { type, amount, currency, category, categoryId, date, description, portfolioId, accountId } =
      req.body;

    const data: Record<string, unknown> = {
      type,
      amount,
      currency: currency ? normalizeCurrency(currency) : undefined,
      date: date ? new Date(date) : undefined,
      description,
      portfolioId: portfolioId != null ? Number(portfolioId) : undefined,
    };
    if (category !== undefined || categoryId !== undefined) {
      try {
        const fields = await resolveCategoryFields(userId, category ?? existing.category, categoryId);
        data.category = fields.category;
        data.categoryId = fields.categoryId;
      } catch {
        return res.status(404).json({ error: "Category not found" });
      }
    }
    if (accountId !== undefined) {
      if (accountId == null || accountId === "") {
        data.accountId = null;
      } else {
        const bank = await prisma.financialAccount.findFirst({
          where: { id: Number(accountId), userId, type: "BANK" },
        });
        if (!bank) return res.status(404).json({ error: "Bank account not found" });
        data.accountId = Number(accountId);
      }
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data,
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
      const existingTrades = await prisma.portfolioTrade.findMany({
        where: { userId, portfolioId: pid, symbol: normalizeSymbol(symbol) },
      });
      const sellCheck = validateSellQuantity(existingTrades, toNumber(quantity));
      if (!sellCheck.ok) {
        return res.status(400).json({
          error: `Sprzedaż przekracza posiadaną ilość (dostępne: ${sellCheck.available})`,
          availableQuantity: sellCheck.available,
        });
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

    const nextSide = String(data.side ?? existing.side).toUpperCase();
    const nextSymbol = normalizeSymbol(data.symbol ?? existing.symbol);
    const nextQuantity = toNumber(data.quantity ?? existing.quantity);

    if (nextSide === "SELL") {
      const peerTrades = await prisma.portfolioTrade.findMany({
        where: {
          userId,
          portfolioId,
          symbol: nextSymbol,
          id: { not: id },
        },
      });
      const sellCheck = validateSellQuantity(peerTrades, nextQuantity);
      if (!sellCheck.ok) {
        return res.status(400).json({
          error: `Sprzedaż przekracza posiadaną ilość (dostępne: ${sellCheck.available})`,
          availableQuantity: sellCheck.available,
        });
      }
    }

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

    const tradeLots: TradeLot[] = portfolioTrades.map((p) => ({
      portfolioId: p.portfolioId,
      side: p.side,
      symbol: p.symbol,
      quantity: p.quantity,
      currency: p.currency,
    }));
    const brokerVal = computeBrokerSecuritiesValuation({
      trades: tradeLots,
      snapshotsBySymbol,
      displayCurrency,
      plnPerUnit: fx.plnPerUnit,
      marketDataExpireDays: MARKET_DATA_EXPIRE_DAYS,
    });
    const portfolios = await prisma.investmentPortfolio.findMany({ where: { userId } });
    const brokerCash = sumBrokerCash(portfolios, displayCurrency, fx.plnPerUnit);
    const portfolioValue = brokerVal.securitiesValue + brokerCash;

    res.json({
      currency: displayCurrency,
      fxAsOf: fx.asOf,
      income,
      expenses,
      balance,
      portfolioValue,
      brokerSecurities: brokerVal.securitiesValue,
      brokerCash,
      transactionsCount: txCount,
      portfolioValueMarketDataAsOf: brokerVal.valuationAsOf,
      stalePositionsCount: brokerVal.stalePositionsCount,
      pricedPositionsCount: brokerVal.pricedPositionsCount,
      totalPositionsCount: brokerVal.totalPositionsCount,
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

  const pathItems: Array<{ categoryPath: string; amount: number }> = [];
  for (const t of rows) {
    const amount = toNumber(t.amount);
    const fromCcy = normalizeCurrency(t.currency);
    const converted = convertAmount(amount, fromCcy, displayCurrency, fx.plnPerUnit);
    let path = t.category;
    if (t.categoryId) {
      path = await buildCategoryPath(prisma, userId, t.categoryId);
      if (!path) path = t.category;
    }
    pathItems.push({ categoryPath: path, amount: converted });
  }

  return {
    data: rollupCategoryAmounts(pathItems).map(({ category, amount }) => ({
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

app.get("/api/stats/net-worth", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const displayCurrency = normalizeCurrency(req.query.currency) || "PLN";
    const fx = await getFxRatesPlnPerUnit();

    const [portfolioTrades, portfolios, financialAccounts, bankBalances] = await Promise.all([
      prisma.portfolioTrade.findMany({ where: { userId } }),
      prisma.investmentPortfolio.findMany({ where: { userId } }),
      prisma.financialAccount.findMany({ where: { userId } }),
      computeBankBalancesForUser(prisma, userId),
    ]);

    const snapshotsBySymbol = await getLatestSnapshotsForSymbols(
      prisma,
      portfolioTrades.map((p) => p.symbol),
    );

    const allCurrencies = [
      displayCurrency,
      ...portfolios.map((p) => normalizeCurrency(p.baseCurrency)),
      ...financialAccounts.map((a) => normalizeCurrency(a.currency)),
      ...portfolioTrades.map((p) => {
        const symbol = normalizeSymbol(p.symbol);
        const snapshot = snapshotsBySymbol.get(symbol);
        return normalizeCurrency(snapshot?.currency ?? p.currency);
      }),
    ];
    const missing = getMissingCurrencies(allCurrencies, fx.plnPerUnit);
    if (missing.length) {
      return res.status(400).json({
        error: "Missing FX rates for some currencies",
        missingCurrencies: missing,
        fxAsOf: fx.asOf,
      });
    }

    const result = computeNetWorth({
      displayCurrency,
      plnPerUnit: fx.plnPerUnit,
      fxAsOf: fx.asOf,
      marketDataExpireDays: MARKET_DATA_EXPIRE_DAYS,
      trades: portfolioTrades.map((p) => ({
        portfolioId: p.portfolioId,
        side: p.side,
        symbol: p.symbol,
        quantity: p.quantity,
        currency: p.currency,
      })),
      portfolios,
      snapshotsBySymbol,
      financialAccounts,
      bankBalances,
    });

    res.json({
      ...result,
      portfolioValueMarketDataAsOf: result.portfolioValueMarketDataAsOf,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to compute net worth" });
  }
});

app.get("/api/stats/portfolio-value-over-time", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const displayCurrency = normalizeCurrency(req.query.currency) || "PLN";
    const dateFilter = transactionDateFilter(req.query.from, req.query.to);
    if (!dateFilter?.gte || !dateFilter?.lte) {
      return res.status(400).json({ error: "from and to query parameters are required" });
    }

    const [trades, transfers, portfolios, fx] = await Promise.all([
      prisma.portfolioTrade.findMany({ where: { userId } }),
      prisma.transaction.findMany({
        where: { userId, type: "TRANSFER_TO_PORTFOLIO" },
        select: { portfolioId: true, amount: true, date: true },
      }),
      prisma.investmentPortfolio.findMany({ where: { userId } }),
      getFxRatesPlnPerUnit(),
    ]);

    const symbols = [...new Set(trades.map((t) => normalizeSymbol(t.symbol)))];
    const historyRows = await prisma.marketPriceHistory.findMany({
      where: { symbol: { in: symbols } },
      orderBy: [{ symbol: "asc" }, { priceDate: "asc" }],
    });
    const historyBySymbol = new Map<string, Array<{ priceDate: Date; close: unknown; currency: string }>>();
    for (const row of historyRows) {
      const sym = normalizeSymbol(row.symbol);
      const arr = historyBySymbol.get(sym) ?? [];
      arr.push({ priceDate: row.priceDate, close: row.close, currency: row.currency });
      historyBySymbol.set(sym, arr);
    }

    const periods = listYearMonthsInRange(dateFilter.gte, dateFilter.lte);
    const tradeLots: TradeLot[] = trades.map((t) => ({
      portfolioId: t.portfolioId,
      side: t.side,
      symbol: t.symbol,
      quantity: t.quantity,
      tradePrice: t.tradePrice,
      currency: t.currency,
      tradeDate: t.tradeDate,
    }));

    const series = computePortfolioValueOverTime({
      trades: tradeLots,
      transfers: transfers
        .filter((t) => t.portfolioId != null)
        .map((t) => ({
          portfolioId: t.portfolioId!,
          amount: t.amount,
          date: t.date,
        })),
      portfolios,
      historyBySymbol,
      periods,
      displayCurrency,
      plnPerUnit: fx.plnPerUnit,
      marketDataExpireDays: MARKET_DATA_EXPIRE_DAYS,
    });

    res.json(
      series.map((p) => ({
        ...p,
        currency: displayCurrency,
        fxAsOf: fx.asOf,
      })),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to compute portfolio value over time" });
  }
});

function serializeFinancialAccount(a: {
  id: number;
  userId: number;
  type: string;
  name: string;
  currency: string;
  openingBalance: unknown;
  manualValue: unknown | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: a.id,
    userId: a.userId,
    type: a.type,
    name: a.name,
    currency: normalizeCurrency(a.currency),
    openingBalance: toNumber(a.openingBalance),
    manualValue: a.manualValue != null ? toNumber(a.manualValue) : null,
    notes: a.notes,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

app.get("/api/accounts", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const type = req.query.type ? String(req.query.type).toUpperCase() : undefined;
    const where: { userId: number; type?: string } = { userId };
    if (type) where.type = type;
    const accounts = await prisma.financialAccount.findMany({
      where,
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    const bankBalances = await computeBankBalancesForUser(prisma, userId);
    res.json(
      accounts.map((a) => ({
        ...serializeFinancialAccount(a),
        balance: a.type === "BANK" ? bankBalances.get(a.id) ?? 0 : null,
      })),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

app.post("/api/accounts", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const type = String(req.body.type ?? "").toUpperCase();
    const name = String(req.body.name ?? "").trim();
    const currency = normalizeCurrency(req.body.currency);
    if (!name || !currency || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const allowed = ["BANK", "REAL_ESTATE", "CRYPTO", "LIABILITY", "BONDS"];
    if (!allowed.includes(type)) {
      return res.status(400).json({ error: "Invalid account type" });
    }
    const created = await prisma.financialAccount.create({
      data: {
        userId,
        type,
        name,
        currency,
        openingBalance: type === "BANK" ? Number(req.body.openingBalance ?? 0) : 0,
        manualValue:
          type !== "BANK" && req.body.manualValue != null ? Number(req.body.manualValue) : null,
        notes: req.body.notes ?? null,
      },
    });
    res.status(201).json(serializeFinancialAccount(created));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return res.status(409).json({ error: "Account name already exists" });
    }
    res.status(500).json({ error: "Failed to create account" });
  }
});

app.put("/api/accounts/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const existing = await prisma.financialAccount.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ error: "Account not found" });

    const updated = await prisma.financialAccount.update({
      where: { id },
      data: {
        name: req.body.name != null ? String(req.body.name).trim() : undefined,
        currency: req.body.currency ? normalizeCurrency(req.body.currency) : undefined,
        openingBalance:
          existing.type === "BANK" && req.body.openingBalance != null
            ? Number(req.body.openingBalance)
            : undefined,
        manualValue:
          existing.type !== "BANK" && req.body.manualValue != null
            ? Number(req.body.manualValue)
            : req.body.manualValue === null
              ? null
              : undefined,
        notes: req.body.notes !== undefined ? req.body.notes : undefined,
      },
    });
    res.json(serializeFinancialAccount(updated));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to update account" });
  }
});

app.delete("/api/accounts/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const txCount = await prisma.transaction.count({ where: { userId, accountId: id } });
    if (txCount > 0) {
      return res.status(400).json({ error: "Cannot delete account with transactions" });
    }
    const result = await prisma.financialAccount.deleteMany({ where: { id, userId } });
    if (!result.count) return res.status(404).json({ error: "Account not found" });
    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

app.get("/api/categories", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const kind = req.query.kind ? String(req.query.kind).toUpperCase() : undefined;
    const rows = await listCategoriesWithPaths(prisma, req.userId!, kind);
    res.json(rows);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

app.post("/api/categories", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const name = String(req.body.name ?? "").trim();
    const kind = String(req.body.kind ?? "").toUpperCase();
    const parentId = req.body.parentId != null ? Number(req.body.parentId) : null;
    if (!name || !["INCOME", "EXPENSE"].includes(kind)) {
      return res.status(400).json({ error: "Invalid category fields" });
    }
    if (parentId) {
      const parent = await prisma.category.findFirst({ where: { id: parentId, userId, kind } });
      if (!parent) return res.status(404).json({ error: "Parent category not found" });
    }
    const created = await prisma.category.create({
      data: { userId, name, kind, parentId },
    });
    const path = await buildCategoryPath(prisma, userId, created.id);
    res.status(201).json({ id: created.id, parentId: created.parentId, name: created.name, kind, path });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return res.status(409).json({ error: "Category already exists" });
    }
    res.status(500).json({ error: "Failed to create category" });
  }
});

app.put("/api/categories/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const existing = await prisma.category.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ error: "Category not found" });
    const updated = await prisma.category.update({
      where: { id },
      data: {
        name: req.body.name != null ? String(req.body.name).trim() : undefined,
        parentId: req.body.parentId !== undefined ? (req.body.parentId != null ? Number(req.body.parentId) : null) : undefined,
      },
    });
    const path = await buildCategoryPath(prisma, userId, updated.id);
    res.json({ id: updated.id, parentId: updated.parentId, name: updated.name, kind: updated.kind, path });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

app.delete("/api/categories/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const childCount = await prisma.category.count({ where: { parentId: id, userId } });
    if (childCount > 0) {
      return res.status(400).json({ error: "Cannot delete category with subcategories" });
    }
    const result = await prisma.category.deleteMany({ where: { id, userId } });
    if (!result.count) return res.status(404).json({ error: "Category not found" });
    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

app.get("/api/accounts/:id/bonds", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const accountId = Number(req.params.id);
    const account = await prisma.financialAccount.findFirst({
      where: { id: accountId, userId, type: "BONDS" },
    });
    if (!account) return res.status(404).json({ error: "Bond account not found" });
    const holdings = await prisma.bondHolding.findMany({
      where: { accountId },
      orderBy: { purchaseDate: "desc" },
    });
    res.json(
      holdings.map((h) => ({
        id: h.id,
        accountId: h.accountId,
        series: h.series,
        nominal: toNumber(h.nominal),
        purchaseDate: h.purchaseDate,
        currency: normalizeCurrency(h.currency),
        notes: h.notes,
      })),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to fetch bond holdings" });
  }
});

app.post("/api/accounts/:id/bonds", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const accountId = Number(req.params.id);
    const account = await prisma.financialAccount.findFirst({
      where: { id: accountId, userId, type: "BONDS" },
    });
    if (!account) return res.status(404).json({ error: "Bond account not found" });
    const { series, nominal, purchaseDate, currency, notes } = req.body;
    if (!series || nominal == null || !purchaseDate || !currency) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const created = await prisma.bondHolding.create({
      data: {
        accountId,
        series: String(series).trim(),
        nominal: Number(nominal),
        purchaseDate: new Date(purchaseDate),
        currency: normalizeCurrency(currency),
        notes: notes ?? null,
      },
    });
    await syncBondAccountManualValue(prisma, userId, accountId);
    res.status(201).json({
      id: created.id,
      accountId: created.accountId,
      series: created.series,
      nominal: toNumber(created.nominal),
      purchaseDate: created.purchaseDate,
      currency: normalizeCurrency(created.currency),
      notes: created.notes,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to create bond holding" });
  }
});

app.delete("/api/bonds/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const id = Number(req.params.id);
    const existing = await prisma.bondHolding.findFirst({
      where: { id },
      include: { account: true },
    });
    if (!existing || existing.account.userId !== userId) {
      return res.status(404).json({ error: "Bond holding not found" });
    }
    await prisma.bondHolding.delete({ where: { id } });
    await syncBondAccountManualValue(prisma, userId, existing.accountId);
    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to delete bond holding" });
  }
});

app.post("/api/import/csv/preview", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { csvText, mapping } = req.body;
    if (!csvText || !mapping) {
      return res.status(400).json({ error: "csvText and mapping are required" });
    }
    const { headers, rows } = parseCsvText(String(csvText));
    const result = mapCsvRows(headers, rows, mapping);
    res.json({ headers, rows: result.rows, errors: result.errors });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to preview CSV import" });
  }
});

app.post("/api/import/csv", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const { csvText, mapping, accountId, categoryId, defaultCategory } = req.body;
    if (!csvText || !mapping || !accountId) {
      return res.status(400).json({ error: "csvText, mapping and accountId are required" });
    }
    const bank = await prisma.financialAccount.findFirst({
      where: { id: Number(accountId), userId, type: "BANK" },
    });
    if (!bank) return res.status(404).json({ error: "Bank account not found" });

    const { headers, rows } = parseCsvText(String(csvText));
    const parsed = mapCsvRows(headers, rows, mapping);
    if (parsed.errors.length) {
      return res.status(400).json({ error: "CSV validation failed", details: parsed.errors });
    }

    let categoryFields: { category: string; categoryId: number | null };
    try {
      categoryFields = await resolveCategoryFields(
        userId,
        defaultCategory ?? "Import CSV",
        categoryId,
      );
    } catch {
      return res.status(404).json({ error: "Category not found" });
    }

    const created = await prisma.$transaction(
      parsed.rows.map((row) =>
        prisma.transaction.create({
          data: {
            userId,
            type: row.type,
            amount: row.amount,
            currency: normalizeCurrency(bank.currency),
            category: categoryFields.category,
            categoryId: categoryFields.categoryId,
            date: new Date(row.date),
            description: row.description || `Import linia ${row.line}`,
            accountId: bank.id,
          },
        }),
      ),
    );

    res.status(201).json({ imported: created.length });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to import CSV" });
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
