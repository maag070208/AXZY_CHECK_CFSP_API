import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_ADMIN, ROLE_GUARD } from "@src/core/config/constants";

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

describe("Rutas de Alertas de Pánico (Integración)", () => {
  let adminUserId: string;
  let guardUserId: string;
  let alertId: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });

    const admin = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "Panic",
        username: `admin_panic_${Date.now()}`,
        password: "hashed",
        roleId: adminRole!.id,
      },
    });
    adminUserId = admin.id;

    const guard = await prismaClient.user.create({
      data: {
        name: "Guardia",
        lastName: "Panic",
        username: `guard_panic_${Date.now()}`,
        password: "hashed",
        roleId: guardRole!.id,
      },
    });
    guardUserId = guard.id;
  });

  afterAll(async () => {
    if (alertId) await prismaClient.panicAlert.delete({ where: { id: alertId } }).catch(() => {});
    if (guardUserId) await prismaClient.user.delete({ where: { id: guardUserId } }).catch(() => {});
    if (adminUserId) await prismaClient.user.delete({ where: { id: adminUserId } }).catch(() => {});
  });

  describe("POST /api/v1/panic-alerts", () => {
    it("debe crear una alerta de pánico para un guardia operativo", async () => {
      const res = await request(app)
        .post("/api/v1/panic-alerts")
        .set("user", JSON.stringify({ id: guardUserId, role: ROLE_GUARD }))
        .send({
          message: "Necesito apoyo",
          triggerLatitude: 19.4326,
          triggerLongitude: -99.1332,
          triggerAccuracy: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe("PENDING");
      alertId = res.body.data.id;
    });

    it("debe rechazar un rol no operativo", async () => {
      const res = await request(app)
        .post("/api/v1/panic-alerts")
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({ message: "No debería" });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/panic-alerts/:id", () => {
    it("debe devolver el detalle de una alerta", async () => {
      const res = await request(app)
        .get(`/api/v1/panic-alerts/${alertId}`)
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(alertId);
    });

    it("debe devolver 400 por UUID inválido", async () => {
      const res = await request(app)
        .get("/api/v1/panic-alerts/no-uuid")
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }));

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/panic-alerts/datatable", () => {
    it("debe listar las alertas en el datatable", async () => {
      const res = await request(app)
        .post("/api/v1/panic-alerts/datatable")
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({ page: 1, limit: 10, filters: {} });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const found = res.body.data.rows.find((a: { id: string }) => a.id === alertId);
      expect(found).toBeDefined();
    });
  });

  describe("PUT /api/v1/panic-alerts/:id/resolve", () => {
    it("debe resolver una alerta de pánico", async () => {
      const res = await request(app)
        .put(`/api/v1/panic-alerts/${alertId}/resolve`)
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({ status: "RESOLVED", resolutionComment: "Atendida por supervisor" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const alert = await prismaClient.panicAlert.findUnique({ where: { id: alertId } });
      expect(alert!.status).toBe("RESOLVED");
      expect(alert!.resolutionComment).toBe("Atendida por supervisor");
      expect(alert!.resolvedAt).toBeDefined();
    });
  });

  describe("GET /api/v1/panic-alerts/recent", () => {
    it("debe devolver las alertas recientes", async () => {
      const res = await request(app)
        .get("/api/v1/panic-alerts/recent")
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
