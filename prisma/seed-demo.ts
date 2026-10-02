import { PrismaClient } from "@prisma/client";
import { demoActivitySeed } from "./seeds/demo-activity";

const prisma = new PrismaClient();

async function main() {
  await demoActivitySeed(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
