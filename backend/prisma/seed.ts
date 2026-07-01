import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { backfillAccountValuations } from "../src/accountValuation";
import { ensureDefaultCategories } from "../src/categories";
import { getFxRatesPlnPerUnit } from "../src/fx";
import { syncFxRatesSinceEpoch } from "../src/fxHistorySync";
import {
  BANK_HISTORY_MONTHS,
  DEMO_EMAIL,
  DEMO_HISTORY_DAYS,
  DEMO_PASSWORD,
  DEMO_USERNAME,
  EU_INSTRUMENTS,
  GOLD_PROVIDER_SYMBOL,
  GPW_BOND_INSTRUMENT,
  GPW_INSTRUMENTS,
  IKZE_INSTRUMENTS,
  SEED_MARKET_OUTPUTSIZE,
  UNIQUE_DEMO_STOCK_SYMBOLS,
  US_INSTRUMENTS,
} from "./demo/seedConfig";
import {
  fetchDemoMarketHistory,
  providerSymbolForInstrument,
} from "./demo/marketHistory";
import { daysAgo } from "./demo/tradePlanner";
import {
  buildBankMonthTemplates,
  loadCategoryIdMap,
  seedBankTransactions,
  seedBrokerageFromMarket,
  seedManualBondValuations,
  seedMvpExtras,
  seedPreciousMetalAccount,
  seedQuarterlyBrokerInvestments,
  seedRealEstateAccount,
  upsertInstrument,
} from "./demo/seedBuilders";
import { cleanupManualInstrumentValuations, deleteDemoUser } from "./demo/wipe";

const prisma = new PrismaClient();

