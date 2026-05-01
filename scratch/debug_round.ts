
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const round = await prisma.round.findUnique({
    where: { id: 5 },
    include: {
      client: true,
      recurringConfiguration: {
        include: {
          client: true,
          recurringLocations: {
            include: {
              location: {
                include: { client: true }
              }
            }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(round, null, 2));
}

check();
