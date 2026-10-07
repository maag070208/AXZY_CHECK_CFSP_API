import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_ADMIN } from "@src/core/config/constants";

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

jest.setTimeout(30000);

describe("Rutas de Notificaciones Programadas (Integración)", () => {
  let adminUserId: string;
  let createdId: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const admin = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "Sched",
        username: `admin_sched_${Date.now()}`,
        password: "hashed",
        roleId: adminRole!.id,
      },
    });
    adminUserId = admin.id;
  });

  afterAll(async () => {
    if (createdId) await prismaClient.scheduledNotification.delete({ where: { id: createdId } }).catch(() => {});
    if (adminUserId) await prismaClient.user.delete({ where: { id: adminUserId } }).catch(() => {});
  });

  describe("POST /api/v1/scheduled-notifications", () => {
    it("debe crear un aviso programado", async () => {
      const res = await request(app)
        .post("/api/v1/scheduled-notifications")
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({
          title: "Aviso diario",
          message: "Revisa la ronda de la mañana",
          frequency: "DAILY",
          timeOfDay: "08:00",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.message).toBe("Revisa la ronda de la mañana");
      createdId = res.body.data.id;
    });

    it("debe fallar si falta el mensaje", async () => {
      const res = await request(app)
        .post("/api/v1/scheduled-notifications")
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({ title: "Sin mensaje" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/scheduled-notifications/:id", () => {
    it("debe devolver el detalle del aviso", async () => {
      const res = await request(app)
        .get(`/api/v1/scheduled-notifications/${createdId}`)
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdId);
    });
  });

  describe("POST /api/v1/scheduled-notifications/datatable", () => {
    it("debe listar los avisos en el datatable", async () => {
      const res = await request(app)
        .post("/api/v1/scheduled-notifications/datatable")
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({ page: 1, limit: 10, filters: {} });

      expect(res.status).toBe(200);
      const found = res.body.data.rows.find((r: { id: string }) => r.id === createdId);
      expect(found).toBeDefined();
    });
  });

  describe("PUT /api/v1/scheduled-notifications/:id", () => {
    it("debe actualizar un aviso programado", async () => {
      const res = await request(app)
        .put(`/api/v1/scheduled-notifications/${createdId}`)
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({ title: "Aviso actualizado" });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe("Aviso actualizado");
    });
  });

  describe("DELETE /api/v1/scheduled-notifications/:id", () => {
    it("debe eliminar un aviso programado", async () => {
      const res = await request(app)
        .delete(`/api/v1/scheduled-notifications/${createdId}`)
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const record = await prismaClient.scheduledNotification.findUnique({ where: { id: createdId } });
      expect(record).toBeNull();
      createdId = "";
    });
  });
});
