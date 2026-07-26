import { PrismaClient } from "@prisma/client";
import { catalogsSeed } from "./seeds/catalogs";
import { disciplineCatalogsSeed } from "./seeds/discipline";
import { guardLogsSeed } from "./seeds/guard-logs";
import { incidentCatalogsSeed } from "./seeds/incidents";
import { hackerLog } from "./seeds/logger";
import { maintenanceCatalogsSeed } from "./seeds/maintenance";
import { seedHotelPuertoNuevo } from "./seeds/hotel-puerto-nuevo";
import { schedulesSeed } from "./seeds/schedules";
import { securitySeed } from "./seeds/security";
import { sysConfigSeed } from "./seeds/sysconfig";

const prisma = new PrismaClient();

async function main() {
  hackerLog.header("Master Seeding Sequence");

  await catalogsSeed(prisma);
  await incidentCatalogsSeed(prisma);
  await maintenanceCatalogsSeed(prisma);
  await schedulesSeed(prisma);
  await securitySeed(prisma);
  await sysConfigSeed(prisma);
  await disciplineCatalogsSeed(prisma);
  await guardLogsSeed(prisma);
  await seedHotelPuertoNuevo(prisma);

  hackerLog.divider();
  hackerLog.success("SYSTEM", "Master Seeding Complete");
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
