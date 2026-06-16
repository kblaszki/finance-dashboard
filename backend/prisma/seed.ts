import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { backfillAccountValuations } from "../src/accountValuation";
import { getFxRatesPlnPerUnit } from "../src/fx";
import { computeBalanceAfter } from "../src/transactionBalance";
import { computeQuantityAfter } from "../src/holdingLot";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@finance.local";
const DEMO_USERNAME = "demo";
const DEMO_PASSWORD = "demo12345";

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(12, 0, 0, 0);
  return d;
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { username: DEMO_USERNAME, passwordHash },
    create: { email: DEMO_EMAIL, username: DEMO_USERNAME, passwordHash },
  });

  await prisma.accountValuationDaily.deleteMany({
    where: { account: { userId: user.id } },
  });
  await prisma.holdingValuationDaily.deleteMany({
    where: { account: { userId: user.id } },
  });
  await prisma.holdingLot.deleteMany({ where: { account: { userId: user.id } } });
  await prisma.transaction.deleteMany({ where: { account: { userId: user.id } } });
  await prisma.account.deleteMany({ where: { userId: user.id } });

  const bank = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Main PLN",
      currency: "PLN",
      openingBalance: 5000,
      cashBalance: 5000,
    },
  });

  let cash = 5000;
  const txData = [
    { transactionType: "INCOME", amount: 8000, category: "SALARY", days: 60 },
    { transactionType: "EXPENSE", amount: 120, category: "FOOD", days: 45 },
    { transactionType: "EXPENSE", amount: 80, category: "TRANSPORT", days: 30 },
    { transactionType: "INCOME", amount: 8000, category: "SALARY", days: 15 },
    { transactionType: "EXPENSE", amount: 200, category: "SHOPPING", days: 5 },
  ] as const;

  for (const tx of txData) {
    cash = computeBalanceAfter(cash, tx.transactionType, tx.amount);
    await prisma.transaction.create({
      data: {
        accountId: bank.id,
        transactionType: tx.transactionType,
        amount: tx.amount,
        balanceAfter: cash,
        currency: "PLN",
        category: tx.category,
        date: daysAgo(tx.days),
        description: tx.category,
      },
    });
  }
  await prisma.account.update({ where: { id: bank.id }, data: { cashBalance: cash } });

  const brokerage = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "US Stocks",
      currency: "USD",
      openingBalance: 0,
      cashBalance: 10000,
    },
  });

  await prisma.transaction.create({
    data: {
      accountId: brokerage.id,
      transactionType: "TRANSFER_IN",
      amount: 10000,
      balanceAfter: 10000,
      currency: "USD",
      category: "INVESTMENT",
      date: daysAgo(50),
      description: "Initial funding",
    },
  });

  const aapl = await prisma.instrument.upsert({
    where: { symbol_exchange_source: { symbol: "AAPL", exchange: "NASDAQ", source: "manual" } },
    update: {},
    create: {
      instrumentType: "STOCK",
      symbol: "AAPL",
      name: "Apple Inc.",
      exchange: "NASDAQ",
      currency: "USD",
      source: "manual",
    },
  });

  for (let day = 40; day >= 0; day -= 5) {
    await prisma.instrumentValuation.upsert({
      where: {
        instrumentId_valuationDate_source: {
          instrumentId: aapl.id,
          valuationDate: daysAgo(day),
          source: "manual",
        },
      },
      update: { price: 170 + (40 - day) * 0.5 },
      create: {
        instrumentId: aapl.id,
        valuationDate: daysAgo(day),
        price: 170 + (40 - day) * 0.5,
        currency: "USD",
        source: "manual",
      },
    });
  }

  const buyQty = 10;
  const buyPrice = 175;
  const total = buyQty * buyPrice;
  let brokerCash = 10000 - total;
  const qtyAfter = computeQuantityAfter(0, "BUY", buyQty);

  await prisma.holdingLot.create({
    data: {
      accountId: brokerage.id,
      instrumentId: aapl.id,
      side: "BUY",
      quantity: buyQty,
      quantityAfter: qtyAfter,
      totalPrice: total,
      pricePerUnit: buyPrice,
      currency: "USD",
      tradeDate: daysAgo(35),
    },
  });
  await prisma.account.update({ where: { id: brokerage.id }, data: { cashBalance: brokerCash } });

  const { plnPerUnit } = await getFxRatesPlnPerUnit();
  await backfillAccountValuations(prisma, bank.id, plnPerUnit);
  await backfillAccountValuations(prisma, brokerage.id, plnPerUnit);

  // eslint-disable-next-line no-console
  console.log(`Seed OK: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (username: ${DEMO_USERNAME})`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
