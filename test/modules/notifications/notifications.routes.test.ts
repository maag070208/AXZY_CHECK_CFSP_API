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

describe("Rutas de Notificaciones (Integración)", () => {
  let adminUserId: string;
  let guardUserId: string;
  let createdLogId: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });

    const admin = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "Notif",
        username: `admin_notif_${Date.now()}`,
        password: "hashed",
        roleId: adminRole!.id,
      },
    });
    adminUserId = admin.id;

    const guard = await prismaClient.user.create({
      data: {
        name: "Guardia",
        lastName: "Notif",
        username: `guard_notif_${Date.now()}`,
        password: "hashed",
        roleId: guardRole!.id,
      },
    });
    guardUserId = guard.id;
  });

  afterAll(async () => {
    await prismaClient.notificationLog.deleteMany({ where: { userId: guardUserId } }).catch(() => {});
    await prismaClient.notificationLog.deleteMany({ where: { userId: adminUserId } }).catch(() => {});
    if (adminUserId) await prismaClient.user.delete({ where: { id: adminUserId } }).catch(() => {});
    if (guardUserId) await prismaClient.user.delete({ where: { id: guardUserId } }).catch(() => {});
  });

  describe("POST /api/v1/notifications/send", () => {
    it("debe enviar una notificación persistente y guardarla en la bandeja del destinatario", async () => {
      const res = await request(app)
        .post("/api/v1/notifications/send")
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({ title: "Aviso", message: "Revisa tu turno", userId: guardUserId, persistent: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sent).toBe(true);

      const log = await prismaClient.notificationLog.findFirst({
        where: { userId: guardUserId, message: "Revisa tu turno" },
      });
      expect(log).toBeDefined();
      expect(log!.read).toBe(false);
      createdLogId = log!.id;
    });

    it("debe fallar si falta el mensaje", async () => {
      const res = await request(app)
        .post("/api/v1/notifications/send")
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({ title: "Sin mensaje" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/notifications/my", () => {
    it("debe devolver las notificaciones del usuario y el contador de no leídas", async () => {
      const res = await request(app)
        .get("/api/v1/notifications/my")
        .set("user", JSON.stringify({ id: guardUserId, role: ROLE_GUARD }));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.notifications)).toBe(true);
      expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("PATCH /api/v1/notifications/:id/read", () => {
    it("debe marcar una notificación como leída", async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${createdLogId}/read`)
        .set("user", JSON.stringify({ id: guardUserId, role: ROLE_GUARD }));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const log = await prismaClient.notificationLog.findUnique({ where: { id: createdLogId } });
      expect(log!.read).toBe(true);
    });
  });

  describe("PATCH /api/v1/notifications/read-all", () => {
    it("debe marcar todas las notificaciones del usuario como leídas", async () => {
      // crear una segunda notificación no leída
      await prismaClient.notificationLog.create({
        data: { userId: guardUserId, message: "Segunda notificación", type: "info" },
      });

      const res = await request(app)
        .patch("/api/v1/notifications/read-all")
        .set("user", JSON.stringify({ id: guardUserId, role: ROLE_GUARD }));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const unread = await prismaClient.notificationLog.count({
        where: { userId: guardUserId, read: false },
      });
      expect(unread).toBe(0);
    });
  });
});
