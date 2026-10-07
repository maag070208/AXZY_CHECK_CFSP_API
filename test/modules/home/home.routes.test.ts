import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_ADMIN, ROLE_CLIENT } from "@src/core/config/constants";

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

describe("Rutas de Inicio (Dashboard Stats)", () => {
  let adminHeader: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const admin = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "Home",
        username: `admin_home_${Date.now()}`,
        password: "hashed",
        roleId: adminRole!.id,
      },
    });
    adminHeader = JSON.stringify({ id: admin.id, role: ROLE_ADMIN });
  });

  afterAll(async () => {
    await prismaClient.user.deleteMany({ where: { username: { startsWith: "admin_home_" } } }).catch(() => {});
  });

  it("debe devolver las métricas del dashboard", async () => {
    const res = await request(app)
      .get("/api/v1/home/stats")
      .set("user", adminHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.activeRoundsCount).toBe("number");
    expect(Array.isArray(res.body.data.activeRounds)).toBe(true);
    expect(typeof res.body.data.pendingIncidentsCount).toBe("number");
    expect(typeof res.body.data.pendingMaintenanceCount).toBe("number");
  });
});
