import { PrismaClient } from "@prisma/client";
import { hackerLog } from "./logger";

/**
 * Data operativa de DEMOSTRACIÓN para que el dashboard tenga actividad visible:
 * guardias en línea, rondas en progreso, kardex reciente, incidencias,
 * mantenimientos, disciplinas y una alerta de pánico.
 *
 * Es idempotente: usa el prefijo DEMO_PREFIX para no duplicar registros y
 * sólo crea rondas para guardias que no tengan una IN_PROGRESS.
 */
export const DEMO_PREFIX = "[DEMO]";

const OPERATIONAL_ROLES = ["GUARD", "SHIFT", "MAINT"];

export async function demoActivitySeed(prisma: PrismaClient): Promise<void> {
  hackerLog.header("Demo Operational Activity");

  const admin = await prisma.user.findFirst({
    where: { role: { name: "ADMIN" }, softDelete: false },
  });

  const guards = await prisma.user.findMany({
    where: {
      role: { name: { in: OPERATIONAL_ROLES } },
      active: true,
      softDelete: false,
    },
    orderBy: { username: "asc" },
  });

  const client =
    (await prisma.client.findFirst({
      where: { name: "Hotel Puerto Nuevo", softDelete: false },
    })) ||
    (await prisma.client.findFirst({ where: { softDelete: false } }));

  if (!client || guards.length === 0) {
    hackerLog.error(
      "DEMO",
      "Se necesita al menos un cliente y un guardia para sembrar actividad.",
    );
    return;
  }

  const locations = await prisma.location.findMany({
    where: { clientId: client.id, softDelete: false },
    take: 12,
    orderBy: { name: "asc" },
  });

  if (locations.length === 0) {
    hackerLog.error("DEMO", `El cliente ${client.name} no tiene ubicaciones.`);
    return;
  }

  // 1. Guardias en línea (para las tarjetas de "activos ahora")
  const onlineGuards = guards.slice(0, Math.min(3, guards.length));
  await prisma.user.updateMany({
    where: { id: { in: onlineGuards.map((g) => g.id) } },
    data: { isLoggedIn: true },
  });

  // 2. Rondas en progreso + kardex reciente
  let roundsCreated = 0;
  let kardexCreated = 0;
  for (const [i, guard] of onlineGuards.entries()) {
    const existing = await prisma.round.findFirst({
      where: { guardId: guard.id, status: "IN_PROGRESS", deletedAt: null },
    });
    if (existing) continue;

    await prisma.round.create({
      data: {
        guardId: guard.id,
        clientId: client.id,
        startTime: new Date(Date.now() - (25 + i * 15) * 60 * 1000),
        status: "IN_PROGRESS",
      },
    });
    roundsCreated++;

    for (let k = 0; k < 4; k++) {
      const location = locations[(i * 4 + k) % locations.length];
      await prisma.kardex.create({
        data: {
          userId: guard.id,
          locationId: location.id,
          timestamp: new Date(Date.now() - (20 - k * 5) * 60 * 1000),
          notes: `${DEMO_PREFIX} Punto verificado`,
          scanType: "RECURRING",
          media: [],
        },
      });
      kardexCreated++;
    }
  }

  // 3. Incidencias / mantenimientos / disciplinas pendientes
  const existingIncidents = await prisma.incident.count({
    where: { title: { startsWith: DEMO_PREFIX } },
  });
  if (existingIncidents === 0) {
    for (const [i, guard] of onlineGuards.entries()) {
      await prisma.incident.create({
        data: {
          guardId: guard.id,
          clientId: client.id,
          title: `${DEMO_PREFIX} Novedad en ${locations[i % locations.length].name}`,
          description: "Se encontró acceso sin asegurar durante el recorrido.",
          status: "PENDING",
          media: [],
        },
      });
    }
    for (const [i, guard] of onlineGuards.slice(0, 2).entries()) {
      await prisma.maintenance.create({
        data: {
          guardId: guard.id,
          clientId: client.id,
          title: `${DEMO_PREFIX} Falla de iluminación`,
          description: "Lámpara fundida en el pasillo principal.",
          status: "PENDING",
          media: [],
        },
      });
    }
    const createdById = admin?.id ?? onlineGuards[0].id;
    for (const [i, guard] of onlineGuards.slice(0, 2).entries()) {
      await prisma.guardDiscipline.create({
        data: {
          guardId: guard.id,
          createdById,
          clientId: client.id,
          title: `${DEMO_PREFIX} Falta de puntualidad`,
          description: "Registró su entrada 10 minutos tarde.",
          status: "PENDING",
          media: [],
        },
      });
    }
  }

  // 4. Alerta de pánico pendiente
  const existingPanic = await prisma.panicAlert.count({
    where: { message: { startsWith: DEMO_PREFIX } },
  });
  if (existingPanic === 0) {
    await prisma.panicAlert.create({
      data: {
        guardId: onlineGuards[0].id,
        clientId: client.id,
        message: `${DEMO_PREFIX} Alerta de apoyo en recepción`,
        status: "PENDING",
        triggerLatitude: 31.8667,
        triggerLongitude: -116.5964,
      },
    });
  }

  hackerLog.success(
    "DEMO",
    `Actividad lista: ${onlineGuards.length} guardias en línea, ${roundsCreated} rondas, ${kardexCreated} kardex.`,
  );
}
