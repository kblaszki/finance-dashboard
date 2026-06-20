import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient, type Prisma } from "@prisma/client";
import { convertAmount, getFxRatesPlnPerUnit, normalizeCurrency } from "./fx";
import {
  AuthedRequest,
  hashPassword,
  normalizeEmail,
  requireAuth,
  signToken,
  validatePassword,
  verifyPassword,
} from "./auth";
import {
  isValidLotSide,
  recomputeQuantityAfterChain,
  resolveLotPrice,
} from "./holdingLot";
import {
  backfillAccountValuations,
  computeCashAsOf,
  recomputeAccountValuationsFrom,
  toNumber,
} from "./accountValuation";
import {
  buildHoldingSummary,
  findOrCreateHolding,
  getAccountHoldings,
  getHoldingForUser,
  recalcLotQuantityChain,
  syncHoldingQuantity,
} from "./holdings";
import {
  computeBalanceAfter,
  isValidTransactionType,
  type TransactionType,
} from "./transactionBalance";
import { computeNetWorth } from "./netWorth";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
type DbClient = PrismaClient | Prisma.TransactionClient;

function uid(req: AuthedRequest): number {
  return req.userId!;
}

function parseDateBody(value: unknown): Date {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

function parseDateQuery(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function transactionDateFilter(from?: unknown, to?: unknown): { gte?: Date; lte?: Date } | undefined {
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

function serializeAccount(a: {
  id: number;
  userId: number;
  accountType: string;
  name: string;
  currency: string;
  cashBalance: unknown;
  openingBalance: unknown;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: a.id,
    accountType: a.accountType,
    name: a.name,
    currency: a.currency,
    cashBalance: toNumber(a.cashBalance),
    openingBalance: toNumber(a.openingBalance),
    description: a.description,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

function serializeTransaction(t: {
  id: number;
  accountId: number;
  transactionType: string;
  amount: unknown;
  balanceAfter: unknown;
  currency: string;
  category: string;
  date: Date;
  description: string | null;
}) {
  return {
    id: t.id,
    accountId: t.accountId,
    transactionType: t.transactionType,
    amount: toNumber(t.amount),
    balanceAfter: toNumber(t.balanceAfter),
    currency: t.currency,
    category: t.category,
    date: t.date.toISOString(),
    description: t.description,
  };
}

function serializeHoldingLot(l: {
  id: number;
  holdingId: number;
  side: string;
  quantity: unknown;
  quantityAfter: unknown;
  totalPrice: unknown | null;
  pricePerUnit: unknown | null;
  currency: string;
  tradeDate: Date;
  createdAt: Date;
  holding?: {
    id: number;
    accountId: number;
    instrumentId: number;
    instrument?: {
      id: number;
      symbol: string;
      name: string | null;
      instrumentType: string;
      exchange: string | null;
      currency: string;
    };
  };
}) {
  return {
    id: l.id,
    holdingId: l.holdingId,
    accountId: l.holding?.accountId,
    instrumentId: l.holding?.instrumentId,
    side: l.side,
    quantity: toNumber(l.quantity),
    quantityAfter: toNumber(l.quantityAfter),
    totalPrice: l.totalPrice != null ? toNumber(l.totalPrice) : null,
    pricePerUnit: l.pricePerUnit != null ? toNumber(l.pricePerUnit) : null,
    currency: l.currency,
    tradeDate: l.tradeDate.toISOString(),
    createdAt: l.createdAt.toISOString(),
    instrument: l.holding?.instrument
      ? {
          id: l.holding.instrument.id,
          symbol: l.holding.instrument.symbol,
          name: l.holding.instrument.name,
          instrumentType: l.holding.instrument.instrumentType,
          exchange: l.holding.instrument.exchange,
          currency: l.holding.instrument.currency,
        }
      : undefined,
  };
}

function serializeHoldingSummary(summary: Awaited<ReturnType<typeof buildHoldingSummary>>) {
  return summary;
}

async function getAccountForUser(userId: number, accountId: number, db: DbClient = prisma) {
  return db.account.findFirst({ where: { id: accountId, userId } });
}

async function recalcTransactionBalances(
  db: DbClient,
  accountId: number,
  fromDate?: Date,
): Promise<void> {
  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account) return;

  const txs = await db.transaction.findMany({
    where: fromDate ? { accountId, date: { gte: fromDate } } : { accountId },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  let running = toNumber(account.openingBalance);
  if (fromDate) {
    const prior = await db.transaction.findFirst({
      where: { accountId, date: { lt: fromDate } },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
    if (prior) running = toNumber(prior.balanceAfter);
  }

  for (const tx of txs) {
    if (!isValidTransactionType(tx.transactionType)) continue;
    running = computeBalanceAfter(running, tx.transactionType as TransactionType, toNumber(tx.amount));
    await db.transaction.update({
      where: { id: tx.id },
      data: { balanceAfter: running },
    });
  }
  await db.account.update({ where: { id: accountId }, data: { cashBalance: running } });
}

async function syncBrokerageCashBalance(db: DbClient, accountId: number): Promise<number> {
  const cashBalance = await computeCashAsOf(db, accountId, new Date());
  await db.account.update({ where: { id: accountId }, data: { cashBalance } });
  return cashBalance;
}

// --- Auth ---

app.post("/api/auth/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (!email || !username) return res.status(400).json({ error: "Email and username required" });
    const pwdErr = validatePassword(password);
    if (pwdErr) return res.status(400).json({ error: pwdErr });
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { email, username, passwordHash } });
    const token = signToken(user.id);
    res.status(201).json({ token, user: { id: user.id, email: user.email, username: user.username } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Registration failed";
    res.status(400).json({ error: msg });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
});

app.get("/api/auth/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: uid(req) } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, email: user.email, username: user.username });
});

// --- Accounts ---

app.get("/api/accounts", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.account.findMany({
    where: { userId: uid(req) },
    orderBy: { name: "asc" },
  });
  res.json(rows.map(serializeAccount));
});

app.post("/api/accounts", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const accountType = String(req.body?.accountType ?? "").trim().toUpperCase();
    const name = String(req.body?.name ?? "").trim();
    const currency = normalizeCurrency(req.body?.currency ?? "PLN");
    const openingBalance = Number(req.body?.openingBalance ?? 0);
    const description = req.body?.description != null ? String(req.body.description) : null;
    if (!name || !accountType) return res.status(400).json({ error: "name and accountType required" });
    const row = await prisma.account.create({
      data: {
        userId: uid(req),
        accountType,
        name,
        currency,
        openingBalance,
        cashBalance: openingBalance,
        description,
      },
    });
    const { plnPerUnit } = await getFxRatesPlnPerUnit();
    await backfillAccountValuations(prisma, row.id, plnPerUnit);
    res.status(201).json(serializeAccount(row));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create account";
    res.status(400).json({ error: msg });
  }
});

app.get("/api/accounts/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = await getAccountForUser(uid(req), id);
  if (!row) return res.status(404).json({ error: "Account not found" });
  res.json(serializeAccount(row));
});

app.put("/api/accounts/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = await getAccountForUser(uid(req), id);
  if (!row) return res.status(404).json({ error: "Account not found" });
  const data: { name?: string; description?: string | null } = {};
  if (req.body?.name != null) data.name = String(req.body.name).trim();
  if (req.body?.description !== undefined) {
    data.description = req.body.description != null ? String(req.body.description) : null;
  }
  const updated = await prisma.account.update({ where: { id }, data });
  res.json(serializeAccount(updated));
});

app.delete("/api/accounts/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = await getAccountForUser(uid(req), id);
  if (!row) return res.status(404).json({ error: "Account not found" });
  await prisma.account.delete({ where: { id } });
  res.status(204).send();
});

