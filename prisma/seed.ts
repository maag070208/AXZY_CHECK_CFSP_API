import { PrismaClient } from "@prisma/client";
import { catalogsSeed } from "./seeds/catalogs";
import { incidentCatalogsSeed } from "./seeds/incidents";
import { locationsSeed } from "./seeds/locations";
import { maintenanceCatalogsSeed } from "./seeds/maintenance";
import { schedulesSeed } from "./seeds/schedules";
import { securitySeed } from "./seeds/security";
import { sysConfigSeed } from "./seeds/sysconfig";
import { seedPlaza2000Full } from "./seeds/plaza2000_full";
import { vinasDelMarSeed } from "./seeds/vinas";
import { hackerLog } from "./seeds/logger";

const prisma = new PrismaClient();

async function main() {
  hackerLog.header("Master Seeding Sequence");

  await catalogsSeed(prisma);
  await incidentCatalogsSeed(prisma);
  await maintenanceCatalogsSeed(prisma);
  await schedulesSeed(prisma);
  // await locationsSeed(prisma); // Commented out old generic locations
  await seedPlaza2000Full();
  await vinasDelMarSeed(prisma);
  await securitySeed(prisma);
  await sysConfigSeed(prisma);

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
