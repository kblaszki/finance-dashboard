import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { convertAmount, getFxRatesPlnPerUnit, getMissingCurrencies } from "./fx";

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
    const anyV = v as any;
    if (typeof anyV.toNumber === "function") return anyV.toNumber();
    if (typeof anyV.toString === "function") return Number(anyV.toString());
  }
  return Number(v);
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/transactions", async (req, res) => {
  try {
    const { from, to, type, category, currency } = req.query;
    const displayCurrency = normalizeCurrency(currency);

    const where: any = {};

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

app.post("/api/transactions", async (req, res) => {
  try {
    const { type, amount, currency, category, date, description } = req.body;

    if (!type || !amount || !currency || !category || !date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const created = await prisma.transaction.create({
      data: {
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

app.put("/api/transactions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
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

app.delete("/api/transactions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.transaction.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

app.get("/api/portfolio", async (_req, res) => {
  try {
    const reqAny = _req as any;
    const displayCurrency = normalizeCurrency(reqAny?.query?.currency);

    const positions = await prisma.portfolioPosition.findMany();

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
        const currentPriceConverted = convertAmount(p.currentPrice, fromCcy, displayCurrency, plnPerUnit);
        const positionValue = p.quantity * p.currentPrice;
        const positionValueConverted = convertAmount(positionValue, fromCcy, displayCurrency, plnPerUnit);
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

app.post("/api/portfolio", async (req, res) => {
  try {
    const {
      symbol,
      quantity,
      buyPrice,
      currentPrice,
      currency,
      category,
    } = req.body;

    if (!symbol || !quantity || !buyPrice || !currentPrice || !currency) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const created = await prisma.portfolioPosition.create({
      data: {
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

app.put("/api/portfolio/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      symbol,
      quantity,
      buyPrice,
      currentPrice,
      currency,
      category,
    } = req.body;

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

app.delete("/api/portfolio/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.portfolioPosition.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to delete portfolio position" });
  }
});

app.get("/api/stats/summary", async (req, res) => {
  try {
    const displayCurrency = normalizeCurrency(req.query.currency) || "PLN";

    const [transactions, portfolioPositions, txCount, fx] = await Promise.all([
      prisma.transaction.findMany(),
      prisma.portfolioPosition.findMany(),
      prisma.transaction.count(),
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

app.get("/api/stats/expenses-by-category", async (req, res) => {
  try {
    const displayCurrency = normalizeCurrency(req.query.currency) || "PLN";
    const [expenses, fx] = await Promise.all([
      prisma.transaction.findMany({ where: { type: "EXPENSE" } }),
      getFxRatesPlnPerUnit(),
    ]);

    const missing = getMissingCurrencies(
      [...expenses.map((t) => normalizeCurrency(t.currency)), displayCurrency],
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

    const byCategory = new Map<string, number>();
    for (const t of expenses) {
      const amount = toNumber(t.amount);
      const fromCcy = normalizeCurrency(t.currency);
      const converted = convertAmount(amount, fromCcy, displayCurrency, fx.plnPerUnit);
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + converted);
    }

    res.json(
      [...byCategory.entries()].map(([category, amount]) => ({
        category,
        amount,
        currency: displayCurrency,
        fxAsOf: fx.asOf,
      })),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ error: "Failed to compute expenses by category" });
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

