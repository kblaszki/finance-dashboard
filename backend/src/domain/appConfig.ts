import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const APP_CONFIG_MARKET_LIVE_API = "marketLiveApi";

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

export type AppConfigPayload = {
  marketLiveApi: boolean;
};

export async function getAppConfigPayload(db: Db): Promise<AppConfigPayload> {
  return { marketLiveApi: await getMarketLiveApi(db) };
}