app.get("/api/accounts/:id/valuations", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = await getAccountForUser(uid(req), id);
  if (!row) return res.status(404).json({ error: "Account not found" });
  const date = transactionDateFilter(req.query.from, req.query.to);
  const rows = await prisma.accountValuationDaily.findMany({
    where: { accountId: id, ...(date ? { valuationDate: date } : {}) },
    orderBy: { valuationDate: "asc" },
  });
  res.json(
    rows.map((r) => ({
      valuationDate: r.valuationDate.toISOString(),
      totalValue: toNumber(r.totalValue),
      cashValue: toNumber(r.cashValue),
      securitiesValue: toNumber(r.securitiesValue),
      currency: r.currency,
    })),
  );
});

// --- Transactions ---

app.get("/api/transactions", requireAuth, async (req: AuthedRequest, res) => {
  const accountId = req.query.accountId != null ? Number(req.query.accountId) : undefined;
  const where: { account: { userId: number }; accountId?: number } = {
    account: { userId: uid(req) },
  };
  if (accountId) where.accountId = accountId;
  const date = transactionDateFilter(req.query.from, req.query.to);
  const rows = await prisma.transaction.findMany({
    where: { ...where, ...(date ? { date } : {}) },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  res.json(rows.map(serializeTransaction));
});

app.post("/api/transactions", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const accountId = Number(req.body?.accountId);
    const transactionType = String(req.body?.transactionType ?? "").trim().toUpperCase();
    const amount = Number(req.body?.amount);
    const currency = normalizeCurrency(req.body?.currency);
    const category = String(req.body?.category ?? "Uncategorized").trim() || "Uncategorized";
    const date = parseDateBody(req.body?.date);
    const description = req.body?.description != null ? String(req.body.description) : null;

    if (!isValidTransactionType(transactionType)) {
      return res.status(400).json({ error: "Invalid transactionType" });
    }
    const account = await getAccountForUser(uid(req), accountId);
    if (!account) return res.status(404).json({ error: "Account not found" });
    const { plnPerUnit } = await getFxRatesPlnPerUnit();
    const row = await prisma.$transaction(async (tx) => {
      const freshAccount = await getAccountForUser(uid(req), accountId, tx);
      if (!freshAccount) throw new Error("Account not found");
      const previous = toNumber(freshAccount.cashBalance);
      const balanceAfter = computeBalanceAfter(previous, transactionType, amount);
      const created = await tx.transaction.create({
        data: {
          accountId,
          transactionType,
          amount,
          balanceAfter,
          currency,
          category,
          date,
          description,
        },
      });
      await tx.account.update({
        where: { id: accountId },
        data: { cashBalance: balanceAfter },
      });
      await recomputeAccountValuationsFrom(tx, accountId, date, plnPerUnit);
      return created;
    });
    res.status(201).json(serializeTransaction(row));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create transaction";
    res.status(400).json({ error: msg });
  }
});

