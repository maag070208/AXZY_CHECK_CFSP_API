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

describe("Flujo Crítico E2E: Notificaciones Programadas", () => {
  let adminHeader: string;
  let adminId: string;
  let notificationId: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const admin = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "E2E Sched",
        username: `a_e2e_sched_${Date.now()}`,
        password: "password123",
        roleId: adminRole!.id,
      },
    });
    adminId = admin.id;
    adminHeader = JSON.stringify({ id: admin.id, role: ROLE_ADMIN });
  });

  afterAll(async () => {
    if (notificationId) await prismaClient.scheduledNotification.delete({ where: { id: notificationId } }).catch(() => {});
    if (adminId) await prismaClient.user.delete({ where: { id: adminId } }).catch(() => {});
  });

  it("Paso 1: Admin crea un aviso semanal", async () => {
    const res = await request(app)
      .post("/api/v1/scheduled-notifications")
      .set("user", adminHeader)
      .send({
        title: "Resumen semanal",
        message: "Enviar reporte de rondas",
        frequency: "WEEKLY",
        daysOfWeek: "1",
        timeOfDay: "09:00",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    notificationId = res.body.data.id;
  });

  it("Paso 2: Admin ve el aviso en el datatable", async () => {
    const res = await request(app)
      .post("/api/v1/scheduled-notifications/datatable")
      .set("user", adminHeader)
      .send({ page: 1, limit: 10, filters: {} });

    expect(res.status).toBe(200);
    const found = res.body.data.rows.find((r: { id: string }) => r.id === notificationId);
    expect(found).toBeDefined();
    expect(found.frequency).toBe("WEEKLY");
  });

  it("Paso 3: Admin actualiza la frecuencia a diaria", async () => {
    const res = await request(app)
      .put(`/api/v1/scheduled-notifications/${notificationId}`)
      .set("user", adminHeader)
      .send({ frequency: "DAILY", timeOfDay: "07:30" });

    expect(res.status).toBe(200);
    expect(res.body.data.frequency).toBe("DAILY");
  });

  it("Paso 4: Admin elimina el aviso y desaparece de la base", async () => {
    const res = await request(app)
      .delete(`/api/v1/scheduled-notifications/${notificationId}`)
      .set("user", adminHeader);

    expect(res.status).toBe(200);
    const record = await prismaClient.scheduledNotification.findUnique({ where: { id: notificationId } });
    expect(record).toBeNull();
    notificationId = "";
  });
});
