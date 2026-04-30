import { PrismaClient } from "@prisma/client";
import { catalogsSeed } from "./seeds/catalogs";
import { incidentCatalogsSeed } from "./seeds/incidents";
import { locationsSeed } from "./seeds/locations";
import { maintenanceCatalogsSeed } from "./seeds/maintenance";
import { schedulesSeed } from "./seeds/schedules";
import { securitySeed } from "./seeds/security";
import { sysConfigSeed } from "./seeds/sysconfig";

import { hackerLog } from "./seeds/logger";

const prisma = new PrismaClient();

async function main() {
  hackerLog.header('Master Seeding Sequence');
  
  await catalogsSeed(prisma);
  await incidentCatalogsSeed(prisma);
  await maintenanceCatalogsSeed(prisma);
  await schedulesSeed(prisma);
  await securitySeed(prisma);
  await locationsSeed(prisma);
  await sysConfigSeed(prisma);

  hackerLog.divider();
  hackerLog.success('SYSTEM', 'Master Seeding Complete');
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
