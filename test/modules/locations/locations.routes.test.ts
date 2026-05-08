import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";

jest.mock("@src/modules/common/middlewares/auth.middleware", () => ({
  authenticate: (req: any, res: any, next: any) => next(),
  authorize: () => (req: any, res: any, next: any) => next(),
}));

describe("Rutas de Ubicaciones (Integración)", () => {
  let createdClientId: string;
  let createdZoneId: string;
  let createdLocationId: string;
  const uniqueName = `Ubicación de Prueba ${Date.now()}`;

  beforeAll(async () => {
    // Crear dependencias
    const client = await prismaClient.client.create({
      data: { name: `Cliente Temp para Ubic ${Date.now()}` }
    });
    createdClientId = client.id;

    const zone = await prismaClient.zone.create({
      data: { name: `Zona Temp para Ubic ${Date.now()}`, clientId: createdClientId }
    });
    createdZoneId = zone.id;
  });

  afterAll(async () => {
    // Limpieza
    if (createdZoneId) await prismaClient.zone.delete({ where: { id: createdZoneId } }).catch(() => {});
    if (createdClientId) await prismaClient.client.delete({ where: { id: createdClientId } }).catch(() => {});
  });

  describe("POST /api/v1/locations", () => {
    it("debe crear una nueva ubicación en la BD", async () => {
      const response = await request(app)
        .post("/api/v1/locations")
        .send({ name: uniqueName, clientId: createdClientId, zoneId: createdZoneId });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(uniqueName);
      expect(response.body.data.clientId).toBe(createdClientId);
      expect(response.body.data.zoneId).toBe(createdZoneId);
      
      createdLocationId = response.body.data.id;
      expect(createdLocationId).toBeDefined();
    });

    it("debe retornar 400 si falta el clientId", async () => {
      const response = await request(app)
        .post("/api/v1/locations")
        .send({ name: "Nueva Ubicación" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/locations", () => {
    it("debe retornar una lista de ubicaciones desde la BD", async () => {
      const response = await request(app).get("/api/v1/locations");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      const found = response.body.data.find((l: any) => l.id === createdLocationId);
      expect(found).toBeDefined();
    });
  });

  describe("PUT /api/v1/locations/:id", () => {
    it("debe actualizar una ubicación existente en la BD", async () => {
      const response = await request(app)
        .put(`/api/v1/locations/${createdLocationId}`)
        .send({ name: `${uniqueName} Actualizada`, active: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(`${uniqueName} Actualizada`);
      expect(response.body.data.active).toBe(false);
    });
  });

  describe("DELETE /api/v1/locations/:id", () => {
    it("debe eliminar una ubicación de la BD", async () => {
      const response = await request(app).delete(`/api/v1/locations/${createdLocationId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.softDelete).toBe(true);
    });
  });
});
