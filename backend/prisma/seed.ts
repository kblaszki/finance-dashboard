import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildCategoryPath } from "../src/categories";
import { ensureCategoryPath } from "../src/migrateCategories";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@finance.local";
const DEMO_PASSWORD = "demo12345";
const MARKET_SOURCE = "DEMO_SEED";

const ROOT_EXPENSE = ["FOOD", "TRANSPORT", "HOUSING", "ENTERTAINMENT", "HEALTH", "SHOPPING"];
const ROOT_INCOME = ["SALARY", "FREELANCE", "INVESTMENT"];

const EXPENSE_DESCRIPTIONS: Record<string, string[]> = {
  FOOD: ["Biedronka", "Lidl", "Restauracja", "Kawa na mieście"],
  TRANSPORT: ["Paliwo", "Uber", "Bilet miesięczny", "Parking"],
  HOUSING: ["Czynsz", "Prąd", "Internet", "Woda"],
  ENTERTAINMENT: ["Netflix", "Kino", "Koncert", "Gry"],
  HEALTH: ["Apteka", "Siłownia", "Wizyta u lekarza"],
  SHOPPING: ["Amazon", "Odzież", "Elektronika"],
};

const INCOME_DESCRIPTIONS: Record<string, string[]> = {
  SALARY: ["Wynagrodzenie", "Premia kwartalna"],
  FREELANCE: ["Projekt IT", "Konsulting"],
  INVESTMENT: ["Dywidenda", "Odsetki"],
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function randomAmount(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(randomInt(8, 20), randomInt(0, 59), 0, 0);
  return d;
}

function daysAgoAtHour(days: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, randomInt(0, 59), 0, 0);
  return d;
}

function yearMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, passwordHash },
  });

  await prisma.accountBalanceDaily.deleteMany({
    where: { account: { userId: user.id } },
  });
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.portfolioTrade.deleteMany({ where: { userId: user.id } });
  await prisma.portfolioPosition.deleteMany({ where: { userId: user.id } });
  await prisma.bondHolding.deleteMany({
    where: { account: { userId: user.id } },
  });
  await prisma.account.deleteMany({ where: { userId: user.id } });
  await prisma.financialAccount.deleteMany({ where: { userId: user.id } });
  await prisma.category.deleteMany({ where: { userId: user.id } });

  const bankAccount = await prisma.account.create({
    data: {
      userId: user.id,
      type: "BANK",
      name: "Konto główne PLN",
      currency: "PLN",
      bankDetails: { create: { openingBalance: 5000 } },
    },
  });

  const categoryIds: Record<string, number> = {};
  for (const name of ROOT_EXPENSE) {
    categoryIds[name] = await ensureCategoryPath(prisma, user.id, "EXPENSE", name);
    if (name === "FOOD") {
      categoryIds["FOOD > Restauracje"] = await ensureCategoryPath(
        prisma,
        user.id,
        "EXPENSE",
        "FOOD > Restauracje",
      );
      categoryIds["FOOD > Sklepy"] = await ensureCategoryPath(
        prisma,
        user.id,
        "EXPENSE",
        "FOOD > Sklepy",
      );
    }
  }
  for (const name of ROOT_INCOME) {
    categoryIds[name] = await ensureCategoryPath(prisma, user.id, "INCOME", name);
  }

  async function pathFor(id: number): Promise<string> {
    return buildCategoryPath(prisma, user.id, id);
  }

  const transactions: {
    userId: number;
    type: string;
    amount: number;
    currency: string;
    category: string;
    categoryId: number;
    accountId: number | null;
    date: Date;
    description: string;
  }[] = [];

  for (let day = 0; day < 120; day++) {
    if (Math.random() < 0.35) {
      const useSubcategory = Math.random() < 0.25;
      const categoryKey = useSubcategory
        ? randomPick(["FOOD > Restauracje", "FOOD > Sklepy"] as const)
        : randomPick(ROOT_EXPENSE.filter((c) => c !== "FOOD"));
      const root = categoryKey.split(" > ")[0];
      const categoryId = categoryIds[categoryKey];
      const categoryPath = await pathFor(categoryId);
      transactions.push({
        userId: user.id,
        type: "EXPENSE",
        amount: randomAmount(15, root === "HOUSING" ? 2500 : 350),
        currency: Math.random() < 0.85 ? "PLN" : "EUR",
        category: categoryPath,
        categoryId,
        accountId: bankAccount.id,
        date: daysAgo(day),
        description: randomPick(EXPENSE_DESCRIPTIONS[root] ?? ["Wydatek"]),
      });
    }
    if (day % 30 === 0) {
      const category = randomPick(ROOT_INCOME);
      const categoryId = categoryIds[category];
      const categoryPath = await pathFor(categoryId);
      transactions.push({
        userId: user.id,
        type: "INCOME",
        amount: randomAmount(category === "SALARY" ? 8000 : 500, category === "SALARY" ? 12000 : 4000),
        currency: "PLN",
        category: categoryPath,
        categoryId,
        accountId: bankAccount.id,
        date: daysAgo(day),
        description: randomPick(INCOME_DESCRIPTIONS[category]),
      });
    }
  }

  await prisma.transaction.createMany({ data: transactions });

  const [usdPortfolio, eurPortfolio] = await Promise.all([
    prisma.account.create({
      data: {
        userId: user.id,
        type: "BROKERAGE",
        name: "Akcje USA",
        currency: "USD",
        brokerageDetails: { create: { baseCurrency: "USD", cashBalance: 0 } },
      },
    }),
    prisma.account.create({
      data: {
        userId: user.id,
        type: "BROKERAGE",
        name: "ETF Europa",
        currency: "EUR",
        brokerageDetails: { create: { baseCurrency: "EUR", cashBalance: 0 } },
      },
    }),
  ]);

  const transferTransactions = [
    {
      userId: user.id,
      type: "TRANSFER_TO_PORTFOLIO",
      amount: 3500,
      currency: "USD",
      category: "INVESTMENT",
      date: daysAgoAtHour(85, 12),
      description: "Zasilenie portfela Akcje USA",
      accountId: usdPortfolio.id,
    },
    {
      userId: user.id,
      type: "TRANSFER_TO_PORTFOLIO",
      amount: 1800,
      currency: "EUR",
      category: "INVESTMENT",
      date: daysAgoAtHour(70, 12),
      description: "Zasilenie portfela ETF Europa",
      accountId: eurPortfolio.id,
    },
    {
      userId: user.id,
      type: "TRANSFER_TO_PORTFOLIO",
      amount: 1200,
      currency: "USD",
      category: "INVESTMENT",
      date: daysAgoAtHour(32, 12),
      description: "Dodatkowe zasilenie portfela Akcje USA",
      accountId: usdPortfolio.id,
    },
  ];
  await prisma.transaction.createMany({ data: transferTransactions });

  const trades = [
    {
      userId: user.id,
      accountId: usdPortfolio.id,
      side: "BUY",
      symbol: "AAPL",
      quantity: 6,
      tradePrice: 178,
      tradeDate: daysAgoAtHour(80, 15),
      currency: "USD",
      category: "TECH",
    },
    {
      userId: user.id,
      accountId: usdPortfolio.id,
      side: "BUY",
      symbol: "MSFT",
      quantity: 3,
      tradePrice: 392,
      tradeDate: daysAgoAtHour(63, 15),
      currency: "USD",
      category: "TECH",
    },
    {
      userId: user.id,
      accountId: usdPortfolio.id,
      side: "SELL",
      symbol: "AAPL",
      quantity: 1,
      tradePrice: 201,
      tradeDate: daysAgoAtHour(20, 15),
      currency: "USD",
      category: "TECH",
    },
    {
      userId: user.id,
      accountId: eurPortfolio.id,
      side: "BUY",
      symbol: "VWCE.DE",
      quantity: 10,
      tradePrice: 102,
      tradeDate: daysAgoAtHour(66, 14),
      currency: "EUR",
      category: "ETF",
    },
    {
      userId: user.id,
      accountId: eurPortfolio.id,
      side: "BUY",
      symbol: "EUNL.DE",
      quantity: 5,
      tradePrice: 89,
      tradeDate: daysAgoAtHour(36, 14),
      currency: "EUR",
      category: "ETF",
    },
  ];
  await prisma.portfolioTrade.createMany({ data: trades });

  const symbols = ["AAPL", "MSFT", "VWCE.DE", "EUNL.DE"];
  const symbolCurrency: Record<string, string> = {
    AAPL: "USD",
    MSFT: "USD",
    "VWCE.DE": "EUR",
    "EUNL.DE": "EUR",
  };
  const startPrice: Record<string, number> = {
    AAPL: 170,
    MSFT: 370,
    "VWCE.DE": 96,
    "EUNL.DE": 84,
  };
  const dailyDrift: Record<string, number> = {
    AAPL: 0.45,
    MSFT: 0.5,
    "VWCE.DE": 0.16,
    "EUNL.DE": 0.14,
  };

  const assetBySymbol = new Map<string, number>();
  for (const symbol of symbols) {
    let asset = await prisma.asset.findFirst({
      where: { symbol, exchange: null, source: MARKET_SOURCE },
    });
    if (!asset) {
      asset = await prisma.asset.create({
        data: {
          symbol,
          assetType: symbol.includes(".") ? "ETF" : "STOCK",
          currency: symbolCurrency[symbol],
          exchange: null,
          source: MARKET_SOURCE,
        },
      });
    }
    assetBySymbol.set(symbol, asset.id);
  }

  const priceRows: {
    assetId: number;
    close: number;
    priceDate: Date;
    source: string;
    fetchedAt: Date;
  }[] = [];
  for (const symbol of symbols) {
    const assetId = assetBySymbol.get(symbol)!;
    for (let day = 75; day >= 0; day -= 1) {
      const trend = startPrice[symbol] + (75 - day) * dailyDrift[symbol];
      const noise = randomAmount(-2.2, 2.2);
      const close = Math.max(5, Math.round((trend + noise) * 100) / 100);
      priceRows.push({
        assetId,
        close,
        priceDate: daysAgoAtHour(day, 22),
        source: MARKET_SOURCE,
        fetchedAt: new Date(),
      });
    }
  }
  await prisma.marketPriceDaily.deleteMany({
    where: { assetId: { in: [...assetBySymbol.values()] }, source: MARKET_SOURCE },
  });
  await prisma.marketPriceDaily.createMany({ data: priceRows });

  const { backfillAccountBalanceHistory } = await import("../src/accountBalance");
  const { getFxRatesPlnPerUnit } = await import("../src/fx");
  const fx = await getFxRatesPlnPerUnit();
  for (const acc of [bankAccount, usdPortfolio, eurPortfolio]) {
    await backfillAccountBalanceHistory(prisma, user.id, acc.id, fx.plnPerUnit);
  }

  // eslint-disable-next-line no-console
  console.log(`Seed OK for user: ${DEMO_EMAIL} (password: ${DEMO_PASSWORD})`);
  // eslint-disable-next-line no-console
  console.log(
    `  ${transactions.length + transferTransactions.length} transactions, ${trades.length} trades, 1 bank + 2 brokerage accounts`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
