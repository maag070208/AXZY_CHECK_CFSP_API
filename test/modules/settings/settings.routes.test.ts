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

describe("Rutas de Configuración (Integración)", () => {
  let adminHeader: string;
  let categoryId: string;
  let typeId: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const admin = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "Settings",
        username: `admin_settings_${Date.now()}`,
        password: "hashed",
        roleId: adminRole!.id,
      },
    });
    adminHeader = JSON.stringify({ id: admin.id, role: ROLE_ADMIN });
  });

  afterAll(async () => {
    if (typeId) await prismaClient.incidentType.delete({ where: { id: typeId } }).catch(() => {});
    if (categoryId) await prismaClient.incidentCategory.delete({ where: { id: categoryId } }).catch(() => {});
  });

  describe("Categorías de incidentes", () => {
    it("debe crear una categoría", async () => {
      const res = await request(app)
        .post("/api/v1/settings/categories")
        .set("user", adminHeader)
        .send({ name: "Categoría Test", value: "CAT_TEST", type: "INCIDENT" });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      categoryId = res.body.data.id;
    });

    it("debe listar categorías en el datatable", async () => {
      const res = await request(app)
        .post("/api/v1/settings/categories/datatable")
        .set("user", adminHeader)
        .send({ page: 1, limit: 10, filters: {} });

      expect(res.status).toBe(200);
      const found = res.body.data.rows.find((c: { id: string }) => c.id === categoryId);
      expect(found).toBeDefined();
    });

    it("debe actualizar una categoría", async () => {
      const res = await request(app)
        .put(`/api/v1/settings/categories/${categoryId}`)
        .set("user", adminHeader)
        .send({ name: "Categoría Test Editada" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Categoría Test Editada");
    });
  });

  describe("Tipos de incidentes", () => {
    it("debe crear un tipo ligado a una categoría", async () => {
      const res = await request(app)
        .post("/api/v1/settings/types")
        .set("user", adminHeader)
        .send({ name: "Tipo Test", value: "TYPE_TEST", categoryId });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      typeId = res.body.data.id;
    });

    it("debe listar tipos en el datatable", async () => {
      const res = await request(app)
        .post("/api/v1/settings/types/datatable")
        .set("user", adminHeader)
        .send({ page: 1, limit: 10, filters: {} });

      expect(res.status).toBe(200);
      const found = res.body.data.rows.find((t: { id: string }) => t.id === typeId);
      expect(found).toBeDefined();
    });
  });

  describe("SysConfig", () => {
    it("debe actualizar una configuración del sistema", async () => {
      const res = await request(app)
        .post("/api/v1/settings/sysconfig")
        .set("user", adminHeader)
        .send({ key: "TEST_KEY", value: "test-value" });

      expect(res.status).toBe(200);
    });

    it("debe listar la configuración en el datatable", async () => {
      const res = await request(app)
        .post("/api/v1/settings/sysconfig/datatable")
        .set("user", adminHeader)
        .send({ page: 1, limit: 10, filters: { search: "TEST_KEY" } });

      expect(res.status).toBe(200);
      expect(res.body.data.rows.length).toBeGreaterThanOrEqual(1);
    });

    it("debe eliminar una configuración", async () => {
      const res = await request(app)
        .delete("/api/v1/settings/sysconfig/TEST_KEY")
        .set("user", adminHeader);

      expect(res.status).toBe(200);
    });
  });
});
