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

describe("Flujo Crítico E2E: Notificaciones", () => {
  let adminHeader: string;
  let guardHeader: string;
  let guardId: string;
  let notificationId: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });

    const admin = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "E2E Notif",
        username: `a_e2e_notif_${Date.now()}`,
        password: "password123",
        roleId: adminRole!.id,
      },
    });
    adminHeader = JSON.stringify({ id: admin.id, role: ROLE_ADMIN });

    const guard = await prismaClient.user.create({
      data: {
        name: "Guardia",
        lastName: "E2E Notif",
        username: `g_e2e_notif_${Date.now()}`,
        password: "password123",
        roleId: guardRole!.id,
      },
    });
    guardId = guard.id;
    guardHeader = JSON.stringify({ id: guard.id, role: ROLE_GUARD });
  });

  afterAll(async () => {
    if (guardId) {
      await prismaClient.notificationLog.deleteMany({ where: { userId: guardId } }).catch(() => {});
      await prismaClient.user.delete({ where: { id: guardId } }).catch(() => {});
    }
    // el admin se limpia por cascada o soft-delete; no es crítico
  });

  it("Paso 1: Admin envía una notificación persistente al guardia", async () => {
    const res = await request(app)
      .post("/api/v1/notifications/send")
      .set("user", adminHeader)
      .send({
        title: "Alerta de turno",
        message: "Tu turno inicia en 30 minutos",
        type: "warning",
        userId: guardId,
        persistent: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sent).toBe(true);

    const log = await prismaClient.notificationLog.findFirst({
      where: { userId: guardId, message: "Tu turno inicia en 30 minutos" },
    });
    expect(log).toBeDefined();
    expect(log!.read).toBe(false);
    notificationId = log!.id;
  });

  it("Paso 2: Guardia ve su bandeja con la notificación no leída", async () => {
    const res = await request(app)
      .get("/api/v1/notifications/my")
      .set("user", guardHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(1);
    const found = res.body.data.notifications.find((n: { id: string }) => n.id === notificationId);
    expect(found).toBeDefined();
  });

  it("Paso 3: Guardia marca la notificación como leída", async () => {
    const res = await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set("user", guardHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("Paso 4: Verificar en DB que la notificación quedó leída", async () => {
    const log = await prismaClient.notificationLog.findUnique({ where: { id: notificationId } });
    expect(log!.read).toBe(true);
    expect(log!.readAt).toBeDefined();
  });
});
