import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const APP_CONFIG_MARKET_LIVE_API = "marketLiveApi";
/** UTC YYYY-MM-DD of last completed allowlist Yahoo gap-fill (cron + in-process day-lock). */
export const APP_CONFIG_YAHOO_GAP_SYNC_LAST_RUN = "yahooGapSyncLastRunYmd";

function parseBool(raw: string | undefined | null): boolean {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/** Missing row ⇒ false (live market HTTP fetches off by default). */
export async function getMarketLiveApi(db: Db): Promise<boolean> {
  const row = await db.appConfig.findUnique({
    where: { key: APP_CONFIG_MARKET_LIVE_API },
  });
  return parseBool(row?.value);
}

export async function setMarketLiveApi(
  db: Db,
  enabled: boolean,
): Promise<boolean> {
  await db.appConfig.upsert({
    where: { key: APP_CONFIG_MARKET_LIVE_API },
    create: {
      key: APP_CONFIG_MARKET_LIVE_API,
      value: enabled ? "true" : "false",
    },
    update: { value: enabled ? "true" : "false" },
  });
  return enabled;
}

export async function getYahooGapSyncLastRunYmd(
  db: Db,
): Promise<string | null> {
  const row = await db.appConfig.findUnique({
    where: { key: APP_CONFIG_YAHOO_GAP_SYNC_LAST_RUN },
  });
  const v = String(row?.value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function setYahooGapSyncLastRunYmd(
  db: Db,
  ymd: string,
): Promise<string> {
  const value = String(ymd).trim();
  await db.appConfig.upsert({
    where: { key: APP_CONFIG_YAHOO_GAP_SYNC_LAST_RUN },
    create: { key: APP_CONFIG_YAHOO_GAP_SYNC_LAST_RUN, value },
    update: { value },
  });
  return value;
}

/**
 * Compare-and-set day-lock: writes `ymd` only when missing or different.
 * Returns true when this caller set (or already held) today's value.
 */
export async function claimYahooGapSyncLastRunYmd(
  db: Db,
  ymd: string,
): Promise<boolean> {
  const value = String(ymd).trim();
  const existing = await getYahooGapSyncLastRunYmd(db);
  if (existing === value) return true;

  if (existing == null) {
    try {
      await db.appConfig.create({
        data: { key: APP_CONFIG_YAHOO_GAP_SYNC_LAST_RUN, value },
      });
      return true;
    } catch {
      const again = await getYahooGapSyncLastRunYmd(db);
      return again === value;
    }
  }

  const updated = await db.appConfig.updateMany({
    where: {
      key: APP_CONFIG_YAHOO_GAP_SYNC_LAST_RUN,
      NOT: { value },
    },
    data: { value },
  });
  if (updated.count > 0) return true;
  return (await getYahooGapSyncLastRunYmd(db)) === value;
}

export type AppConfigPayload = {
  marketLiveApi: boolean;
};

export async function getAppConfigPayload(db: Db): Promise<AppConfigPayload> {
  return { marketLiveApi: await getMarketLiveApi(db) };
}
