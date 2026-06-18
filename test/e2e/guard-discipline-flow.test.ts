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

jest.setTimeout(60000);

describe("E2E: Flujo completo de Incidencias a Guardias", () => {
  let clientId: string;
  let guardId: string;
  let adminId: string;
  let shiftId: string;
  let catId: string;
  let typeId: string;
  let createdIds: string[] = [];

  beforeAll(async () => {
    const adminHeader = JSON.stringify({ id: "admin-e2e", role: "ADMIN" });
    const ts = Date.now();

    // 1. Crear Cliente
    const clientRes = await request(app)
      .post("/api/v1/clients")
      .set("user", adminHeader)
      .send({ name: `Cliente E2E Disciplina ${ts}` });
    clientId = clientRes.body.data.id;

    // 2. Obtener roles
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const shiftRole = await prismaClient.role.findUnique({ where: { name: ROLE_SHIFT } });

    // 3. Crear Guardia
    const guardRes = await request(app)
      .post("/api/v1/users")
      .set("user", adminHeader)
      .send({ name: "Guardia", lastName: "E2E", username: `ge2e_${ts}`, password: "pass123", roleId: guardRole!.id, clientId });
    guardId = guardRes.body.data.id;

    // 4. Crear Admin
    const adminRes = await request(app)
      .post("/api/v1/users")
      .set("user", adminHeader)
      .send({ name: "Admin", lastName: "E2E", username: `ae2e_${ts}`, password: "pass123", roleId: adminRole!.id });
    adminId = adminRes.body.data.id;

    // 5. Crear SHIFT
    const shiftRes = await request(app)
      .post("/api/v1/users")
      .set("user", adminHeader)
      .send({ name: "Shift", lastName: "E2E", username: `se2e_${ts}`, password: "pass123", roleId: shiftRole!.id, clientId });
    shiftId = shiftRes.body.data.id;

    // 6. Crear Categoría de Disciplina
    const catRes = await request(app)
      .post("/api/v1/guard-discipline/categories")
      .set("user", JSON.stringify({ id: adminId }))
      .send({ name: `Conducta ${ts}`, value: "CONDUCTA_E2E", color: "#8B5CF6" });
    catId = catRes.body.data.id;

    // 7. Crear Tipo de Disciplina
    const typeRes = await request(app)
      .post("/api/v1/guard-discipline/types")
      .set("user", JSON.stringify({ id: adminId }))
      .send({ categoryId: catId, name: `Mala Conducta ${ts}`, value: "MALA_CONDUCTA_E2E" });
    typeId = typeRes.body.data.id;
  });

  afterAll(async () => {
    // Cleanup in reverse order
    for (const id of createdIds.reverse()) {
      await prismaClient.guardDiscipline.delete({ where: { id } }).catch(() => {});
    }
    if (typeId) await prismaClient.disciplineType.delete({ where: { id: typeId } }).catch(() => {});
    if (catId) await prismaClient.disciplineCategory.delete({ where: { id: catId } }).catch(() => {});
    if (shiftId) await prismaClient.user.delete({ where: { id: shiftId } }).catch(() => {});
    if (adminId) await prismaClient.user.delete({ where: { id: adminId } }).catch(() => {});
    if (guardId) await prismaClient.user.delete({ where: { id: guardId } }).catch(() => {});
    if (clientId) await prismaClient.client.delete({ where: { id: clientId } }).catch(() => {});
  });

  it("Paso 1: ADMIN crea incidencia a guardia con categoría y tipo", async () => {
    const res = await request(app)
      .post("/api/v1/guard-discipline")
      .set("user", JSON.stringify({ id: adminId }))
      .send({
        guardId,
        title: "Acoso laboral",
        categoryId: catId,
        typeId,
        description: "El guardia fue reportado por acoso verbal a compañeros",
        clientId,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.guardId).toBe(guardId);
    expect(res.body.data.category.id).toBe(catId);
    expect(res.body.data.type.id).toBe(typeId);
    expect(res.body.data.createdBy.id).toBe(adminId);
    expect(res.body.data.clientId).toBe(clientId);
    createdIds.push(res.body.data.id);
  });

  it("Paso 2: SHIFT crea otra incidencia a guardia de su cliente", async () => {
    const res = await request(app)
      .post("/api/v1/guard-discipline")
      .set("user", JSON.stringify({ id: shiftId, role: "SHIFT", clientId }))
      .send({
        guardId,
        title: "Falta de equipo",
        description: "No porta el uniforme reglamentario",
        clientId,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("PENDING");
    createdIds.push(res.body.data.id);
  });

  it("Paso 3: Datatable filtra por cliente", async () => {
    const res = await request(app)
      .post("/api/v1/guard-discipline/datatable")
      .set("user", JSON.stringify({ id: adminId }))
      .send({ page: 1, limit: 10, filters: { clientId } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rows.length).toBe(2);
    expect(res.body.data.rows.every((r: any) => r.id && r.guard && r.createdBy)).toBe(true);
  });

  it("Paso 4: ADMIN resuelve la primera incidencia", async () => {
    const firstId = createdIds[0];
    const res = await request(app)
      .put(`/api/v1/guard-discipline/${firstId}/resolve`)
      .set("user", JSON.stringify({ id: adminId }))
      .send({ status: "RESOLVED", description: "Se dio por concluido con amonestación verbal" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("RESOLVED");
  });

  it("Paso 5: ADMIN desestima la segunda incidencia", async () => {
    const secondId = createdIds[1];
    const res = await request(app)
      .put(`/api/v1/guard-discipline/${secondId}/resolve`)
      .set("user", JSON.stringify({ id: adminId }))
      .send({ status: "DISMISSED", description: "No se encontraron pruebas suficientes" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("DISMISSED");
  });

  it("Paso 6: Admin elimina la primera incidencia (soft-delete)", async () => {
    const firstId = createdIds[0];
    const res = await request(app)
      .delete(`/api/v1/guard-discipline/${firstId}`)
      .set("user", JSON.stringify({ id: adminId }));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("Paso 7: Datatable ya no muestra la incidencia eliminada", async () => {
    const firstId = createdIds[0];
    const res = await request(app)
      .post("/api/v1/guard-discipline/datatable")
      .set("user", JSON.stringify({ id: adminId }))
      .send({ page: 1, limit: 10, filters: { clientId } });

    expect(res.status).toBe(200);
    expect(res.body.data.rows.every((r: any) => r.id !== firstId)).toBe(true);
  });

  it("Paso 8: Resumen - verificar estados finales", async () => {
    const secondId = createdIds[1];
    const res = await request(app)
      .post("/api/v1/guard-discipline/datatable")
      .set("user", JSON.stringify({ id: adminId }))
      .send({ page: 1, limit: 10, filters: { clientId } });

    const remaining = res.body.data.rows;
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(secondId);
    expect(remaining[0].status).toBe("DISMISSED");
  });
});
