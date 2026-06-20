import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { backfillAccountValuations } from "../src/accountValuation";
import { getFxRatesPlnPerUnit } from "../src/fx";
import {
  BROKERAGE_HISTORY_DAYS,
  buildBankMonthTemplates,
  daysAgo,
  EU_BROKERAGE_INSTRUMENTS,
  seedBankTransactions,
  seedBrokerageDemo,
  US_BROKERAGE_INSTRUMENTS,
} from "./seedBuilders";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@finance.local";
const DEMO_USERNAME = "demo";
const DEMO_PASSWORD = "demo12345";

async function clearUserData(userId: number): Promise<void> {
  await prisma.accountValuationDaily.deleteMany({
    where: { account: { userId } },
  });
  await prisma.holdingValuationDaily.deleteMany({
    where: { account: { userId } },
  });
  await prisma.holdingLot.deleteMany({ where: { holding: { account: { userId } } } });
  await prisma.holding.deleteMany({ where: { account: { userId } } });
  await prisma.transaction.deleteMany({ where: { account: { userId } } });
  await prisma.account.deleteMany({ where: { userId } });
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { username: DEMO_USERNAME, passwordHash },
    create: { email: DEMO_EMAIL, username: DEMO_USERNAME, passwordHash },
  });

  await clearUserData(user.id);

  const bank = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Main PLN",
      currency: "PLN",
      openingBalance: 5000,
      cashBalance: 5000,
      createdAt: daysAgo(90),
    },
  });
  await seedBankTransactions(prisma, bank.id, "PLN", 5000, buildBankMonthTemplates());

  const usBroker = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "US Stocks",
      currency: "USD",
      openingBalance: 0,
      cashBalance: 0,
      createdAt: daysAgo(BROKERAGE_HISTORY_DAYS + 20),
    },
  });
  await seedBrokerageDemo(
    prisma,
    usBroker.id,
    150_000,
    "USD",
    BROKERAGE_HISTORY_DAYS + 10,
    US_BROKERAGE_INSTRUMENTS,
  );

  const euBroker = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "EU ETF",
      currency: "EUR",
      openingBalance: 0,
      cashBalance: 0,
      createdAt: daysAgo(BROKERAGE_HISTORY_DAYS + 20),
    },
  });
  await seedBrokerageDemo(
    prisma,
    euBroker.id,
    100_000,
    "EUR",
    BROKERAGE_HISTORY_DAYS + 10,
    EU_BROKERAGE_INSTRUMENTS,
  );

  const manual = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "MANUAL",
      name: "Apartment Warsaw",
      currency: "PLN",
      openingBalance: 850000,
      cashBalance: 850000,
      description: "Estimated market value — manual tracking",
      createdAt: daysAgo(120),
    },
  });

  const { plnPerUnit } = await getFxRatesPlnPerUnit();
  for (const accountId of [bank.id, usBroker.id, euBroker.id, manual.id]) {
    await backfillAccountValuations(prisma, accountId, plnPerUnit);
  }

  const accounts = await prisma.account.findMany({ where: { userId: user.id } });
  // eslint-disable-next-line no-console
  console.log(`Seed OK: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (username: ${DEMO_USERNAME})`);
  for (const a of accounts) {
    // eslint-disable-next-line no-console
    console.log(`  ${a.accountType} ${a.name}: cash=${Number(a.cashBalance)} ${a.currency}`);
  }
  void manual;
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
