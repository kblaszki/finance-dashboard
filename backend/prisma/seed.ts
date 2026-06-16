import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { backfillAccountValuations } from "../src/accountValuation";
import { getFxRatesPlnPerUnit } from "../src/fx";
import {
  buildBankMonthTemplates,
  daysAgo,
  seedBankTransactions,
  seedHoldingLots,
  seedInstrumentValuations,
  seedTransferIn,
  upsertInstrument,
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
  await prisma.holdingLot.deleteMany({ where: { account: { userId } } });
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
      createdAt: daysAgo(75),
    },
  });
  await seedTransferIn(prisma, usBroker.id, 25000, "USD", 70);

  const aapl = await upsertInstrument(prisma, {
    instrumentType: "STOCK",
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    currency: "USD",
  });
  const vt = await upsertInstrument(prisma, {
    instrumentType: "ETF",
    symbol: "VT",
    name: "Vanguard Total World Stock ETF",
    exchange: "NYSE",
    currency: "USD",
  });

  await seedInstrumentValuations(prisma, aapl.id, "USD", 65, 0, 2, (day) => 170 + (65 - day) * 0.3);
  await seedInstrumentValuations(prisma, vt.id, "USD", 60, 0, 3, (day) => 95 + (60 - day) * 0.1);

  let usCash = 25000;
  usCash = await seedHoldingLots(
    prisma,
    usBroker.id,
    aapl.id,
    "USD",
    [
      { side: "BUY", quantity: 10, pricePerUnit: 175, days: 60 },
      { side: "SELL", quantity: 3, pricePerUnit: 190, days: 35 },
    ],
    usCash,
  );
  await seedHoldingLots(
    prisma,
    usBroker.id,
    vt.id,
    "USD",
    [{ side: "BUY", quantity: 20, pricePerUnit: 98, days: 45 }],
    usCash,
  );

  const euBroker = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "EU ETF",
      currency: "EUR",
      openingBalance: 0,
      cashBalance: 0,
      createdAt: daysAgo(50),
    },
  });
  await seedTransferIn(prisma, euBroker.id, 15000, "EUR", 48);

  const iwda = await upsertInstrument(prisma, {
    instrumentType: "ETF",
    symbol: "IWDA",
    name: "iShares MSCI World",
    exchange: "LSE",
    currency: "EUR",
  });
  await seedInstrumentValuations(prisma, iwda.id, "EUR", 45, 0, 2, (day) => 78 + (45 - day) * 0.15);
  await seedHoldingLots(
    prisma,
    euBroker.id,
    iwda.id,
    "EUR",
    [{ side: "BUY", quantity: 80, pricePerUnit: 80, days: 40 }],
    15000,
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
