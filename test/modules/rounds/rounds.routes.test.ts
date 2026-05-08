import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_GUARD } from "@src/core/config/constants";

jest.mock("@src/modules/common/middlewares/auth.middleware", () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers["user"]) {
      req.user = JSON.parse(req.headers["user"]);
    }
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next(),
}));

jest.mock("@src/core/middlewares/token-validator.middleware", () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    if (req.headers["user"]) {
      req.user = JSON.parse(req.headers["user"]);
    }
    next();
  },
}));

describe("Rutas de Historial de Rondas (Integración Total)", () => {
  let createdClientId: string;
  let createdGuardId: string;
  let createdLocationId: string;
  let createdRoundId: string;

  beforeAll(async () => {
    // 1. Crear Cliente
    const clientRes = await request(app)
      .post("/api/v1/clients")
      .send({ name: `Cliente Historial ${Date.now()}` });
    createdClientId = clientRes.body.data.id;

    // 2. Crear Ubicación
    const locRes = await request(app)
      .post("/api/v1/locations")
      .send({ name: "Punto A", clientId: createdClientId });
    createdLocationId = locRes.body.data.id;

    // 3. Obtener Role
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });

    // 4. Crear Guardia
    const guardRes = await request(app)
      .post("/api/v1/users")
      .send({
        name: "Guardia",
        lastName: "Historial",
        username: `guardia_hist_${Date.now()}`,
        password: "password123",
        roleId: guardRole!.id,
        clientId: createdClientId
      });
    createdGuardId = guardRes.body.data.id;
  });

  afterAll(async () => {
    if (createdRoundId) await prismaClient.round.delete({ where: { id: createdRoundId } }).catch(() => {});
    if (createdGuardId) await prismaClient.user.delete({ where: { id: createdGuardId } }).catch(() => {});
    if (createdLocationId) await prismaClient.location.delete({ where: { id: createdLocationId } }).catch(() => {});
    if (createdClientId) await prismaClient.client.delete({ where: { id: createdClientId } }).catch(() => {});
  });

  describe("Ciclo de Vida de una Ronda", () => {
    it("debe iniciar una ronda correctamente", async () => {
      const response = await request(app)
        .post("/api/v1/rounds/start")
        .set("user", JSON.stringify({ id: createdGuardId }))
        .send({
          clientId: createdClientId
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("IN_PROGRESS");
      createdRoundId = response.body.data.id;
    });

    it("debe permitir al guardia registrar actividad en la ronda", async () => {
      const response = await request(app)
        .post("/api/v1/kardex")
        .set("user", JSON.stringify({ id: createdGuardId }))
        .send({
          userId: createdGuardId,
          locationId: createdLocationId,
          notes: "Punto verificado durante ronda"
        });

      expect(response.status).toBe(201);
    });

    it("debe finalizar la ronda", async () => {
      const response = await request(app).put(`/api/v1/rounds/${createdRoundId}/end`);
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("COMPLETED");
    });

    it("debe aparecer en el datatable con filtros", async () => {
      const response = await request(app)
        .post("/api/v1/rounds/datatable")
        .send({
          filters: { 
            client: createdClientId,
            status: "COMPLETED",
            search: "Historial" // Por el apellido del guardia
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.rows.some((r: any) => r.id === createdRoundId)).toBe(true);
    });

    it("debe mostrar el detalle completo con la línea de tiempo", async () => {
      const response = await request(app).get(`/api/v1/rounds/${createdRoundId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.round.id).toBe(createdRoundId);
      expect(response.body.data.timeline.length).toBeGreaterThanOrEqual(3); // Start, Scan, End
      expect(response.body.data.timeline.some((t: any) => t.type === "SCAN")).toBe(true);
    });

    it("debe generar el reporte en PDF de la ronda", async () => {
      const response = await request(app).get(`/api/v1/rounds/${createdRoundId}/report`);
      
      expect(response.status).toBe(200);
      expect(response.header["content-type"]).toBe("application/pdf");
    });
  });
});
