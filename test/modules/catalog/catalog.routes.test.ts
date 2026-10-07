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

describe("Rutas de Catálogo (Integración)", () => {
  let adminHeader: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const admin = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "Catalog",
        username: `admin_catalog_${Date.now()}`,
        password: "hashed",
        roleId: adminRole!.id,
      },
    });
    adminHeader = JSON.stringify({ id: admin.id, role: ROLE_ADMIN });
  });

  afterAll(async () => {
    await prismaClient.user.deleteMany({ where: { username: { startsWith: "admin_catalog_" } } }).catch(() => {});
  });

  it("debe devolver un catálogo por su clave", async () => {
    const res = await request(app)
      .get("/api/v1/catalog/role")
      .set("user", adminHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("debe fallar con una clave vacía", async () => {
    const res = await request(app)
      .get("/api/v1/catalog/")
      .set("user", adminHeader);

    expect(res.status).toBe(404);
  });
});
