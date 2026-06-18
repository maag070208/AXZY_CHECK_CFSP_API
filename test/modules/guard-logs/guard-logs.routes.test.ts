import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_ADMIN, ROLE_GUARD, ROLE_SHIFT, ROLE_MAINTENANCE } from "@src/core/config/constants";

jest.mock("@src/modules/common/middlewares/auth.middleware", () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers["user"]) {
      req.user = JSON.parse(req.headers["user"]);
      res.locals.user = req.user;
    }
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next(),
}));

jest.setTimeout(30000);

describe("Rutas de Prenómina (GuardLoginLog)", () => {
  let adminUserId: string;
  let guardUserId: string;
  let shiftUserId: string;
  let maintUserId: string;
  let guardRoleId: string;
  let adminRoleId: string;
  let createdLogId: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });
    const shiftRole = await prismaClient.role.findUnique({ where: { name: ROLE_SHIFT } });
    const maintRole = await prismaClient.role.findUnique({ where: { name: ROLE_MAINTENANCE } });
    adminRoleId = adminRole!.id;
    guardRoleId = guardRole!.id;

    const adminRes = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "Test",
        username: `admin_guardlog_${Date.now()}`,
        password: "hashed",
        roleId: adminRoleId,
      },
    });
    adminUserId = adminRes.id;

    const guardRes = await prismaClient.user.create({
      data: {
        name: "Guard",
        lastName: "Test",
        username: `guard_guardlog_${Date.now()}`,
        password: "hashed",
        roleId: guardRole!.id,
      },
    });
    guardUserId = guardRes.id;

    const shiftRes = await prismaClient.user.create({
      data: {
        name: "Shift",
        lastName: "Test",
        username: `shift_guardlog_${Date.now()}`,
        password: "hashed",
        roleId: shiftRole!.id,
      },
    });
    shiftUserId = shiftRes.id;

    const maintRes = await prismaClient.user.create({
      data: {
        name: "Maint",
        lastName: "Test",
        username: `maint_guardlog_${Date.now()}`,
        password: "hashed",
        roleId: maintRole!.id,
      },
    });
    maintUserId = maintRes.id;
  });

  afterAll(async () => {
    await prismaClient.guardLoginLog.deleteMany({
      where: { userId: { in: [guardUserId, shiftUserId, maintUserId] } },
    }).catch(() => {});
    if (adminUserId) await prismaClient.user.delete({ where: { id: adminUserId } }).catch(() => {});
    if (guardUserId) await prismaClient.user.delete({ where: { id: guardUserId } }).catch(() => {});
    if (shiftUserId) await prismaClient.user.delete({ where: { id: shiftUserId } }).catch(() => {});
    if (maintUserId) await prismaClient.user.delete({ where: { id: maintUserId } }).catch(() => {});
  });

  describe("Clock-In", () => {
    it("debe crear un registro de entrada para un guardia", async () => {
      const res = await request(app)
        .post("/api/v1/guard-logs/clock-in")
        .set("user", JSON.stringify({ id: guardUserId }))
        .send({ guardId: guardUserId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(guardUserId);
      expect(res.body.data.loginAt).toBeDefined();
      expect(res.body.data.logoutAt).toBeNull();
      createdLogId = res.body.data.id;
    });

    it("debe fallar si el guardia ya tiene una entrada abierta", async () => {
      const res = await request(app)
        .post("/api/v1/guard-logs/clock-in")
        .set("user", JSON.stringify({ id: guardUserId }))
        .send({ guardId: guardUserId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.messages[0]).toContain("ya tiene una entrada abierta");
    });

    it("debe fallar si el usuario no es un rol operativo", async () => {
      const res = await request(app)
        .post("/api/v1/guard-logs/clock-in")
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({ guardId: adminUserId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.messages[0]).toContain("no es un guardia operativo");
    });

    it("debe fallar si guardId no es un UUID", async () => {
      const res = await request(app)
        .post("/api/v1/guard-logs/clock-in")
        .set("user", JSON.stringify({ id: guardUserId }))
        .send({ guardId: "no-es-uuid" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("Clock-Out", () => {
    it("debe cerrar la entrada abierta del guardia", async () => {
      const res = await request(app)
        .patch("/api/v1/guard-logs/clock-out")
        .set("user", JSON.stringify({ id: guardUserId }))
        .send({ guardId: guardUserId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(guardUserId);
      expect(res.body.data.logoutAt).toBeDefined();
    });

    it("debe fallar si no hay entrada abierta", async () => {
      const res = await request(app)
        .patch("/api/v1/guard-logs/clock-out")
        .set("user", JSON.stringify({ id: guardUserId }))
        .send({ guardId: guardUserId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.messages[0]).toContain("No hay una entrada abierta");
    });
  });

  describe("DataTable", () => {
    beforeAll(async () => {
      await prismaClient.guardLoginLog.create({
        data: { userId: guardUserId, loginAt: new Date("2026-06-01T08:00:00Z"), logoutAt: new Date("2026-06-01T17:00:00Z") },
      });
      await prismaClient.guardLoginLog.create({
        data: { userId: shiftUserId, loginAt: new Date("2026-06-01T09:00:00Z"), logoutAt: new Date("2026-06-01T18:00:00Z") },
      });
      await prismaClient.guardLoginLog.create({
        data: { userId: guardUserId, loginAt: new Date("2026-06-02T08:00:00Z"), logoutAt: null },
      });
    });

    it("debe retornar todos los registros paginados", async () => {
      const res = await request(app)
        .post("/api/v1/guard-logs/datatable")
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rows.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.total).toBeGreaterThanOrEqual(3);
    });

    it("debe filtrar por rango de fechas", async () => {
      const res = await request(app)
        .post("/api/v1/guard-logs/datatable")
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({
          page: 1,
          limit: 10,
          filters: {
            date: ["2026-06-01T00:00:00Z", "2026-06-01T23:59:59Z"],
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.rows.length).toBe(2);
    });

    it("debe filtrar por guardia abierto (isOpen=true)", async () => {
      const res = await request(app)
        .post("/api/v1/guard-logs/datatable")
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({
          page: 1,
          limit: 10,
          filters: { isOpen: true },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.rows.every((r: any) => r.logoutAt === null)).toBe(true);
    });

    it("debe filtrar por guardia cerrado (isOpen=false)", async () => {
      const res = await request(app)
        .post("/api/v1/guard-logs/datatable")
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({
          page: 1,
          limit: 10,
          filters: { isOpen: false },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.rows.every((r: any) => r.logoutAt !== null)).toBe(true);
    });

    it("debe buscar por nombre de usuario (search)", async () => {
      const res = await request(app)
        .post("/api/v1/guard-logs/datatable")
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({
          page: 1,
          limit: 10,
          filters: { search: "Shift" },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.rows.length).toBeGreaterThan(0);
      expect(res.body.data.rows.every((r: any) =>
        r.user.name.toLowerCase().includes("shift") ||
        r.user.lastName?.toLowerCase().includes("shift") ||
        r.user.username.toLowerCase().includes("shift")
      )).toBe(true);
    });

    it("debe ordenar por loginAt descendente", async () => {
      const res = await request(app)
        .post("/api/v1/guard-logs/datatable")
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({
          page: 1,
          limit: 10,
          sort: { key: "loginAt", direction: "desc" },
        });

      expect(res.status).toBe(200);
      const dates = res.body.data.rows.map((r: any) => new Date(r.loginAt).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
      }
    });

    it("debe fallar si faltan page o limit", async () => {
      const res = await request(app)
        .post("/api/v1/guard-logs/datatable")
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({ filters: {} });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
