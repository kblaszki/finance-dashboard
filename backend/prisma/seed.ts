import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { canonicalUsernameKey, hashPassword } from "../src/auth";
import { marketHistoryDataDir } from "../src/domain/marketHistoryIo";
import { seedDemoAssetTrades } from "../src/domain/seedDemoAssetTrades";
import { seedDemoFxRates } from "../src/domain/seedDemoFxRates";
import { seedDemoMarkets } from "../src/domain/seedDemoMarkets";
import { seedDemoPortfolio } from "../src/domain/seedDemoPortfolio";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@finance.local";
const DEMO_USERNAME = "demo";
const DEMO_PASSWORD = "demo12345";

async function main(): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      username: DEMO_USERNAME,
      usernameKey: canonicalUsernameKey(DEMO_USERNAME),
      passwordHash,
    },
    update: {
      username: DEMO_USERNAME,
      usernameKey: canonicalUsernameKey(DEMO_USERNAME),
      passwordHash,
    },
  });

  await prisma.$transaction(async (tx) => {
    await seedDemoPortfolio(tx, user.id);
  });

  const fx = await seedDemoFxRates(prisma);
  if (fx.warning) {
    // eslint-disable-next-line no-console
    console.warn(`Demo FX: ${fx.warning}`);
  }

  const markets = await seedDemoMarkets(prisma, user.id, {
    historyDir: marketHistoryDataDir(
      path.resolve(__dirname, "../data/market-history"),
    ),
  });
  if (markets.fixtureMissing) {
    // eslint-disable-next-line no-console
    console.warn(
      `Demo markets: no history file at ${markets.fixturePath} — skipped`,
    );
  } else if (markets.skippedMissingInstruments.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `Demo markets: missing instruments (run market:sync-catalog + market:seed-universe): ${markets.skippedMissingInstruments.join(", ")}`,
    );
  }

  const trades = await seedDemoAssetTrades(prisma, user.id);
  if (trades.skipped.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `Demo asset trades skipped (${trades.skipped.length}): ${trades.skipped
        .slice(0, 5)
        .map((s) => `${s.trade.side} ${s.trade.providerSymbol}: ${s.reason}`)
        .join("; ")}${trades.skipped.length > 5 ? "…" : ""}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      id: user.id,
      email: user.email,
      username: user.username,
      fx: {
        source: fx.source,
        from: fx.from,
        to: fx.to,
        upserted: fx.upserted,
      },
      markets: {
        sourceKind: markets.sourceKind,
        fixturePath: markets.fixturePath,
        watchlistAdded: markets.watchlistAdded,
        valuationsUpserted: markets.valuationsUpserted,
      },
      trades: {
        applied: trades.applied,
        skipped: trades.skipped.length,
        openHoldings: trades.openHoldingsSummary,
      },
      note: "Demo user + sample portfolio + NBP/fallback FX + markets history + asset trades. Re-run wipes demo user data.",
    }),
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
