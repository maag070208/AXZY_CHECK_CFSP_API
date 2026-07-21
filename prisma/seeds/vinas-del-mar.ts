import { PrismaClient } from "@prisma/client";
import { hackerLog } from "./logger";

const VNAS_DEL_MAR_CLIENT_ID = "9cba7abc-c17e-40b9-a1f8-14c7a42fbb2e";

const PRIVADAS = [
  "Alarije",
  "Barbera",
  "Champagne",
  "Chardonnay",
  "Emilia",
  "Casa Club",
  "Gamay",
  "Godello",
  "Parque 2 Comedor",
  "Graciano",
  "Grenache",
  "Lairen",
  "Lugana",
  "Marqués",
  "Milán",
  "Alicante",
  "Lérida",
  "Parque 3",
  "Lambrusco",
  "Mendoza",
  "Malvar",
  "Mouslis",
  "Tempranillo",
  "Rome",
  "Valle de Concepción",
  "Valle de Guadalupe",
  "Parque 5",
  "Oporto",
  "Provenza",
  "Cataluña",
  "Dolcetto",
  "Caseta Principal",
];

const PARQUES = [
  "Parque 1",
  "Parque 2",
  "Parque 3",
  "Parque 4",
  "Parque 5",
  "Parque 6",
];

export const seedVinasDelMar = async (prisma: PrismaClient) => {
  hackerLog.info("CLIENT", "Seeding Viñas del Mar Zones and Checkpoints");

  const client = await prisma.client.findUnique({
    where: { id: VNAS_DEL_MAR_CLIENT_ID },
  });

  if (!client) {
    hackerLog.error(
      "CLIENT",
      `Cliente Viñas del Mar no encontrado con id ${VNAS_DEL_MAR_CLIENT_ID}`,
    );
    return;
  }

  const secciones: Array<{ zoneName: string; checkpoints: string[] }> = [
    { zoneName: "Privadas", checkpoints: PRIVADAS },
    { zoneName: "Parques", checkpoints: PARQUES },
  ];

  let totalLocations = 0;

  for (const seccion of secciones) {
    const zone = await prisma.zone.upsert({
      where: {
        name_clientId: { name: seccion.zoneName, clientId: client.id },
      },
      update: {},
      create: { name: seccion.zoneName, clientId: client.id },
    });

    for (const checkpoint of seccion.checkpoints) {
      await prisma.location.upsert({
        where: { name_zoneId: { name: checkpoint, zoneId: zone.id } },
        update: { clientId: client.id, name: checkpoint },
        create: {
          clientId: client.id,
          zoneId: zone.id,
          name: checkpoint,
        },
      });
      totalLocations += 1;
    }
  }

  hackerLog.success(
    "CLIENT",
    `Seeded ${secciones.length} zones and ${totalLocations} checkpoints for Viñas del Mar`,
  );
};
