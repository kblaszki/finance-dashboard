import fs from "node:fs";
import path from "node:path";
import type { Express, NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import express from "express";

export type CorsMode =
  | { kind: "open" }
  | { kind: "off" }
  | { kind: "origin"; origin: string };

/** Helmet CSP allows the Vite SPA (inline theme script + Google Fonts). */
export const productionHelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
} as const;

export function resolveCorsMode(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  corsOrigin: string | undefined = process.env.CORS_ORIGIN,
  appOrigin: string | undefined = process.env.APP_ORIGIN,
): CorsMode {
  const explicit = corsOrigin?.trim() || appOrigin?.trim();
  if (explicit) return { kind: "origin", origin: explicit };
  if (nodeEnv === "production") return { kind: "off" };
  return { kind: "open" };
}

export function resolveStaticDir(
  raw: string | undefined = process.env.STATIC_DIR,
  bundledDir: string = path.join(__dirname, "..", "public"),
): string | null {
  const candidate = raw?.trim() ? raw.trim() : bundledDir;
  try {
    if (fs.existsSync(path.join(candidate, "index.html"))) return candidate;
  } catch {
    return null;
  }
  return null;
}

export function mountSecurityMiddleware(app: Express, nodeEnv: string | undefined = process.env.NODE_ENV): void {
  if (nodeEnv === "production") {
    app.use(helmet(productionHelmetOptions));
  }
  const corsMode = resolveCorsMode(nodeEnv);
  if (corsMode.kind === "open") {
    app.use(cors());
  } else if (corsMode.kind === "origin") {
    app.use(cors({ origin: corsMode.origin }));
  }
}

export function mountApiNotFound(app: Express): void {
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
}

export function mountStaticAndSpa(app: Express): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const dir = resolveStaticDir();
    if (!dir) {
      next();
      return;
    }
    express.static(dir)(req, res, next);
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const dir = resolveStaticDir();
    if (!dir) {
      next();
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    res.sendFile(path.join(dir, "index.html"));
  });
}
