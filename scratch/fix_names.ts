import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const clientName = "Plaza 2000";
  const zoneName = "Alta";

  const locations = await prisma.location.findMany({
    where: {
      client: { name: clientName },
      zone: { name: zoneName },
    },
    include: {
        client: true,
        zone: true,
    }
  });

  console.log(`Found ${locations.length} locations to check.`);

  for (const loc of locations) {
    const prefix = `${loc.client?.name}-${loc.zone?.name}-`;
    if (!loc.name.startsWith(prefix)) {
        const newName = `${prefix}${loc.name}`;
        console.log(`Updating: ${loc.name} -> ${newName}`);
        await prisma.location.update({
            where: { id: loc.id },
            data: { name: newName }
        });
    } else {
        console.log(`Already correct: ${loc.name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