app.put("/api/transactions/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.transaction.findFirst({
      where: { id, account: { userId: uid(req) } },
    });
    if (!existing) return res.status(404).json({ error: "Transaction not found" });

    const data: Record<string, unknown> = {};
    if (req.body?.transactionType != null) {
      const t = String(req.body.transactionType).trim().toUpperCase();
      if (!isValidTransactionType(t)) return res.status(400).json({ error: "Invalid transactionType" });
      data.transactionType = t;
    }
    if (req.body?.amount != null) data.amount = Number(req.body.amount);
    if (req.body?.currency != null) data.currency = normalizeCurrency(req.body.currency);
    if (req.body?.category != null) data.category = String(req.body.category);
    if (req.body?.date != null) data.date = parseDateBody(req.body.date);
    if (req.body?.description !== undefined) {
      data.description = req.body.description != null ? String(req.body.description) : null;
    }
    const { plnPerUnit } = await getFxRatesPlnPerUnit();
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.transaction.update({ where: { id }, data });
      const rowDate = row.date;
      const recalcFrom =
        rowDate.getTime() < existing.date.getTime() ? rowDate : existing.date;
      await recalcTransactionBalances(tx, existing.accountId, recalcFrom);
      await recomputeAccountValuationsFrom(tx, existing.accountId, recalcFrom, plnPerUnit);
      return row;
    });
    res.json(serializeTransaction(updated));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update transaction";
    res.status(400).json({ error: msg });
  }
});

app.delete("/api/transactions/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.transaction.findFirst({
    where: { id, account: { userId: uid(req) } },
  });
  if (!existing) return res.status(404).json({ error: "Transaction not found" });
  const { plnPerUnit } = await getFxRatesPlnPerUnit();
  await prisma.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { id } });
    await recalcTransactionBalances(tx, existing.accountId, existing.date);
    await recomputeAccountValuationsFrom(tx, existing.accountId, existing.date, plnPerUnit);
  });
  res.status(204).send();
});

