import { ROLE_ADMIN, ROLE_GUARD } from "@src/core/config/constants";
import { prismaClient } from "@src/core/config/database";
import { app } from "@src/index";
import request from "supertest";

jest.setTimeout(60000);

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

jest.mock("@src/core/middlewares/token-validator.middleware", () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    if (req.headers["user"]) {
      const user = JSON.parse(req.headers["user"]);
      req.user = user;
      res.locals.user = user;
    }
    next();
  },
}));

describe("Flujo Crítico E2E: Prenómina (GuardLoginLog)", () => {
  let adminHeader: string;
  let guardHeader: string;
  let adminId: string;
  let guardId: string;
  let logId: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });

    const adminUser = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "E2E Pre",
        username: `a_e2e_pre_${Date.now()}`,
        password: "password123",
        roleId: adminRole!.id,
      },
    });
    adminId = adminUser.id;
    adminHeader = JSON.stringify({ id: adminId, role: "ADMIN" });

    const guardUser = await prismaClient.user.create({
      data: {
        name: "Guard",
        lastName: "E2E Pre",
        username: `g_e2e_pre_${Date.now()}`,
        password: "password123",
        roleId: guardRole!.id,
      },
    });
    guardId = guardUser.id;
    guardHeader = JSON.stringify({ id: guardId, role: "GUARD" });
  });

  afterAll(async () => {
    await prismaClient.guardLoginLog.deleteMany({
      where: { userId: guardId },
    }).catch(() => {});
    if (adminId) await prismaClient.user.delete({ where: { id: adminId } }).catch(() => {});
    if (guardId) await prismaClient.user.delete({ where: { id: guardId } }).catch(() => {});
  });

  it("Paso 1: Guardia hace clock-in al iniciar turno", async () => {
    const res = await request(app)
      .post("/api/v1/guard-logs/clock-in")
      .set("user", guardHeader)
      .send({ guardId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBe(guardId);
    expect(res.body.data.loginAt).toBeDefined();
    expect(res.body.data.logoutAt).toBeNull();
    expect(res.body.data.user.name).toBe("Guard");
    logId = res.body.data.id;
  });

  it("Paso 2: No se puede hacer clock-in duplicado sin cerrar el anterior", async () => {
    const res = await request(app)
      .post("/api/v1/guard-logs/clock-in")
      .set("user", guardHeader)
      .send({ guardId });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.messages[0]).toContain("ya tiene una entrada abierta");
  });

  it("Paso 3: Admin consulta datatable y ve entrada abierta", async () => {
    const res = await request(app)
      .post("/api/v1/guard-logs/datatable")
      .set("user", adminHeader)
      .send({
        page: 1,
        limit: 10,
        filters: { isOpen: true },
        sort: { key: "loginAt", direction: "desc" },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const log = res.body.data.rows.find((r: any) => r.id === logId);
    expect(log).toBeDefined();
    expect(log.userId).toBe(guardId);
    expect(log.logoutAt).toBeNull();
  });

  it("Paso 4: Admin filtra por fecha actual y encuentra el registro", async () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

    const res = await request(app)
      .post("/api/v1/guard-logs/datatable")
      .set("user", adminHeader)
      .send({
        page: 1,
        limit: 10,
        filters: { date: [start, end] },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const found = res.body.data.rows.some((r: any) => r.id === logId);
    expect(found).toBe(true);
  });

  it("Paso 5: Guardia hace clock-out al terminar turno", async () => {
    const res = await request(app)
      .patch("/api/v1/guard-logs/clock-out")
      .set("user", guardHeader)
      .send({ guardId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(logId);
    expect(res.body.data.logoutAt).toBeDefined();
  });

  it("Paso 6: Admin verifica que el registro ya no aparece como abierto", async () => {
    const res = await request(app)
      .post("/api/v1/guard-logs/datatable")
      .set("user", adminHeader)
      .send({
        page: 1,
        limit: 10,
        filters: { isOpen: true },
      });

    expect(res.status).toBe(200);
    const openLog = res.body.data.rows.find((r: any) => r.id === logId);
    expect(openLog).toBeUndefined();
  });

  it("Paso 7: Admin verifica que el registro aparece como cerrado", async () => {
    const res = await request(app)
      .post("/api/v1/guard-logs/datatable")
      .set("user", adminHeader)
      .send({
        page: 1,
        limit: 10,
        filters: { isOpen: false },
      });

    expect(res.status).toBe(200);
    const closedLog = res.body.data.rows.find((r: any) => r.id === logId);
    expect(closedLog).toBeDefined();
    expect(closedLog.logoutAt).toBeDefined();
  });

  it("Paso 8: Verificar duración en DB es coherente", async () => {
    const log = await prismaClient.guardLoginLog.findUnique({ where: { id: logId } });
    expect(log).toBeDefined();
    expect(log!.loginAt).toBeDefined();
    expect(log!.logoutAt).toBeDefined();
    const diffMs = new Date(log!.logoutAt!).getTime() - new Date(log!.loginAt).getTime();
    expect(diffMs).toBeGreaterThan(0);
  });

  it("Paso 9: Guardia puede volver a clock-in en nuevo turno y clock-out", async () => {
    const clockInRes = await request(app)
      .post("/api/v1/guard-logs/clock-in")
      .set("user", guardHeader)
      .send({ guardId });

    expect(clockInRes.status).toBe(201);
    expect(clockInRes.body.success).toBe(true);

    const newLogId = clockInRes.body.data.id;

    const clockOutRes = await request(app)
      .patch("/api/v1/guard-logs/clock-out")
      .set("user", guardHeader)
      .send({ guardId });

    expect(clockOutRes.status).toBe(200);
    expect(clockOutRes.body.data.id).toBe(newLogId);
    expect(clockOutRes.body.data.logoutAt).toBeDefined();
  });
});
