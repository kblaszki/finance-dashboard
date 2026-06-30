import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import { importBrokerTrades, type ImportTradesInput } from "../import/importTrades";
import { importBankTransactions, type ImportBankInput } from "../import/importBankTransactions";
import type { BrokerId } from "../import/types";
import type { BankId } from "../import/bankTypes";
import { badRequest, handleRouteError, notFound, parseFiniteNumber, parseIdParam, parsePositiveNumber } from "./httpSupport";

type ImportDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  getFxRatesPlnPerUnit: () => Promise<{ asOf: string; plnPerUnit: Record<string, number> }>;
};

const BROKERS = new Set<BrokerId>(["xtb"]);
const BANKS = new Set<BankId>(["mbank", "generic"]);

function parseBroker(value: unknown): BrokerId {
  const broker = String(value ?? "xtb").trim().toLowerCase();
  if (!BROKERS.has(broker as BrokerId)) {
    throw badRequest(`Unsupported broker: ${broker}`);
  }
  return broker as BrokerId;
}

function parseBank(value: unknown): BankId {
  const bank = String(value ?? "generic").trim().toLowerCase();
  if (!BANKS.has(bank as BankId)) {
    throw badRequest(`Unsupported bank preset: ${bank}`);
  }
  return bank as BankId;
}

export function createImportRouter(deps: ImportDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid, getFxRatesPlnPerUnit } = deps;

  router.post("/api/import/broker-trades", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountId = parseFiniteNumber(
        req.query.accountId ?? req.body?.accountId,
        "accountId",
        { min: 1 },
      );
      const dryRun =
        req.query.dryRun === "true" || req.query.dryRun === "1" || req.body?.dryRun === true;
      const broker = parseBroker(req.query.broker ?? req.body?.broker);
      const csvText = String(req.body?.csv ?? "").trim();
      if (!csvText) {
        return res.status(400).json({ error: "csv body field is required" });
      }
      const filename = req.body?.filename != null ? String(req.body.filename) : undefined;
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const importInput: ImportTradesInput = {
        accountId,
        userId: uid(req),
        broker,
        csvText,
        dryRun,
        plnPerUnit,
      };
      if (filename) importInput.filename = filename;
      const result = await importBrokerTrades(prisma, importInput);
      res.json(result);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "Account not found") {
        handleRouteError(res, notFound(e.message), "Import failed");
        return;
      }
      if (e instanceof Error && e.message.includes("only supported for brokerage")) {
        handleRouteError(res, badRequest(e.message), "Import failed");
        return;
      }
      handleRouteError(res, e, "Import failed");
    }
  });

  router.post("/api/import/bank-transactions", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountId = parseFiniteNumber(
        req.query.accountId ?? req.body?.accountId,
        "accountId",
        { min: 1 },
      );
      const dryRun =
        req.query.dryRun === "true" || req.query.dryRun === "1" || req.body?.dryRun === true;
      const bank = parseBank(req.query.bank ?? req.body?.bank);
      const csvText = String(req.body?.csv ?? "").trim();
      if (!csvText) {
        return res.status(400).json({ error: "csv body field is required" });
      }
      const filename = req.body?.filename != null ? String(req.body.filename) : undefined;
      const importInput: ImportBankInput = {
        accountId,
        userId: uid(req),
        bank,
        csvText,
        dryRun,
      };
      if (filename) importInput.filename = filename;
      const result = await importBankTransactions(prisma, importInput);
      res.json(result);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "Account not found") {
        handleRouteError(res, notFound(e.message), "Import failed");
        return;
      }
      if (e instanceof Error && e.message.includes("only supported for bank")) {
        handleRouteError(res, badRequest(e.message), "Import failed");
        return;
      }
      handleRouteError(res, e, "Import failed");
    }
  });

  return router;
}