// --- Instruments ---

app.get("/api/instruments", requireAuth, async (req: AuthedRequest, res) => {
  const q = String(req.query.q ?? "").trim();
  const rows = await prisma.instrument.findMany({
    ...(q
      ? {
          where: {
            OR: [{ symbol: { contains: q } }, { name: { contains: q } }],
          },
        }
      : {}),
    orderBy: { symbol: "asc" },
    take: 50,
  });
  res.json(rows);
});

app.post("/api/instruments", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const instrumentType = String(req.body?.instrumentType ?? "STOCK").trim().toUpperCase();
    const symbol = String(req.body?.symbol ?? "").trim().toUpperCase();
    const name = req.body?.name != null ? String(req.body.name) : null;
    const exchange = req.body?.exchange != null ? String(req.body.exchange) : null;
    const currency = normalizeCurrency(req.body?.currency ?? "USD");
    const source = String(req.body?.source ?? "manual");
    if (!symbol) return res.status(400).json({ error: "symbol required" });
    const row = await prisma.instrument.create({
      data: { instrumentType, symbol, name, exchange, currency, source },
    });
    res.status(201).json(row);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create instrument";
    res.status(400).json({ error: msg });
  }
});

app.get("/api/instruments/:id/valuations", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const date = transactionDateFilter(req.query.from, req.query.to);
  const rows = await prisma.instrumentValuation.findMany({
    where: { instrumentId: id, ...(date ? { valuationDate: date } : {}) },
    orderBy: { valuationDate: "asc" },
  });
  res.json(
    rows.map((r) => ({
      valuationDate: r.valuationDate.toISOString(),
      price: toNumber(r.price),
      currency: r.currency,
      source: r.source,
    })),
  );
});

app.post("/api/instruments/:id/valuations", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const instrumentId = Number(req.params.id);
    const instrument = await prisma.instrument.findUnique({ where: { id: instrumentId } });
    if (!instrument) return res.status(404).json({ error: "Instrument not found" });
    const valuationDate = parseDateBody(req.body?.valuationDate);
    const price = Number(req.body?.price);
    const currency = normalizeCurrency(req.body?.currency ?? instrument.currency);
    const source = String(req.body?.source ?? "manual");
    const row = await prisma.instrumentValuation.create({
      data: { instrumentId, valuationDate, price, currency, source },
    });
    const accounts = await prisma.holding.findMany({
      where: { instrumentId },
      select: { accountId: true },
      distinct: ["accountId"],
    });
    const { plnPerUnit } = await getFxRatesPlnPerUnit();
    for (const { accountId } of accounts) {
      const account = await getAccountForUser(uid(req), accountId);
      if (account) {
        await recomputeAccountValuationsFrom(prisma, accountId, valuationDate, plnPerUnit);
      }
    }
    res.status(201).json(row);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to add valuation";
    res.status(400).json({ error: msg });
  }
});

// --- Holdings ---

app.get("/api/accounts/:accountId/holdings", requireAuth, async (req: AuthedRequest, res) => {
  const accountId = Number(req.params.accountId);
  const account = await getAccountForUser(uid(req), accountId);
  if (!account) return res.status(404).json({ error: "Account not found" });
  if (account.accountType !== "BROKERAGE") {
    return res.json({ open: [], closed: [] });
  }
  const { plnPerUnit } = await getFxRatesPlnPerUnit();
  const holdings = await getAccountHoldings(prisma, accountId, account.currency, plnPerUnit);
  res.json(holdings);
});

app.post("/api/accounts/:accountId/holdings", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const accountId = Number(req.params.accountId);
    const account = await getAccountForUser(uid(req), accountId);
    if (!account) return res.status(404).json({ error: "Account not found" });
    if (account.accountType !== "BROKERAGE") {
      return res.status(400).json({ error: "Holdings are only for brokerage accounts" });
    }

    const instrumentId = Number(req.body?.instrumentId);
    const instrument = await prisma.instrument.findUnique({ where: { id: instrumentId } });
    if (!instrument) return res.status(404).json({ error: "Instrument not found" });

    const holding = await findOrCreateHolding(prisma, accountId, instrumentId);
    const row = await prisma.holding.findUnique({
      where: { id: holding.id },
      include: {
        instrument: true,
        lots: { orderBy: [{ tradeDate: "asc" }, { id: "asc" }] },
      },
    });
    if (!row) return res.status(404).json({ error: "Holding not found" });

    const { plnPerUnit } = await getFxRatesPlnPerUnit();
    const summary = await buildHoldingSummary(prisma, row, account.currency, plnPerUnit);
    res.status(201).json(serializeHoldingSummary(summary));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create holding";
    res.status(400).json({ error: msg });
  }
});

