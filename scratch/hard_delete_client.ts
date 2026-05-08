import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const clientId = "b3401afd-1d35-43b8-b943-eb1d29cbb6f7"; // Martin Amaro

  console.log(`Starting physical delete for client ${clientId}...`);

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete Locations and their tasks
      const locations = await tx.location.findMany({ where: { clientId } });
      const locationIds = locations.map(l => l.id);

      await tx.locationTask.deleteMany({ where: { locationId: { in: locationIds } } });
      await tx.recurringLocation.deleteMany({ where: { locationId: { in: locationIds } } });
      
      // 2. Delete Zones
      await tx.zone.deleteMany({ where: { clientId } });

      // 3. Delete Locations
      await tx.location.deleteMany({ where: { clientId } });

      // 4. Delete Rounds
      await tx.round.deleteMany({ where: { clientId } });

      // 5. Delete Recurring Configs
      await tx.recurringConfiguration.deleteMany({ where: { clientId } });

      // 6. Delete Users
      await tx.user.deleteMany({ where: { clientId } });

      // 7. Delete Client
      await tx.client.delete({ where: { id: clientId } });
    });

    console.log("Physical delete successful.");
  } catch (error) {
    console.error("Error during physical delete:", error);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
