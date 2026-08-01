import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth";
import { seedDefaultCategories } from "../src/domain/categories";

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
      passwordHash,
    },
    update: {
      username: DEMO_USERNAME,
      passwordHash,
    },
  });
  const categoryCount = await prisma.category.count({ where: { userId: user.id } });
  if (categoryCount === 0) {
    await seedDefaultCategories(prisma, user.id);
  }
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      id: user.id,
      email: user.email,
      username: user.username,
      note: "Demo user only — no sample portfolio data",
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
