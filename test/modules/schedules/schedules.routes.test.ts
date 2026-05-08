import request from "supertest";
import { app } from "@src/index";

jest.mock("@src/modules/common/middlewares/auth.middleware", () => ({
  authenticate: (req: any, res: any, next: any) => next(),
  authorize: () => (req: any, res: any, next: any) => next(),
}));

describe("Rutas de Horarios (Integración)", () => {
  let createdScheduleId: string;
  const uniqueName = `Horario de Prueba ${Date.now()}`;

  describe("POST /api/v1/schedules", () => {
    it("debe crear un nuevo horario en la base de datos", async () => {
      const response = await request(app)
        .post("/api/v1/schedules")
        .send({ name: uniqueName, startTime: "08:00", endTime: "16:00" });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data).toBe("object");
      expect(response.body.data.name).toBe(uniqueName);

      createdScheduleId = response.body.data.id;
      expect(createdScheduleId).toBeDefined();
    });

    it("debe retornar 400 si faltan campos requeridos", async () => {
      const response = await request(app)
        .post("/api/v1/schedules")
        .send({ name: "Mañana" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/schedules", () => {
    it("debe retornar una lista de horarios desde la BD", async () => {
      const response = await request(app).get("/api/v1/schedules");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // Verificar que nuestro horario creado esté en la lista
      const found = response.body.data.find(
        (s: any) => s.id === createdScheduleId,
      );
      expect(found).toBeDefined();
    });
  });

  describe("POST /api/v1/schedules/datatable", () => {
    it("debe retornar una respuesta de datatable desde la BD", async () => {
      const response = await request(app)
        .post("/api/v1/schedules/datatable")
        .send({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data).toBe("object");
      expect(Array.isArray(response.body.data.rows)).toBe(true);
      expect(typeof response.body.data.total).toBe("number");
      expect(response.body.data.total).toBeGreaterThan(0);
    });
  });

  describe("GET /api/v1/schedules/:id/users", () => {
    it("debe retornar los usuarios de un horario", async () => {
      const response = await request(app).get(
        `/api/v1/schedules/${createdScheduleId}/users`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("debe retornar 400 por UUID inválido", async () => {
      const response = await request(app).get(
        "/api/v1/schedules/invalid-id/users",
      );
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/v1/schedules/:id", () => {
    it("debe actualizar un horario existente en la BD", async () => {
      const response = await request(app)
        .put(`/api/v1/schedules/${createdScheduleId}`)
        .send({ name: `${uniqueName} Actualizado` });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data).toBe("object");
      expect(response.body.data.name).toBe(`${uniqueName} Actualizado`);
    });

    it("debe retornar 400 por UUID inválido", async () => {
      const response = await request(app)
        .put("/api/v1/schedules/invalid-uuid")
        .send({ name: "Mañana Actualizada" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("DELETE /api/v1/schedules/:id", () => {
    it("debe eliminar un horario de la BD", async () => {
      const response = await request(app).delete(
        `/api/v1/schedules/${createdScheduleId}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
