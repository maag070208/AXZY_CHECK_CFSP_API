import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_GUARD } from "@src/core/config/constants";

jest.mock("@src/modules/common/middlewares/auth.middleware", () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers["user"]) {
      const user = JSON.parse(req.headers["user"]);
      req.user = user;
      res.locals.user = user;
    }
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next(),
}));

jest.mock("@src/core/middlewares/token-validator.middleware", () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    if (req.headers["user"]) {
      const user = JSON.parse(req.headers["user"]);
      req.user = user;
      res.locals.user = user;
    }
    next();
  },
}));

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
            .send({ filters: { search: "Nocturna" } });

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
