import type { PrismaClient } from "@prisma/client";
import { DEMO_EMAIL } from "./seedConfig";

export async function deleteDemoUser(prisma: PrismaClient): Promise<void> {
  await prisma.user.delete({ where: { email: DEMO_EMAIL } }).catch(() => {});
}

export async function cleanupManualInstrumentValuations(
  prisma: PrismaClient,
  symbols: string[],
): Promise<number> {
  const instruments = await prisma.instrument.findMany({
    where: { symbol: { in: symbols } },
    select: { id: true },
  });
  if (!instruments.length) return 0;

  const result = await prisma.instrumentValuation.deleteMany({
    where: {
      instrumentId: { in: instruments.map((i) => i.id) },
      source: "manual",
    },
  });
  return result.count;
}
