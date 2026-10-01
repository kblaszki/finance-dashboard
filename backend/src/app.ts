import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  assertProductionEnvironment,
  resolveTrustProxySetting,
} from "./authConfig";
import {
  mountApiNotFound,
  mountSecurityMiddleware,
  mountStaticAndSpa,
} from "./httpConfig";
import { handleRouteError } from "./lib/errors";
import { mountApiRouters } from "./routes/mountRouters";

dotenv.config();
assertProductionEnvironment();

const app = express();
const prisma = new PrismaClient();

const trustProxy = resolveTrustProxySetting();
if (trustProxy !== false) {
  app.set("trust proxy", trustProxy);
}

mountSecurityMiddleware(app);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "1mb" }));

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

export function mountProductionAuthRateLimit(
  target: Express,
  nodeEnv: string | undefined = process.env.NODE_ENV,
  limiter = authRateLimiter,
): void {
  if (nodeEnv !== "production") return;
  for (const path of [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/password",
    "/api/auth/email",
  ]) {
    target.use(path, limiter);
  }
}

mountProductionAuthRateLimit(app);

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: true });
  } catch (error: unknown) {
    const name = error instanceof Error ? error.name : "Error";
    // eslint-disable-next-line no-console
    console.error("Health check failed", name);
    res.status(503).json({ ok: false, db: false });
  }
});

mountApiRouters(app, prisma);
mountApiNotFound(app);
mountStaticAndSpa(app);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  handleRouteError(res, err, "Internal server error");
});

const PORT = Number(process.env.PORT) || 4000;

/* c8 ignore start */
if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://0.0.0.0:${PORT}`);
  });
}
/* c8 ignore end */

export { app, prisma };
