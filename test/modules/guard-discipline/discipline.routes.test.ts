import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_ADMIN, ROLE_GUARD, ROLE_SHIFT } from "@src/core/config/constants";

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

jest.setTimeout(30000);

describe("Rutas de Incidencias a Guardias (GuardDiscipline)", () => {
  let createdClientId: string;
  let createdGuardId: string;
  let createdAdminId: string;
  let createdShiftId: string;
  let createdCategoryId: string;
  let createdTypeId: string;
  let createdDisciplineId: string;

  beforeAll(async () => {
    const adminHeader = JSON.stringify({ id: "admin", role: "ADMIN" });

    // 1. Crear Cliente
    const clientRes = await request(app)
      .post("/api/v1/clients")
      .set("user", adminHeader)
      .send({ name: `Cliente para Disciplina ${Date.now()}` });
    createdClientId = clientRes.body.data.id;

    // 2. Obtener Roles
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const shiftRole = await prismaClient.role.findUnique({ where: { name: ROLE_SHIFT } });

    // 3. Crear Guardia
    const guardRes = await request(app)
      .post("/api/v1/users")
      .set("user", adminHeader)
      .send({
        name: "Guardia",
        lastName: "Disciplina",
        username: `guardia_disc_${Date.now()}`,
        password: "password123",
        roleId: guardRole!.id,
        clientId: createdClientId,
      });
    createdGuardId = guardRes.body.data.id;

    // 4. Crear Admin
    const adminRes = await request(app)
      .post("/api/v1/users")
      .set("user", adminHeader)
      .send({
        name: "Admin",
        lastName: "Disciplina",
        username: `admin_disc_${Date.now()}`,
        password: "password123",
        roleId: adminRole!.id,
      });
    createdAdminId = adminRes.body.data.id;

    // 5. Crear SHIFT
    const shiftRes = await request(app)
      .post("/api/v1/users")
      .set("user", adminHeader)
      .send({
        name: "Shift",
        lastName: "Disciplina",
        username: `shift_disc_${Date.now()}`,
        password: "password123",
        roleId: shiftRole!.id,
        clientId: createdClientId,
      });
    createdShiftId = shiftRes.body.data.id;
  });

  afterAll(async () => {
    if (createdDisciplineId) {
      await prismaClient.guardDiscipline.delete({ where: { id: createdDisciplineId } }).catch(() => {});
    }
    if (createdTypeId) {
      await prismaClient.incidentType.delete({ where: { id: createdTypeId } }).catch(() => {});
    }
    if (createdCategoryId) {
      await prismaClient.incidentCategory.delete({ where: { id: createdCategoryId } }).catch(() => {});
    }
    if (createdGuardId) await prismaClient.user.delete({ where: { id: createdGuardId } }).catch(() => {});
    if (createdAdminId) await prismaClient.user.delete({ where: { id: createdAdminId } }).catch(() => {});
    if (createdShiftId) await prismaClient.user.delete({ where: { id: createdShiftId } }).catch(() => {});
    if (createdClientId) await prismaClient.client.delete({ where: { id: createdClientId } }).catch(() => {});
  });

  describe("Gestión de Categorías", () => {
    it("debe crear una categoría de disciplina", async () => {
      const res = await request(app)
        .post("/api/v1/guard-discipline/categories")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ name: `Falta ${Date.now()}`, value: "FALTA", color: "#DC2626" });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toContain("Falta");
      createdCategoryId = res.body.data.id;
    });

    it("debe fallar si falta el nombre", async () => {
      const res = await request(app)
        .post("/api/v1/guard-discipline/categories")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ value: "SIN_NOMBRE" });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("debe listar categorías paginadas", async () => {
      const res = await request(app)
        .post("/api/v1/guard-discipline/categories/datatable")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ page: 1, limit: 10 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rows.length).toBeGreaterThanOrEqual(1);
    });

    it("debe actualizar una categoría", async () => {
      const res = await request(app)
        .put(`/api/v1/guard-discipline/categories/${createdCategoryId}`)
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ name: "Falta Grave" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Falta Grave");
    });

    it("debe eliminar una categoría", async () => {
      const newCatRes = await request(app)
        .post("/api/v1/guard-discipline/categories")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ name: `Temp ${Date.now()}`, value: "TEMP" });
      const tempCatId = newCatRes.body.data.id;

      const res = await request(app)
        .delete(`/api/v1/guard-discipline/categories/${tempCatId}`)
        .set("user", JSON.stringify({ id: createdAdminId }));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Gestión de Tipos", () => {
    it("debe crear un tipo de disciplina", async () => {
      const res = await request(app)
        .post("/api/v1/guard-discipline/types")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ categoryId: createdCategoryId, name: `Retardo ${Date.now()}`, value: "RETARDO" });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toContain("Retardo");
      createdTypeId = res.body.data.id;
    });

    it("debe fallar si falta categoryId", async () => {
      const res = await request(app)
        .post("/api/v1/guard-discipline/types")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ name: "Test", value: "TEST" });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("debe listar tipos paginados", async () => {
      const res = await request(app)
        .post("/api/v1/guard-discipline/types/datatable")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ page: 1, limit: 10 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rows.length).toBeGreaterThanOrEqual(1);
    });

    it("debe actualizar un tipo", async () => {
      const res = await request(app)
        .put(`/api/v1/guard-discipline/types/${createdTypeId}`)
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ name: "Retardo Grave" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Retardo Grave");
    });

    it("debe eliminar un tipo", async () => {
      const newTypeRes = await request(app)
        .post("/api/v1/guard-discipline/types")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ categoryId: createdCategoryId, name: `Temp ${Date.now()}`, value: "TEMP_TYPE" });
      const tempTypeId = newTypeRes.body.data.id;

      const res = await request(app)
        .delete(`/api/v1/guard-discipline/types/${tempTypeId}`)
        .set("user", JSON.stringify({ id: createdAdminId }));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Flujo Operativo de Incidencias a Guardias", () => {
    it("debe crear un registro de disciplina", async () => {
      const res = await request(app)
        .post("/api/v1/guard-discipline")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({
          guardId: createdGuardId,
          title: "Retardo injustificado",
          categoryId: createdCategoryId,
          typeId: createdTypeId,
          description: "Llegó 30 minutos tarde sin justificación",
          clientId: createdClientId,
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("PENDING");
      expect(res.body.data.guard.id).toBe(createdGuardId);
      expect(res.body.data.createdBy.id).toBe(createdAdminId);
      createdDisciplineId = res.body.data.id;
    });

    it("debe fallar si guardId no es un guardia operativo", async () => {
      const res = await request(app)
        .post("/api/v1/guard-discipline")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({
          guardId: createdAdminId,
          title: "Test",
          description: "Test",
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.messages[0]).toContain("no es un guardia operativo");
    });

    it("debe fallar si falta el título", async () => {
      const res = await request(app)
        .post("/api/v1/guard-discipline")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ guardId: createdGuardId });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("debe permitir a SHIFT crear disciplina para guardia de su cliente", async () => {
      const res = await request(app)
        .post("/api/v1/guard-discipline")
        .set("user", JSON.stringify({ id: createdShiftId, role: "SHIFT", clientId: createdClientId }))
        .send({
          guardId: createdGuardId,
          title: "Fallo de ronda",
          description: "No completó las rondas programadas",
          clientId: createdClientId,
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // cleanup
      if (res.body.data?.id) {
        await prismaClient.guardDiscipline.delete({ where: { id: res.body.data.id } }).catch(() => {});
      }
    });

    it("debe listar registros en datatable", async () => {
      const res = await request(app)
        .post("/api/v1/guard-discipline/datatable")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ page: 1, limit: 10, filters: { clientId: createdClientId } });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rows.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.rows.some((r: any) => r.id === createdDisciplineId)).toBe(true);
    });

    it("debe resolver un registro de disciplina", async () => {
      const res = await request(app)
        .put(`/api/v1/guard-discipline/${createdDisciplineId}/resolve`)
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ status: "RESOLVED", description: "Se aplicó llamada de atención" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("RESOLVED");
    });

    it("debe desestimar un registro de disciplina", async () => {
      // Create a new record to dismiss
      const newRes = await request(app)
        .post("/api/v1/guard-discipline")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({
          guardId: createdGuardId,
          title: "Prueba desestimación",
          description: "Test",
          clientId: createdClientId,
        });
      const dismissId = newRes.body.data.id;

      const res = await request(app)
        .put(`/api/v1/guard-discipline/${dismissId}/resolve`)
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ status: "DISMISSED" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("DISMISSED");

      await prismaClient.guardDiscipline.delete({ where: { id: dismissId } }).catch(() => {});
    });

    it("debe fallar al resolver con estado inválido", async () => {
      const res = await request(app)
        .put(`/api/v1/guard-discipline/${createdDisciplineId}/resolve`)
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ status: "PENDING" });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("debe eliminar (soft-delete) un registro de disciplina", async () => {
      const newRes = await request(app)
        .post("/api/v1/guard-discipline")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({
          guardId: createdGuardId,
          title: "Prueba borrado",
          description: "Test",
          clientId: createdClientId,
        });
      const deleteId = newRes.body.data.id;

      const res = await request(app)
        .delete(`/api/v1/guard-discipline/${deleteId}`)
        .set("user", JSON.stringify({ id: createdAdminId }));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify soft-deleted
      const deleted = await prismaClient.guardDiscipline.findUnique({ where: { id: deleteId } });
      expect(deleted?.deletedAt).not.toBeNull();
    });

    it("debe filtrar por status en datatable", async () => {
      const res = await request(app)
        .post("/api/v1/guard-discipline/datatable")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ page: 1, limit: 10, filters: { status: "RESOLVED" } });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rows.every((r: any) => r.status === "RESOLVED")).toBe(true);
    });
  });

  describe("Validación de UUID", () => {
    it("debe fallar con UUID inválido en categoría", async () => {
      const res = await request(app)
        .put("/api/v1/guard-discipline/categories/uuid-invalido")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ name: "Test" });
      expect(res.status).toBe(400);
    });

    it("debe fallar con UUID inválido en tipo", async () => {
      const res = await request(app)
        .put("/api/v1/guard-discipline/types/uuid-invalido")
        .set("user", JSON.stringify({ id: createdAdminId }))
        .send({ name: "Test" });
      expect(res.status).toBe(400);
    });
  });
});
