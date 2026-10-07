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

/** UUID válido que no existe en la base: sirve para probar recursos inexistentes. */
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";

describe("Rutas de Configuración (Integración)", () => {
  let adminHeader: string;
  let categoryId: string;
  let typeId: string;
  let secuencia = 0;
  const creadosTypeIds: string[] = [];
  const creadosCategoryIds: string[] = [];

  /** Sufijo único para respetar las restricciones UNIQUE de name/value. */
  const sufijo = (): string => `${Date.now()}_${++secuencia}`;

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
    // Los tipos se borran antes que las categorías: la FK IncidentType.categoryId lo exige.
    await prismaClient.incidentType.deleteMany({ where: { id: { in: creadosTypeIds } } }).catch(() => {});
    if (typeId) await prismaClient.incidentType.delete({ where: { id: typeId } }).catch(() => {});
    await prismaClient.incidentCategory.deleteMany({ where: { id: { in: creadosCategoryIds } } }).catch(() => {});
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

    it("debe eliminar una categoría sin tipos asociados", async () => {
      const s = sufijo();
      const categoria = await prismaClient.incidentCategory.create({
        data: { name: `Categoría Borrable ${s}`, value: `CAT_DEL_${s}` },
      });
      creadosCategoryIds.push(categoria.id);

      const res = await request(app)
        .delete(`/api/v1/settings/categories/${categoria.id}`)
        .set("user", adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.messages).toEqual(["Success"]);
      expect(res.body.data).toBe(true);

      const enDb = await prismaClient.incidentCategory.findUnique({ where: { id: categoria.id } });
      expect(enDb).toBeNull();
    });

    it("no debe eliminar una categoría con tipos asociados", async () => {
      const s = sufijo();
      const categoria = await prismaClient.incidentCategory.create({
        data: { name: `Categoría Con Tipos ${s}`, value: `CAT_FK_${s}` },
      });
      creadosCategoryIds.push(categoria.id);
      const tipo = await prismaClient.incidentType.create({
        data: { categoryId: categoria.id, name: `Tipo Dependiente ${s}`, value: `TYPE_FK_${s}` },
      });
      creadosTypeIds.push(tipo.id);

      const res = await request(app)
        .delete(`/api/v1/settings/categories/${categoria.id}`)
        .set("user", adminHeader);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
      expect(res.body.messages[0]).toContain("Error de base de datos");

      // La integridad referencial mantiene la categoría en la base.
      const enDb = await prismaClient.incidentCategory.findUnique({ where: { id: categoria.id } });
      expect(enDb).not.toBeNull();
    });

    it("debe responder 404 al eliminar una categoría inexistente", async () => {
      const res = await request(app)
        .delete(`/api/v1/settings/categories/${UUID_INEXISTENTE}`)
        .set("user", adminHeader);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
      expect(res.body.messages[0]).toBe("Registro no encontrado");
    });

    it("debe rechazar con 400 un id de categoría que no es UUID", async () => {
      const res = await request(app)
        .delete("/api/v1/settings/categories/no-es-uuid")
        .set("user", adminHeader);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
      expect(res.body.messages[0]).toBe("Error de validación");
      expect(res.body.messages).toContain("params.id: ID de categoría inválido");
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

    it("debe actualizar un tipo con categoryId, name y value", async () => {
      const s = sufijo();
      const categoriaDestino = await prismaClient.incidentCategory.create({
        data: { name: `Categoría Destino ${s}`, value: `CAT_DEST_${s}` },
      });
      creadosCategoryIds.push(categoriaDestino.id);

      const res = await request(app)
        .put(`/api/v1/settings/types/${typeId}`)
        .set("user", adminHeader)
        .send({ categoryId: categoriaDestino.id, name: `Tipo Editado ${s}`, value: `TYPE_EDIT_${s}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.messages).toEqual(["Success"]);
      expect(res.body.data.id).toBe(typeId);
      expect(res.body.data.categoryId).toBe(categoriaDestino.id);
      expect(res.body.data.name).toBe(`Tipo Editado ${s}`);
      expect(res.body.data.value).toBe(`TYPE_EDIT_${s}`);

      const enDb = await prismaClient.incidentType.findUnique({ where: { id: typeId } });
      expect(enDb?.categoryId).toBe(categoriaDestino.id);
      expect(enDb?.name).toBe(`Tipo Editado ${s}`);
      expect(enDb?.value).toBe(`TYPE_EDIT_${s}`);
    });

    it("debe rechazar la actualización de un tipo con body inválido (400)", async () => {
      const res = await request(app)
        .put(`/api/v1/settings/types/${typeId}`)
        .set("user", adminHeader)
        .send({ name: "" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
      expect(res.body.messages[0]).toBe("Error de validación");
      expect(res.body.messages.some((m: string) => m.startsWith("body.name"))).toBe(true);
    });

    it("debe rechazar con 400 un id de tipo que no es UUID", async () => {
      const res = await request(app)
        .put("/api/v1/settings/types/no-es-uuid")
        .set("user", adminHeader)
        .send({ name: "Tipo Inválido" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
      expect(res.body.messages[0]).toBe("Error de validación");
      expect(res.body.messages).toContain("params.id: ID de tipo inválido");
    });

    it("debe responder 404 al actualizar un tipo inexistente", async () => {
      const res = await request(app)
        .put(`/api/v1/settings/types/${UUID_INEXISTENTE}`)
        .set("user", adminHeader)
        .send({ name: `Tipo Fantasma ${sufijo()}` });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
      expect(res.body.messages[0]).toBe("Registro no encontrado");
    });

    it("debe eliminar un tipo existente", async () => {
      const s = sufijo();
      const tipo = await prismaClient.incidentType.create({
        data: { categoryId, name: `Tipo Borrable ${s}`, value: `TYPE_DEL_${s}` },
      });
      creadosTypeIds.push(tipo.id);

      const res = await request(app)
        .delete(`/api/v1/settings/types/${tipo.id}`)
        .set("user", adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.messages).toEqual(["Success"]);
      expect(res.body.data).toBe(true);

      const enDb = await prismaClient.incidentType.findUnique({ where: { id: tipo.id } });
      expect(enDb).toBeNull();
    });

    it("debe responder 404 al eliminar un tipo inexistente", async () => {
      const res = await request(app)
        .delete(`/api/v1/settings/types/${UUID_INEXISTENTE}`)
        .set("user", adminHeader);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
      expect(res.body.messages[0]).toBe("Registro no encontrado");
    });

    it("debe rechazar con 400 un id de tipo inválido al eliminar", async () => {
      const res = await request(app)
        .delete("/api/v1/settings/types/no-es-uuid")
        .set("user", adminHeader);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
      expect(res.body.messages[0]).toBe("Error de validación");
      expect(res.body.messages).toContain("params.id: ID de tipo inválido");
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