app.get("/api/holdings/:holdingId", requireAuth, async (req: AuthedRequest, res) => {
  const holdingId = Number(req.params.holdingId);
  const holding = await getHoldingForUser(prisma, uid(req), holdingId);
  if (!holding) return res.status(404).json({ error: "Holding not found" });

  const { plnPerUnit } = await getFxRatesPlnPerUnit();
  const summary = await buildHoldingSummary(
    prisma,
    holding,
    holding.account.currency,
    plnPerUnit,
  );
  res.json(serializeHoldingSummary(summary));
});

app.get("/api/holdings/:holdingId/lots", requireAuth, async (req: AuthedRequest, res) => {
  const holdingId = Number(req.params.holdingId);
  const holding = await getHoldingForUser(prisma, uid(req), holdingId);
  if (!holding) return res.status(404).json({ error: "Holding not found" });

  const rows = await prisma.holdingLot.findMany({
    where: { holdingId },
    include: {
      holding: { include: { instrument: true } },
    },
    orderBy: [{ tradeDate: "desc" }, { id: "desc" }],
  });
  res.json(rows.map(serializeHoldingLot));
});

app.post("/api/holdings/:holdingId/lots", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const holdingId = Number(req.params.holdingId);
    const holding = await getHoldingForUser(prisma, uid(req), holdingId);
    if (!holding) return res.status(404).json({ error: "Holding not found" });

    const account = holding.account;
    const side = String(req.body?.side ?? "").trim().toUpperCase();
    const quantity = Number(req.body?.quantity);
    const currency = normalizeCurrency(req.body?.currency ?? account.currency);
    const tradeDate = parseDateBody(req.body?.tradeDate);

    if (!isValidLotSide(side)) return res.status(400).json({ error: "Invalid side" });

    const prices = resolveLotPrice({
      quantity,
      totalPrice: req.body?.totalPrice,
      pricePerUnit: req.body?.pricePerUnit,
    });
    const { plnPerUnit } = await getFxRatesPlnPerUnit();
    const row = await prisma.$transaction(async (tx) => {
      const existingLots = await tx.holdingLot.findMany({
        where: { holdingId },
        orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
      });
      recomputeQuantityAfterChain([
        ...existingLots.map((lot) => ({
          id: lot.id,
          side: lot.side,
          quantity: toNumber(lot.quantity),
          tradeDate: lot.tradeDate,
        })),
        { id: -1, side, quantity, tradeDate },
      ]);

      const created = await tx.holdingLot.create({
        data: {
          holdingId,
          side,
          quantity,
          quantityAfter: 0,
          totalPrice: prices.totalPrice,
          pricePerUnit: prices.pricePerUnit,
          currency,
          tradeDate,
        },
        include: {
          holding: { include: { instrument: true } },
        },
      });

      await recalcLotQuantityChain(tx, holdingId);
      await syncHoldingQuantity(tx, holdingId);
      await syncBrokerageCashBalance(tx, account.id);
      await recomputeAccountValuationsFrom(tx, account.id, tradeDate, plnPerUnit);

      return tx.holdingLot.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          holding: { include: { instrument: true } },
        },
      });
    });
    res.status(201).json(serializeHoldingLot(row));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create holding lot";
    res.status(400).json({ error: msg });
  }
});