async function main() {
  const apiKey = process.env.MARKET_DATA_API_KEY?.trim();
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.error(
      "MARKET_DATA_API_KEY is required for demo seed (Twelve Data EOD prices).\n" +
        "Set it in backend/.env — see README Demo data section.",
    );
    process.exit(1);
  }

  await cleanupManualInstrumentValuations(prisma, [
    ...UNIQUE_DEMO_STOCK_SYMBOLS,
    "XAU",
  ]);
  await deleteDemoUser(prisma);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.create({
    data: { email: DEMO_EMAIL, username: DEMO_USERNAME, passwordHash },
  });

  await ensureDefaultCategories(prisma, user.id);
  const categoryIds = await loadCategoryIdMap(prisma, user.id);

  const providerSymbols = [
    ...GPW_INSTRUMENTS,
    ...US_INSTRUMENTS,
    ...EU_INSTRUMENTS,
    ...IKZE_INSTRUMENTS,
  ]
    .map(providerSymbolForInstrument)
    .filter((s): s is string => s != null);
  providerSymbols.push(GOLD_PROVIDER_SYMBOL);

  // eslint-disable-next-line no-console
  console.log(
    `Fetching EOD history (${SEED_MARKET_OUTPUTSIZE} bars) for ${providerSymbols.length} symbols…`,
  );
  const barsByProvider = await fetchDemoMarketHistory(providerSymbols, {
    apiKey,
    outputsize: SEED_MARKET_OUTPUTSIZE,
  });

  const bank = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Main PLN",
      currency: "PLN",
      openingBalance: 35_000,
      cashBalance: 35_000,
      createdAt: daysAgo(BANK_HISTORY_MONTHS * 30),
    },
  });
  await seedBankTransactions(
    prisma,
    bank.id,
    "PLN",
    35_000,
    buildBankMonthTemplates(BANK_HISTORY_MONTHS),
    categoryIds,
  );

  const gpwBroker = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "GPW Stocks",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
      createdAt: daysAgo(DEMO_HISTORY_DAYS + 20),
    },
  });
  await seedBrokerageFromMarket(
    prisma,
    gpwBroker.id,
    150_000,
    "PLN",
    DEMO_HISTORY_DAYS + 10,
    GPW_INSTRUMENTS,
    barsByProvider,
    providerSymbolForInstrument,
  );

  const bondInstrument = await upsertInstrument(prisma, GPW_BOND_INSTRUMENT);
  await seedManualBondValuations(prisma, bondInstrument.id, "PLN", 100);
  const gpwAfterStocks = await prisma.account.findUniqueOrThrow({ where: { id: gpwBroker.id } });
  const bondDeploy = Math.floor(Number(gpwAfterStocks.cashBalance) * 0.18);
  if (bondDeploy > 1_000) {
    await seedQuarterlyBrokerInvestments(
      prisma,
      0,
      DEMO_HISTORY_DAYS - 45,
      [
        {
          accountId: gpwBroker.id,
          currency: "PLN",
          amount: bondDeploy,
          instrument: GPW_BOND_INSTRUMENT,
        },
      ],
      barsByProvider,
      providerSymbolForInstrument,
    );
  }

  const usBroker = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "US Stocks",
      currency: "USD",
      openingBalance: 0,
      cashBalance: 0,
      createdAt: daysAgo(DEMO_HISTORY_DAYS + 20),
    },
  });
  await seedBrokerageFromMarket(
    prisma,
    usBroker.id,
    130_000,
    "USD",
    DEMO_HISTORY_DAYS + 10,
    US_INSTRUMENTS,
    barsByProvider,
    providerSymbolForInstrument,
  );

  const euBroker = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "EU ETF",
      currency: "EUR",
      openingBalance: 0,
      cashBalance: 0,
      createdAt: daysAgo(DEMO_HISTORY_DAYS + 20),
    },
  });
  await seedBrokerageFromMarket(
    prisma,
    euBroker.id,
    95_000,
    "EUR",
    DEMO_HISTORY_DAYS + 10,
    EU_INSTRUMENTS,
    barsByProvider,
    providerSymbolForInstrument,
  );

  const ikzeBroker = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "IKZE",
      currency: "USD",
      openingBalance: 0,
      cashBalance: 0,
      taxWrapperType: "ikze",
      createdAt: daysAgo(DEMO_HISTORY_DAYS + 20),
    },
  });
  await seedBrokerageFromMarket(
    prisma,
    ikzeBroker.id,
    32_000,
    "USD",
    DEMO_HISTORY_DAYS + 10,
    IKZE_INSTRUMENTS,
    barsByProvider,
    providerSymbolForInstrument,
  );

  const goldAccount = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "PRECIOUS_METAL",
      name: "Gold",
      currency: "USD",
      openingBalance: 0,
      cashBalance: 0,
      createdAt: daysAgo(DEMO_HISTORY_DAYS + 20),
    },
  });

  const realEstate = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "REAL_ESTATE",
      name: "Apartment Warsaw",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
      rentalTaxMethod: "lump_sum_8_5",
      description: "Rental property — Mokotów",
      createdAt: daysAgo(DEMO_HISTORY_DAYS + 20),
    },
  });

  const quarters = Math.floor(BANK_HISTORY_MONTHS / 3);
  for (let q = 0; q < quarters; q++) {
    const bump = (q % 3) * 500;
    await seedQuarterlyBrokerInvestments(
      prisma,
      q,
      q * 90 + 26,
      [
        {
          accountId: gpwBroker.id,
          currency: "PLN",
          amount: 10_500 + bump,
          instrument: GPW_INSTRUMENTS[0]!,
        },
        {
          accountId: gpwBroker.id,
          currency: "PLN",
          amount: 4_500 + Math.round(bump * 0.4),
          instrument: GPW_BOND_INSTRUMENT,
        },
        {
          accountId: usBroker.id,
          currency: "USD",
          amount: 3_900 + q * 120,
          instrument: US_INSTRUMENTS[2]!,
        },
        {
          accountId: euBroker.id,
          currency: "EUR",
          amount: 1_700 + q * 70,
          instrument: EU_INSTRUMENTS[0]!,
        },
        {
          accountId: ikzeBroker.id,
          currency: "USD",
          amount: 1_300 + q * 40,
          instrument: IKZE_INSTRUMENTS[0]!,
        },
      ],
      barsByProvider,
      providerSymbolForInstrument,
    );
  }

  await syncFxRatesSinceEpoch(prisma).catch(() => {});
  const { plnPerUnit } = await getFxRatesPlnPerUnit();

  const xauBars = barsByProvider.get(GOLD_PROVIDER_SYMBOL);
  if (!xauBars?.length) {
    throw new Error(`No EOD bars for ${GOLD_PROVIDER_SYMBOL}`);
  }
  await seedPreciousMetalAccount(prisma, goldAccount.id, xauBars, plnPerUnit);
  await seedRealEstateAccount(prisma, user.id, realEstate.id, plnPerUnit);

  const euEtf = await upsertInstrument(prisma, EU_INSTRUMENTS[0]!);

  await seedMvpExtras(prisma, user.id, {
    bankAccountId: bank.id,
    usBrokerId: usBroker.id,
    euBrokerId: euBroker.id,
    ikzeBrokerId: ikzeBroker.id,
    realEstateAccountId: realEstate.id,
    categoryIds,
    euInstrumentId: euEtf.id,
    gpwBondInstrumentId: bondInstrument.id,
    gpwBrokerId: gpwBroker.id,
  });

  const accountIds = [
    bank.id,
    gpwBroker.id,
    usBroker.id,
    euBroker.id,
    ikzeBroker.id,
    goldAccount.id,
    realEstate.id,
  ];
  for (const accountId of accountIds) {
    await backfillAccountValuations(prisma, accountId, plnPerUnit);
  }

  const accounts = await prisma.account.findMany({ where: { userId: user.id } });
  // eslint-disable-next-line no-console
  console.log(`Seed OK: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (username: ${DEMO_USERNAME})`);
  for (const a of accounts) {
    // eslint-disable-next-line no-console
    console.log(`  ${a.accountType} ${a.name}: cash=${Number(a.cashBalance)} ${a.currency}`);
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
