import { PrismaClient } from "@prisma/client";
import { hackerLog } from "./logger";

const HOTEL_PUERTO_NUEVO_CLIENT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const HABITACIONES = [
  "HAB-101", "HAB-102", "HAB-103", "HAB-104", "HAB-105",
  "HAB-106", "HAB-107", "HAB-108", "HAB-109", "HAB-110",
  "HAB-111", "HAB-112", "HAB-113", "HAB-114", "HAB-115",
  "HAB-116", "HAB-117", "HAB-118", "HAB-119", "HAB-120",
  "HAB-201", "HAB-202", "HAB-203", "HAB-204", "HAB-205",
  "HAB-206", "HAB-207", "HAB-208", "HAB-209", "HAB-210",
  "HAB-211", "HAB-212", "HAB-213", "HAB-214", "HAB-215",
  "HAB-216", "HAB-217", "HAB-218", "HAB-219", "HAB-220",
  "SUITE-301", "SUITE-302", "SUITE-303", "SUITE-304", "SUITE-305",
];

const PISOS = [
  "Piso 1 - Pasillo Norte",
  "Piso 1 - Pasillo Sur",
  "Piso 2 - Pasillo Norte",
  "Piso 2 - Pasillo Sur",
  "Piso 3 - Pasillo Central",
  "Elevador 1",
  "Elevador 2",
  "Escalera Emergencia Norte",
  "Escalera Emergencia Sur",
];

const AREAS_SOCIALES = [
  "Lobby Principal",
  "Recepcion",
  "Restaurante",
  "Bar",
  "Salon de Eventos",
  "Sala de Juntas",
  "Lounge Ejecutivo",
  "Terraza Mirador",
];

const AMENIDADES = [
  "Piscina Principal",
  "Piscina Infantil",
  "Gimnasio",
  "Spa",
  "Sauna",
  "Cancha de Tenis",
  "Jardin Central",
  "Jardin Oriental",
  "Area de Asadores",
  "Juegos Infantiles",
];

const SERVICIOS = [
  "Cocina Principal",
  "Cocina de Eventos",
  "Lavanderia",
  "Cuarto de Calderas",
  "Cuarto de Maquinas",
  "Cisterna 1",
  "Cisterna 2",
  "Planta de Luz",
  "Tablero Electrico Principal",
  "Cuarto de Servidores",
  "Almacen General",
  "Cuarto de Basura",
  "Mantenimiento General",
];

const EXTERIORES = [
  "Acceso Principal",
  "Acceso Servicio",
  "Caseta de Vigilancia",
  "Estacionamiento Clientes",
  "Estacionamiento Empleados",
  "Estacionamiento VIP",
  "Barda Perimetral Norte",
  "Barda Perimetral Sur",
  "Barda Perimetral Este",
  "Barda Perimetral Oeste",
  "Helipuerto",
  "Area de Carga y Descarga",
];

export const seedHotelPuertoNuevo = async (prisma: PrismaClient) => {
  hackerLog.info("CLIENT", "Seeding Hotel Puerto Nuevo Zones and Checkpoints");

  const client = await prisma.client.upsert({
    where: { id: HOTEL_PUERTO_NUEVO_CLIENT_ID },
    update: { name: "Hotel Puerto Nuevo" },
    create: {
      id: HOTEL_PUERTO_NUEVO_CLIENT_ID,
      name: "Hotel Puerto Nuevo",
    },
  });

  const secciones: Array<{ zoneName: string; checkpoints: string[] }> = [
    { zoneName: "Habitaciones", checkpoints: HABITACIONES },
    { zoneName: "Pasillos y Elevadores", checkpoints: PISOS },
    { zoneName: "Areas Sociales", checkpoints: AREAS_SOCIALES },
    { zoneName: "Amenidades", checkpoints: AMENIDADES },
    { zoneName: "Servicios", checkpoints: SERVICIOS },
    { zoneName: "Exteriores", checkpoints: EXTERIORES },
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
    `Seeded ${secciones.length} zones and ${totalLocations} checkpoints for Hotel Puerto Nuevo`,
  );
};
