import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_CLIENT, ROLE_GUARD } from "@src/core/config/constants";

jest.mock("@src/modules/common/middlewares/auth.middleware", () => ({
  authenticate: (req: any, res: any, next: any) => {
    const user = req.headers["user"]
      ? JSON.parse(req.headers["user"])
      : { id: "admin-id", role: "ADMIN" };
    req.user = user;
    res.locals.user = user;
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next(),
}));

jest.setTimeout(30000);

describe("Rutas de Configuración de Rondas (Recurrencia) - Integración Total", () => {
  let createdClientId: string;
  let createdZoneId: string;
  let createdLocationIds: string[] = [];
  let createdGuardId: string;
  let createdRecurringId: string;

  beforeAll(async () => {
    // 1. Crear Cliente via HTTP
    const clientRes = await request(app)
      .post("/api/v1/clients")
      .send({ name: `Cliente para Ronda HTTP ${Date.now()}` });
    createdClientId = clientRes.body.data.id;

    // 2. Crear Zona via HTTP
    const zoneRes = await request(app)
      .post("/api/v1/zones")
      .send({ name: `Zona para Ronda HTTP ${Date.now()}`, clientId: createdClientId });
    createdZoneId = zoneRes.body.data.id;

    // 3. Crear Ubicaciones via HTTP
    const loc1Res = await request(app)
      .post("/api/v1/locations")
      .send({ name: `Punto A HTTP ${Date.now()}`, clientId: createdClientId, zoneId: createdZoneId });
    const loc2Res = await request(app)
      .post("/api/v1/locations")
      .send({ name: `Punto B HTTP ${Date.now()}`, clientId: createdClientId, zoneId: createdZoneId });
    createdLocationIds = [loc1Res.body.data.id, loc2Res.body.data.id];

    // 4. Crear Guardia via HTTP (necesitamos el roleId de la DB primero)
    const role = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });
    if (!role) throw new Error("Rol GUARD no encontrado");

    const guardRes = await request(app)
      .post("/api/v1/users")
      .send({
        name: "Guardia",
        lastName: "HTTP",
        username: `guardia_http_${Date.now()}`,
        password: "password123",
        roleId: role.id,
        clientId: createdClientId
      });
    createdGuardId = guardRes.body.data.id;
  });

  afterAll(async () => {
    // Limpieza
    if (createdRecurringId) await request(app).delete(`/api/v1/recurring/${createdRecurringId}`);
    if (createdGuardId) await prismaClient.user.delete({ where: { id: createdGuardId } }).catch(() => {});
    if (createdZoneId) await prismaClient.zone.delete({ where: { id: createdZoneId } }).catch(() => {});
    if (createdClientId) await prismaClient.client.delete({ where: { id: createdClientId } }).catch(() => {});
  });

  describe("Flujo Completo de Configuración de Ronda", () => {
    it("debe crear una configuración de ronda con múltiples puntos y tareas", async () => {
      const payload = {
        title: "Ronda Nocturna de Seguridad",
        clientId: createdClientId,
        guardIds: [createdGuardId],
        locations: [
          {
            locationId: createdLocationIds[0],
            tasks: [
              { description: "Revisar cerradura", reqPhoto: true },
              { description: "Verificar luces", reqPhoto: false }
            ]
          },
          {
            locationId: createdLocationIds[1],
            tasks: [
              { description: "Limpiar sensor", reqPhoto: false }
            ]
          }
        ]
      };

      const response = await request(app)
        .post("/api/v1/recurring")
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(payload.title);
      
      createdRecurringId = response.body.data.id;
    });

    it("debe recuperar la configuración completa con todos sus hijos", async () => {
      const response = await request(app).get(`/api/v1/recurring/${createdRecurringId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const config = response.body.data;
      expect(config.title).toBe("Ronda Nocturna de Seguridad");
      expect(config.guards.length).toBe(1);
      expect(config.guards[0].id).toBe(createdGuardId);
      expect(config.recurringLocations.length).toBe(2);
      
      // Verificar que las tareas existan
      const locWithTasks = config.recurringLocations.find((rl: any) => rl.locationId === createdLocationIds[0]);
      expect(locWithTasks.tasks.length).toBe(2);
    });

    it("debe permitir actualizar la ronda (quitar un guardia y cambiar tareas)", async () => {
      const updatePayload = {
        title: "Ronda Nocturna Modificada",
        clientId: createdClientId,
        guardIds: [], // Quitamos guardias
        locations: [
          {
            locationId: createdLocationIds[0],
            tasks: [
              { description: "Tarea nueva única", reqPhoto: true }
            ]
          }
        ]
      };

      const response = await request(app)
        .put(`/api/v1/recurring/${createdRecurringId}`)
        .send(updatePayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verificar cambios
      const getRes = await request(app).get(`/api/v1/recurring/${createdRecurringId}`);
      expect(getRes.body.data.title).toBe("Ronda Nocturna Modificada");
      expect(getRes.body.data.guards.length).toBe(0);
      expect(getRes.body.data.recurringLocations.length).toBe(1);
      expect(getRes.body.data.recurringLocations[0].tasks.length).toBe(1);
    });

    it("debe poder consultarse mediante el datatable", async () => {
        const response = await request(app)
            .post("/api/v1/recurring/datatable")
            .send({
                page: 1,
                limit: 10,
                filters: { search: "Nocturna" }
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.rows.some((r: any) => r.id === createdRecurringId)).toBe(true);
    });

    it("debe realizar un soft delete de la configuración", async () => {
      const response = await request(app).delete(`/api/v1/recurring/${createdRecurringId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Lo restauramos para el test de ejecución de ronda
      await prismaClient.recurringConfiguration.update({ where: { id: createdRecurringId }, data: { softDelete: false, active: true } });
    });
  });

  describe("Flujo de Ejecución de Ronda (Guardia)", () => {
    let activeRoundId: string;

    it("debe iniciar una ronda basada en la configuración creada", async () => {
      const response = await request(app)
        .post("/api/v1/rounds/start")
        .set("user", JSON.stringify({ id: createdGuardId, role: "GUARD" }))
        .send({
          guardId: createdGuardId,
          clientId: createdClientId,
          recurringConfigurationId: createdRecurringId
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("IN_PROGRESS");
      activeRoundId = response.body.data.id;
    });

    it("debe aparecer como ronda actual para el guardia", async () => {
      // Simulamos que el guardia hace la petición (mockeado para que use createdGuardId si lo enviamos o por contexto)
      // Como el middleware está mockeado, pasamos el user en el request si fuera necesario, 
      // pero el controller saca el ID del token mockeado.
      // Para este test, asegurémonos que getCurrentRound use el ID correcto.
      
      const response = await request(app)
        .get("/api/v1/rounds/current")
        .set("user", JSON.stringify({ id: createdGuardId })); // El mock debe manejar esto

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(activeRoundId);
    });

    it("debe registrar un escaneo de punto de control (Kardex)", async () => {
      const response = await request(app)
        .post("/api/v1/kardex")
        .send({
          userId: createdGuardId,
          locationId: createdLocationIds[0],
          notes: "Todo en orden en Punto A",
          latitude: 19.4326,
          longitude: -99.1332
        });

      expect(response.status).toBe(201);
      expect(response.body.data.scanType).toBe("RECURRING");
    });

    it("debe mostrar el escaneo en el detalle/línea de tiempo de la ronda", async () => {
      const response = await request(app).get(`/api/v1/rounds/${activeRoundId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.timeline.some((t: any) => t.type === "SCAN")).toBe(true);
      expect(response.body.data.round.status).toBe("IN_PROGRESS");
    });

    it("debe finalizar la ronda correctamente", async () => {
      const response = await request(app).put(`/api/v1/rounds/${activeRoundId}/end`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("COMPLETED");
      expect(response.body.data.endTime).toBeDefined();
    });

    it("debe verificar en el historial que la ronda está FINALIZADA", async () => {
        const response = await request(app).get("/api/v1/rounds?status=COMPLETED");
        
        expect(response.status).toBe(200);
        const found = response.body.data.find((r: any) => r.id === activeRoundId);
        expect(found).toBeDefined();
        expect(found.status).toBe("COMPLETED");
    });
  });
});

/**
 * Consultas de configuración de rondas recurrentes (integración contra
 * Postgres real, datos creados directamente con Prisma).
 */
describe("Consultas de configuración de rondas (Integración)", () => {
  let clienteAId: string;
  let clienteBId: string;
  let locationAId: string;
  let locationBId: string;
  let guardaAId: string;
  let guardaBId: string;
  let guardaSinClienteId: string;
  let configAId: string;
  let configSinGuardiaId: string;
  let configInactivaId: string;
  let configDescartadaId: string;
  let configBId: string;

  const adminHeader = () => JSON.stringify({ id: "admin-id", role: "ADMIN" });
  const clienteAHeader = () =>
    JSON.stringify({ id: "cliente-a", name: "Cliente A", username: "cliente.a", role: ROLE_CLIENT, clientId: clienteAId });

  const ids = (res: { body: { data: { id: string }[] } }) => res.body.data.map((c) => c.id);

  beforeAll(async () => {
    const stamp = Date.now();
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD }, select: { id: true } });
    if (!guardRole) throw new Error("Se requiere el rol GUARD en la base de pruebas");

    const clienteA = await prismaClient.client.create({ data: { name: `Cliente Recurrente A ${stamp}` } });
    const clienteB = await prismaClient.client.create({ data: { name: `Cliente Recurrente B ${stamp}` } });
    clienteAId = clienteA.id;
    clienteBId = clienteB.id;

    const locationA = await prismaClient.location.create({ data: { name: `Punto A ${stamp}`, clientId: clienteAId } });
    const locationB = await prismaClient.location.create({ data: { name: `Punto B ${stamp}`, clientId: clienteBId } });
    locationAId = locationA.id;
    locationBId = locationB.id;

    const crearGuardia = async (sufijo: string, clientId: string | null) => {
      const guardia = await prismaClient.user.create({
        data: {
          name: "Guardia",
          lastName: sufijo,
          username: `guardia.recurrente.${sufijo}.${stamp}`.toLowerCase(),
          password: "x",
          roleId: guardRole.id,
          clientId,
        },
      });
      return guardia.id;
    };
    guardaAId = await crearGuardia("a", clienteAId);
    guardaBId = await crearGuardia("b", clienteBId);
    guardaSinClienteId = await crearGuardia("sc", null);

    const configA = await prismaClient.recurringConfiguration.create({
      data: {
        title: `Ronda A ${stamp}`,
        clientId: clienteAId,
        guards: { connect: [{ id: guardaAId }] },
        recurringLocations: {
          create: [{ locationId: locationAId, tasks: { create: [{ description: "Revisar cerradura", reqPhoto: true }] } }],
        },
      },
    });
    configAId = configA.id;

    const configSinGuardia = await prismaClient.recurringConfiguration.create({
      data: { title: `Ronda sin guardia ${stamp}`, clientId: clienteAId },
    });
    configSinGuardiaId = configSinGuardia.id;

    const configInactiva = await prismaClient.recurringConfiguration.create({
      data: { title: `Ronda inactiva ${stamp}`, clientId: clienteAId, active: false, guards: { connect: [{ id: guardaAId }] } },
    });
    configInactivaId = configInactiva.id;

    const configDescartada = await prismaClient.recurringConfiguration.create({
      data: { title: `Ronda descartada ${stamp}`, clientId: clienteAId, softDelete: true, guards: { connect: [{ id: guardaAId }] } },
    });
    configDescartadaId = configDescartada.id;

    const configB = await prismaClient.recurringConfiguration.create({
      data: { title: `Ronda B ${stamp}`, clientId: clienteBId, guards: { connect: [{ id: guardaBId }] } },
    });
    configBId = configB.id;
  });

  afterAll(async () => {
    const configIds = [configAId, configSinGuardiaId, configInactivaId, configDescartadaId, configBId];
    await prismaClient.recurringTask
      .deleteMany({ where: { recurringLocation: { recurringConfigurationId: { in: configIds } } } })
      .catch(() => {});
    await prismaClient.recurringLocation.deleteMany({ where: { recurringConfigurationId: { in: configIds } } }).catch(() => {});
    await prismaClient.recurringConfiguration.deleteMany({ where: { id: { in: configIds } } }).catch(() => {});
    await prismaClient.user
      .deleteMany({ where: { id: { in: [guardaAId, guardaBId, guardaSinClienteId] } } })
      .catch(() => {});
    await prismaClient.location.deleteMany({ where: { id: { in: [locationAId, locationBId] } } }).catch(() => {});
    await prismaClient.client.deleteMany({ where: { id: { in: [clienteAId, clienteBId] } } }).catch(() => {});
  });

  describe("GET /api/v1/recurring", () => {
    it("debe listar las configuraciones activas con sus puntos, tareas y guardias", async () => {
      const res = await request(app).get("/api/v1/recurring").set("user", adminHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.messages).toEqual(["Success"]);
      expect(Array.isArray(res.body.data)).toBe(true);

      const todos = ids(res);
      expect(todos).toContain(configAId);
      expect(todos).toContain(configBId);
      // La configuración con borrado lógico no se expone.
      expect(todos).not.toContain(configDescartadaId);
      // `getAllRecurring` sólo filtra por softDelete: las inactivas sí aparecen.
      expect(todos).toContain(configInactivaId);

      const mia = res.body.data.find((c: { id: string }) => c.id === configAId);
      expect(mia.title).toContain("Ronda A");
      expect(mia.recurringLocations).toHaveLength(1);
      expect(mia.recurringLocations[0].locationId).toBe(locationAId);
      expect(mia.recurringLocations[0].location.client.id).toBe(clienteAId);
      expect(mia.recurringLocations[0].tasks).toHaveLength(1);
      expect(mia.recurringLocations[0].tasks[0].description).toBe("Revisar cerradura");
      expect(mia.recurringLocations[0].tasks[0].reqPhoto).toBe(true);
      expect(mia.guards.map((g: { id: string }) => g.id)).toEqual([guardaAId]);
    });

    it("un usuario cliente sólo ve las configuraciones de su propia empresa", async () => {
      const admin = await request(app).get("/api/v1/recurring").set("user", adminHeader());
      const res = await request(app).get("/api/v1/recurring").set("user", clienteAHeader());

      expect(res.status).toBe(200);
      // Aislamiento multi-cliente: nunca se expone la configuración de otro cliente.
      expect(ids(res)).not.toContain(configBId);
      expect(ids(res)).toContain(configAId);
      expect(res.body.data.length).toBeLessThan(admin.body.data.length);
    });
  });

  describe("GET /api/v1/recurring/guard/:guardId", () => {
    it("debe devolver sólo las configuraciones activas asignadas al guardia", async () => {
      const res = await request(app).get(`/api/v1/recurring/guard/${guardaAId}`).set("user", adminHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.messages).toEqual(["Success"]);
      expect(ids(res)).toEqual([configAId]);

      const mia = res.body.data[0];
      expect(mia.guards.map((g: { id: string }) => g.id)).toContain(guardaAId);
      expect(mia.recurringLocations[0].tasks).toHaveLength(1);
    });

    it("no debe devolver configuraciones inactivas ni de otros clientes", async () => {
      const res = await request(app).get(`/api/v1/recurring/guard/${guardaBId}`).set("user", adminHeader());

      expect(res.status).toBe(200);
      expect(ids(res)).toEqual([configBId]);
      expect(ids(res)).not.toContain(configInactivaId);
      expect(ids(res)).not.toContain(configSinGuardiaId);
      expect(ids(res)).not.toContain(configDescartadaId);
    });

    it("un usuario cliente no puede consultar guardias de otra empresa", async () => {
      const res = await request(app)
        .get(`/api/v1/recurring/guard/${guardaBId}`)
        .set("user", clienteAHeader());

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it("debe devolver una lista vacía para un guardia sin cliente asignado", async () => {
      const res = await request(app).get(`/api/v1/recurring/guard/${guardaSinClienteId}`).set("user", adminHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it("debe devolver una lista vacía cuando el guardia no existe (sin 404)", async () => {
      const res = await request(app)
        .get("/api/v1/recurring/guard/00000000-0000-0000-0000-000000000000")
        .set("user", adminHeader());

      // La ruta no define 404: un recurso inexistente responde 200 con [].
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it("debe rechazar un guardId que no es UUID", async () => {
      const res = await request(app).get("/api/v1/recurring/guard/no-es-uuid").set("user", adminHeader());

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.messages.join(" ")).toContain("params.guardId");
    });
  });
});
