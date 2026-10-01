import { PrismaClient } from "@prisma/client";
import { canonicalUsernameKey, hashPassword } from "../src/auth";
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

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      id: user.id,
      email: user.email,
      username: user.username,
      note: "Demo user + sample portfolio (accounts, categories, cash txs). Re-run wipes demo data.",
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
