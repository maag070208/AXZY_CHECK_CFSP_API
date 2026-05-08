import request from "supertest";
import { app } from "@src/index";

jest.mock("@src/modules/common/middlewares/auth.middleware", () => ({
  authenticate: (req: any, res: any, next: any) => next(),
  authorize: () => (req: any, res: any, next: any) => next(),
}));

describe("Rutas de Clientes (Integración)", () => {
  let createdClientId: string;
  const uniqueName = `Cliente de Prueba ${Date.now()}`;

  describe("POST /api/v1/clients", () => {
    it("debe crear un nuevo cliente en la BD", async () => {
      const response = await request(app)
        .post("/api/v1/clients")
        .send({ name: uniqueName, address: "123 Main St", active: true });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data).toBe("object");
      expect(response.body.data.name).toBe(uniqueName);
      
      createdClientId = response.body.data.id;
      expect(createdClientId).toBeDefined();
    });

    it("debe retornar 400 si falta el nombre", async () => {
      const response = await request(app)
        .post("/api/v1/clients")
        .send({ address: "Sin nombre" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/clients", () => {
    it("debe retornar una lista de clientes desde la BD", async () => {
      const response = await request(app).get("/api/v1/clients");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      const found = response.body.data.find((c: any) => c.id === createdClientId);
      expect(found).toBeDefined();
    });
  });

  describe("GET /api/v1/clients/:id", () => {
    it("debe retornar un solo cliente por ID", async () => {
      const response = await request(app).get(`/api/v1/clients/${createdClientId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(createdClientId);
    });

    it("debe retornar 400 por UUID inválido", async () => {
      const response = await request(app).get("/api/v1/clients/invalid-uuid");
      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/v1/clients/:id", () => {
    it("debe actualizar un cliente existente en la BD", async () => {
      const response = await request(app)
        .put(`/api/v1/clients/${createdClientId}`)
        .send({ name: `${uniqueName} Actualizado`, active: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(`${uniqueName} Actualizado`);
      expect(response.body.data.active).toBe(false);
    });

    it("debe retornar 400 por UUID inválido", async () => {
      const response = await request(app)
        .put("/api/v1/clients/invalid-uuid")
        .send({ name: "Actualizado" });
      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/v1/clients/:id", () => {
    it("debe eliminar un cliente de la BD", async () => {
      const response = await request(app).delete(`/api/v1/clients/${createdClientId}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.softDelete).toBe(true);
    });

    it("debe retornar 400 por UUID inválido", async () => {
      const response = await request(app).delete("/api/v1/clients/invalid-uuid");
      expect(response.status).toBe(400);
    });
  });
});
