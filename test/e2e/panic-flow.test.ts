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

describe("Flujo Crítico E2E: Alertas de Pánico", () => {
  let adminHeader: string;
  let guardHeader: string;
  let guardId: string;
  let alertId: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });

    const admin = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "E2E Panic",
        username: `a_e2e_panic_${Date.now()}`,
        password: "password123",
        roleId: adminRole!.id,
      },
    });
    adminHeader = JSON.stringify({ id: admin.id, role: ROLE_ADMIN });

    const guard = await prismaClient.user.create({
      data: {
        name: "Guardia",
        lastName: "E2E Panic",
        username: `g_e2e_panic_${Date.now()}`,
        password: "password123",
        roleId: guardRole!.id,
      },
    });
    guardId = guard.id;
    guardHeader = JSON.stringify({ id: guard.id, role: ROLE_GUARD });
  });

  afterAll(async () => {
    if (alertId) await prismaClient.panicAlert.delete({ where: { id: alertId } }).catch(() => {});
    if (guardId) await prismaClient.user.delete({ where: { id: guardId } }).catch(() => {});
  });

  it("Paso 1: Guardia dispara una alerta de pánico", async () => {
    const res = await request(app)
      .post("/api/v1/panic-alerts")
      .set("user", guardHeader)
      .send({
        message: "Persona sospechosa en el perímetro",
        triggerLatitude: 19.4326,
        triggerLongitude: -99.1332,
        triggerAccuracy: 8,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("PENDING");
    alertId = res.body.data.id;
  });

  it("Paso 2: Admin ve la alerta en el datatable", async () => {
    const res = await request(app)
      .post("/api/v1/panic-alerts/datatable")
      .set("user", adminHeader)
      .send({ page: 1, limit: 10, filters: { status: "PENDING" } });

    expect(res.status).toBe(200);
    const found = res.body.data.rows.find((a: { id: string }) => a.id === alertId);
    expect(found).toBeDefined();
  });

  it("Paso 3: Admin resuelve la alerta", async () => {
    const res = await request(app)
      .put(`/api/v1/panic-alerts/${alertId}/resolve`)
      .set("user", adminHeader)
      .send({ status: "RESOLVED", resolutionComment: "Unidad enviada al punto" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("RESOLVED");
  });

  it("Paso 4: Verificar el cambio de estado en DB", async () => {
    const alert = await prismaClient.panicAlert.findUnique({ where: { id: alertId } });
    expect(alert!.status).toBe("RESOLVED");
    expect(alert!.resolvedById).toBeDefined();
    expect(alert!.resolvedAt).toBeDefined();
  });
});
