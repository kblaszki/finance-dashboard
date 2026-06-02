import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@finance.local";
const DEMO_PASSWORD = "demo12345";
const MARKET_SOURCE = "DEMO_SEED";

const EXPENSE_CATEGORIES = ["FOOD", "TRANSPORT", "HOUSING", "ENTERTAINMENT", "HEALTH", "SHOPPING"];
const INCOME_CATEGORIES = ["SALARY", "FREELANCE", "INVESTMENT"];

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

  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.portfolioTrade.deleteMany({ where: { userId: user.id } });
  await prisma.portfolioPosition.deleteMany({ where: { userId: user.id } });
  await prisma.budget.deleteMany({ where: { userId: user.id } });
  await prisma.investmentPortfolio.deleteMany({ where: { userId: user.id } });

  const transactions: {
    userId: number;
    type: string;
    amount: number;
    currency: string;
    category: string;
    date: Date;
    description: string;
  }[] = [];

  for (let day = 0; day < 120; day++) {
    if (Math.random() < 0.35) {
      const category = randomPick(EXPENSE_CATEGORIES);
      transactions.push({
        userId: user.id,
        type: "EXPENSE",
        amount: randomAmount(15, category === "HOUSING" ? 2500 : 350),
        currency: Math.random() < 0.85 ? "PLN" : "EUR",
        category,
        date: daysAgo(day),
        description: randomPick(EXPENSE_DESCRIPTIONS[category]),
      });
    }
    if (day % 30 === 0) {
      const category = randomPick(INCOME_CATEGORIES);
      transactions.push({
        userId: user.id,
        type: "INCOME",
        amount: randomAmount(category === "SALARY" ? 8000 : 500, category === "SALARY" ? 12000 : 4000),
        currency: "PLN",
        category,
        date: daysAgo(day),
        description: randomPick(INCOME_DESCRIPTIONS[category]),
      });
    }
  }

  await prisma.transaction.createMany({ data: transactions });

  const [usdPortfolio, eurPortfolio] = await Promise.all([
    prisma.investmentPortfolio.create({
      data: {
        userId: user.id,
        name: "Akcje USA",
        baseCurrency: "USD",
        cashBalance: 0,
      },
    }),
    prisma.investmentPortfolio.create({
      data: {
        userId: user.id,
        name: "ETF Europa",
        baseCurrency: "EUR",
        cashBalance: 0,
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
      portfolioId: usdPortfolio.id,
    },
    {
      userId: user.id,
      type: "TRANSFER_TO_PORTFOLIO",
      amount: 1800,
      currency: "EUR",
      category: "INVESTMENT",
      date: daysAgoAtHour(70, 12),
      description: "Zasilenie portfela ETF Europa",
      portfolioId: eurPortfolio.id,
    },
    {
      userId: user.id,
      type: "TRANSFER_TO_PORTFOLIO",
      amount: 1200,
      currency: "USD",
      category: "INVESTMENT",
      date: daysAgoAtHour(32, 12),
      description: "Dodatkowe zasilenie portfela Akcje USA",
      portfolioId: usdPortfolio.id,
    },
  ];
  await prisma.transaction.createMany({ data: transferTransactions });

  const trades = [
    {
      userId: user.id,
      portfolioId: usdPortfolio.id,
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
      portfolioId: usdPortfolio.id,
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
      portfolioId: usdPortfolio.id,
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
      portfolioId: eurPortfolio.id,
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
      portfolioId: eurPortfolio.id,
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

  await prisma.marketPriceSnapshot.deleteMany({
    where: { source: MARKET_SOURCE, symbol: { in: symbols } },
  });
  await prisma.marketPriceHistory.deleteMany({
    where: { source: MARKET_SOURCE, symbol: { in: symbols } },
  });

  const historyRows: {
    symbol: string;
    currency: string;
    close: number;
    priceDate: Date;
    source: string;
    fetchedAt: Date;
  }[] = [];
  for (const symbol of symbols) {
    for (let day = 75; day >= 0; day -= 1) {
      const trend = startPrice[symbol] + (75 - day) * dailyDrift[symbol];
      const noise = randomAmount(-2.2, 2.2);
      const close = Math.max(5, Math.round((trend + noise) * 100) / 100);
      historyRows.push({
        symbol,
        currency: symbolCurrency[symbol],
        close,
        priceDate: daysAgoAtHour(day, 22),
        source: MARKET_SOURCE,
        fetchedAt: new Date(),
      });
    }
  }
  await prisma.marketPriceHistory.createMany({ data: historyRows });

  const latestBySymbol = new Map<string, (typeof historyRows)[number]>();
  for (const row of historyRows) {
    const prev = latestBySymbol.get(row.symbol);
    if (!prev || row.priceDate > prev.priceDate) latestBySymbol.set(row.symbol, row);
  }
  await prisma.marketPriceSnapshot.createMany({
    data: Array.from(latestBySymbol.values()).map((row) => ({
      symbol: row.symbol,
      currency: row.currency,
      close: row.close,
      priceDate: row.priceDate,
      source: row.source,
      fetchedAt: row.fetchedAt,
    })),
  });

  const now = new Date();
  const months = [yearMonth(now)];
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  months.push(yearMonth(prev));

  for (const ym of months) {
    await prisma.budget.create({
      data: {
        userId: user.id,
        yearMonth: ym,
        category: "",
        limitAmount: 8000,
        currency: "PLN",
      },
    });
    for (const cat of ["FOOD", "TRANSPORT", "ENTERTAINMENT"]) {
      const limits: Record<string, number> = {
        FOOD: 1200,
        TRANSPORT: 600,
        ENTERTAINMENT: 400,
      };
      await prisma.budget.create({
        data: {
          userId: user.id,
          yearMonth: ym,
          category: cat,
          limitAmount: limits[cat],
          currency: "PLN",
        },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Seed OK for user: ${DEMO_EMAIL} (password: ${DEMO_PASSWORD})`);
  // eslint-disable-next-line no-console
  console.log(
    `  ${transactions.length + transferTransactions.length} transactions, ${trades.length} trades, ${months.length * 4} budgets`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
