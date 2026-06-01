import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@finance.local";
const DEMO_PASSWORD = "demo12345";

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
  await prisma.portfolioPosition.deleteMany({ where: { userId: user.id } });
  await prisma.budget.deleteMany({ where: { userId: user.id } });

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

  await prisma.portfolioPosition.createMany({
    data: [
      {
        userId: user.id,
        symbol: "AAPL",
        quantity: 5,
        buyPrice: 170,
        currentPrice: 198,
        currency: "USD",
        category: "TECH",
      },
      {
        userId: user.id,
        symbol: "MSFT",
        quantity: 3,
        buyPrice: 380,
        currentPrice: 415,
        currency: "USD",
        category: "TECH",
      },
      {
        userId: user.id,
        symbol: "VWCE.DE",
        quantity: 12,
        buyPrice: 98,
        currentPrice: 112,
        currency: "EUR",
        category: "ETF",
      },
      {
        userId: user.id,
        symbol: "PKO",
        quantity: 50,
        buyPrice: 42,
        currentPrice: 48.5,
        currency: "PLN",
        category: "BANKS",
      },
    ],
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
    `  ${transactions.length} transactions, 4 portfolio positions, ${months.length * 4} budgets`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
