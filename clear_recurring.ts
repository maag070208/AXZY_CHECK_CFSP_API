
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Deleting Recurring Tasks...');
  await prisma.recurringTask.deleteMany({});
  
  console.log('Deleting Recurring Locations...');
  await prisma.recurringLocation.deleteMany({});
  
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
