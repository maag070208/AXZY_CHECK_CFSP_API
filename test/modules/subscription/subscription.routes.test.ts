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

describe("Rutas de Suscripción (Integración)", () => {
  let adminHeader: string;
  let configId: string | null = null;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const admin = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "Sub",
        username: `admin_sub_${Date.now()}`,
        password: "hashed",
        roleId: adminRole!.id,
      },
    });
    adminHeader = JSON.stringify({ id: admin.id, role: ROLE_ADMIN });
  });

  afterAll(async () => {
    await prismaClient.user.deleteMany({ where: { username: { startsWith: "admin_sub_" } } }).catch(() => {});
  });

  it("debe devolver la configuración de suscripción (o null)", async () => {
    const res = await request(app)
      .get("/api/v1/subscription/config")
      .set("user", adminHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("debe actualizar la configuración de suscripción", async () => {
    const res = await request(app)
      .put("/api/v1/subscription/config")
      .set("user", adminHeader)
      .send({ paid: false, trialDaysRemaining: 30, showTrialWatermark: true, showTrialBadge: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    configId = res.body.data.id;
  });

  it("debe reflejar la configuración actualizada", async () => {
    const res = await request(app)
      .get("/api/v1/subscription/config")
      .set("user", adminHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.trialDaysRemaining).toBe(30);
  });
});