app.delete("/api/holding-lots/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.holdingLot.findFirst({
    where: { id, holding: { account: { userId: uid(req) } } },
    include: { holding: true },
  });
  if (!existing) return res.status(404).json({ error: "Holding lot not found" });

  const accountId = existing.holding.accountId;
  const holdingId = existing.holdingId;
  const tradeDate = existing.tradeDate;

  const { plnPerUnit } = await getFxRatesPlnPerUnit();
  await prisma.$transaction(async (tx) => {
    await tx.holdingLot.delete({ where: { id } });
    await recalcLotQuantityChain(tx, holdingId);
    await syncHoldingQuantity(tx, holdingId);
    await syncBrokerageCashBalance(tx, accountId);
    await recomputeAccountValuationsFrom(tx, accountId, tradeDate, plnPerUnit);
  });
  res.status(204).send();
});

app.get(
  "/api/accounts/:accountId/holdings/:instrumentId/valuations",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const accountId = Number(req.params.accountId);
    const instrumentId = Number(req.params.instrumentId);
    const account = await getAccountForUser(uid(req), accountId);
    if (!account) return res.status(404).json({ error: "Account not found" });
    const date = transactionDateFilter(req.query.from, req.query.to);
    const rows = await prisma.holdingValuationDaily.findMany({
      where: {
        accountId,
        instrumentId,
        ...(date ? { valuationDate: date } : {}),
      },
      orderBy: { valuationDate: "asc" },
    });
    res.json(
      rows.map((r) => ({
        valuationDate: r.valuationDate.toISOString(),
        quantity: toNumber(r.quantity),
        marketValue: toNumber(r.marketValue),
        currency: r.currency,
      })),
    );
  },
);

// --- Stats ---

app.get("/api/stats/net-worth", requireAuth, async (req: AuthedRequest, res) => {
  const currency = normalizeCurrency(req.query.currency ?? "PLN");
  const data = await computeNetWorth(prisma, uid(req), currency);
  res.json(data);
});

app.get("/api/stats/cashflow", requireAuth, async (req: AuthedRequest, res) => {
  const date = transactionDateFilter(req.query.from, req.query.to);
  const currency = normalizeCurrency(req.query.currency ?? "PLN");
  const { plnPerUnit } = await getFxRatesPlnPerUnit();
  const rows = await prisma.transaction.findMany({
    where: { account: { userId: uid(req) }, ...(date ? { date } : {}) },
  });
  let income = 0;
  let expense = 0;
  for (const t of rows) {
    const amt = convertAmount(toNumber(t.amount), t.currency, currency, plnPerUnit);
    if (t.transactionType === "INCOME" || t.transactionType === "TRANSFER_IN") income += amt;
    if (t.transactionType === "EXPENSE" || t.transactionType === "TRANSFER_OUT") expense += amt;
  }
  res.json({ income, expense, net: income - expense, currency });
});

app.get("/api/stats/expenses-by-category", requireAuth, async (req: AuthedRequest, res) => {
  const date = transactionDateFilter(req.query.from, req.query.to);
  const currency = normalizeCurrency(req.query.currency ?? "PLN");
  const { plnPerUnit } = await getFxRatesPlnPerUnit();
  const rows = await prisma.transaction.findMany({
    where: {
      account: { userId: uid(req) },
      transactionType: { in: ["EXPENSE", "TRANSFER_OUT"] },
      ...(date ? { date } : {}),
    },
  });
  const map = new Map<string, number>();
  for (const t of rows) {
    const amount = convertAmount(toNumber(t.amount), t.currency, currency, plnPerUnit);
    map.set(t.category, (map.get(t.category) ?? 0) + amount);
  }
  res.json([...map.entries()].map(([category, amount]) => ({ category, amount })));
});

app.get("/api/stats/income-by-category", requireAuth, async (req: AuthedRequest, res) => {
  const date = transactionDateFilter(req.query.from, req.query.to);
  const currency = normalizeCurrency(req.query.currency ?? "PLN");
  const { plnPerUnit } = await getFxRatesPlnPerUnit();
  const rows = await prisma.transaction.findMany({
    where: {
      account: { userId: uid(req) },
      transactionType: { in: ["INCOME", "TRANSFER_IN"] },
      ...(date ? { date } : {}),
    },
  });
  const map = new Map<string, number>();
  for (const t of rows) {
    const amount = convertAmount(toNumber(t.amount), t.currency, currency, plnPerUnit);
    map.set(t.category, (map.get(t.category) ?? 0) + amount);
  }
  res.json([...map.entries()].map(([category, amount]) => ({ category, amount })));
});

if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
}

export { app, prisma };
