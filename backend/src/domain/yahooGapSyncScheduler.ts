import type { PrismaClient } from "@prisma/client";
import { syncYahooAllowlistGaps } from "./yahooHistory";

const DEFAULT_UTC_HOUR = 21;
const DEFAULT_POLL_MS = 15 * 60 * 1000;

export function isMarketYahooGapSyncEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const v = String(env.MARKET_YAHOO_GAP_SYNC ?? "")
    .trim()
    .toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export function marketYahooGapSyncUtcHour(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = Number(env.MARKET_YAHOO_GAP_SYNC_UTC_HOUR);
  if (!Number.isInteger(raw) || raw < 0 || raw > 23) return DEFAULT_UTC_HOUR;
  return raw;
}

/**
 * When `MARKET_YAHOO_GAP_SYNC` is enabled, poll until the configured UTC hour,
 * then run allowlist Yahoo gap-fill (AppConfig day-lock prevents repeats).
 * Never throws into the HTTP process.
 */
export function startYahooGapSyncScheduler(
  prisma: PrismaClient,
  options: {
    env?: NodeJS.ProcessEnv;
    pollMs?: number;
    now?: () => Date;
    run?: typeof syncYahooAllowlistGaps;
    log?: (msg: string) => void;
  } = {},
): { stop: () => void } | null {
  const env = options.env ?? process.env;
  if (!isMarketYahooGapSyncEnabled(env)) return null;

  const hour = marketYahooGapSyncUtcHour(env);
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
  const nowFn = options.now ?? (() => new Date());
  const run = options.run ?? syncYahooAllowlistGaps;
  const log =
    options.log ??
    ((msg: string) => {
      // eslint-disable-next-line no-console
      console.log(msg);
    });

  let running = false;
  const tick = (): void => {
    if (running) return;
    const now = nowFn();
    if (now.getUTCHours() < hour) return;
    running = true;
    void (async () => {
      try {
        log(`[yahoo-gap-sync] starting (utcHour>=${hour})`);
        const result = await run(prisma, { delayMs: 250 });
        log(`[yahoo-gap-sync] done ${JSON.stringify(result)}`);
      } catch (e: unknown) {
        log(
          `[yahoo-gap-sync] failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        running = false;
      }
    })();
  };

  tick();
  const handle = setInterval(tick, pollMs);
  if (typeof handle.unref === "function") handle.unref();

  return {
    stop: () => {
      clearInterval(handle);
    },
  };
}
