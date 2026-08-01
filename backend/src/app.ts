import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { assertProductionEnvironment } from "./authConfig";
import { handleRouteError } from "./lib/errors";
import { mountApiRouters } from "./routes/mountRouters";

dotenv.config();
assertProductionEnvironment();

const app = express();
const prisma = new PrismaClient();

const corsOrigin = process.env.CORS_ORIGIN?.trim();
app.use(
  corsOrigin
    ? cors({ origin: corsOrigin })
    : cors(),
);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "1mb" }));

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
if (process.env.NODE_ENV === "production") {
  app.use("/api/auth/login", authRateLimiter);
  app.use("/api/auth/register", authRateLimiter);
}

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: true });
  } catch {
    res.status(503).json({ ok: false, db: false });
  }
});

mountApiRouters(app, prisma);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  handleRouteError(res, err, "Internal server error");
});

const PORT = process.env.PORT || 4000;

/* c8 ignore start */
if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
}
/* c8 ignore end */

export { app, prisma };
