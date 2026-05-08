import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";

jest.mock("@src/modules/common/middlewares/auth.middleware", () => ({
  authenticate: (req: any, res: any, next: any) => next(),
  authorize: () => (req: any, res: any, next: any) => next(),
}));

describe("Rutas de Zonas (Integración)", () => {
  let createdClientId: string;
  let createdZoneId: string;
  const uniqueName = `Zona de Prueba ${Date.now()}`;

  beforeAll(async () => {
    // Crear un cliente directamente en la BD para usar su ID en los tests de zonas
    const client = await prismaClient.client.create({
      data: { name: `Cliente Temp para Zonas ${Date.now()}` }
    });
    createdClientId = client.id;
  });

  afterAll(async () => {
    // Limpieza del cliente
    if (createdClientId) {
      await prismaClient.client.delete({ where: { id: createdClientId } }).catch(() => {});
    }
  });

  describe("POST /api/v1/zones", () => {
    it("debe crear una nueva zona en la BD", async () => {
      const response = await request(app)
        .post("/api/v1/zones")
        .send({ name: uniqueName, clientId: createdClientId });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(uniqueName);
      expect(response.body.data.clientId).toBe(createdClientId);
      
      createdZoneId = response.body.data.id;
    });

    it("debe retornar 400 si falta el clientId", async () => {
      const response = await request(app)
        .post("/api/v1/zones")
        .send({ name: "Nueva Zona" });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/v1/zones/client/:clientId", () => {
    it("debe retornar una lista de zonas para un cliente desde la BD", async () => {
      const response = await request(app).get(`/api/v1/zones/client/${createdClientId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].id).toBe(createdZoneId);
    });

    it("debe retornar 400 por UUID inválido", async () => {
      const response = await request(app).get("/api/v1/zones/client/invalid-id");
      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/v1/zones/:id", () => {
    it("debe actualizar una zona existente en la BD", async () => {
      const response = await request(app)
        .put(`/api/v1/zones/${createdZoneId}`)
        .send({ name: `${uniqueName} Actualizada`, active: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(`${uniqueName} Actualizada`);
      expect(response.body.data.active).toBe(false);
    });
  });

  describe("DELETE /api/v1/zones/:id", () => {
    it("debe eliminar una zona de la BD", async () => {
      const response = await request(app).delete(`/api/v1/zones/${createdZoneId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.softDelete).toBe(true);
    });
  });
});
