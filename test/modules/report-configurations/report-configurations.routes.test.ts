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

describe("Rutas de Configuración de Reportes (Integración)", () => {
  let adminHeader: string;
  let createdId: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const admin = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "RepCfg",
        username: `admin_repcfg_${Date.now()}`,
        password: "hashed",
        roleId: adminRole!.id,
      },
    });
    adminHeader = JSON.stringify({ id: admin.id, role: ROLE_ADMIN });
  });

  afterAll(async () => {
    if (createdId) await prismaClient.reportConfiguration.delete({ where: { id: createdId } }).catch(() => {});
    await prismaClient.user.deleteMany({ where: { username: { startsWith: "admin_repcfg_" } } }).catch(() => {});
  });

  it("debe crear una configuración de reporte", async () => {
    const res = await request(app)
      .post("/api/v1/report-configurations")
      .set("user", adminHeader)
      .send({ name: "Reporte Test", reportType: "INCIDENTS", configuration: { period: "weekly" } });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    createdId = res.body.data.id;
  });

  it("debe listar las configuraciones en el datatable", async () => {
    const res = await request(app)
      .post("/api/v1/report-configurations/datatable")
      .set("user", adminHeader)
      .send({ page: 1, limit: 10, filters: {} });

    expect(res.status).toBe(200);
    const found = res.body.data.rows.find((c: { id: string }) => c.id === createdId);
    expect(found).toBeDefined();
  });

  it("debe actualizar una configuración", async () => {
    const res = await request(app)
      .put(`/api/v1/report-configurations/${createdId}`)
      .set("user", adminHeader)
      .send({ name: "Reporte Test Editado" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Reporte Test Editado");
  });

  it("debe eliminar una configuración", async () => {
    const res = await request(app)
      .delete(`/api/v1/report-configurations/${createdId}`)
      .set("user", adminHeader);

    expect(res.status).toBe(200);
    createdId = "";
  });
});
