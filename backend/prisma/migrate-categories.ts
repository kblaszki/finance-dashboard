import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { migrateAllUsers } from "../src/migrateCategories";

const prisma = new PrismaClient();

async function main() {
  await migrateAllUsers(prisma);
  // eslint-disable-next-line no-console
  console.log("Category migration complete.");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
