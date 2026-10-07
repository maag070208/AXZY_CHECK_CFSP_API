import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_ADMIN, ROLE_CLIENT, ROLE_GUARD } from "@src/core/config/constants";

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

describe("Rutas de Asignaciones (Integración)", () => {
  let adminUserId: string;
  let guardUserId: string;
  let clientId: string;
  let locationId: string;
  let assignmentId: string;
  let taskId: string;

  const adminHeader = () => JSON.stringify({ id: adminUserId, role: ROLE_ADMIN });
  const guardHeader = () => JSON.stringify({ id: guardUserId, role: ROLE_GUARD });

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });

    const admin = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "Asig",
        username: `admin_asig_${Date.now()}`,
        password: "hashed",
        roleId: adminRole!.id,
      },
    });
    adminUserId = admin.id;

    const client = await prismaClient.client.create({
      data: { name: `Cliente Asig ${Date.now()}` },
    });
    clientId = client.id;

    const guard = await prismaClient.user.create({
      data: {
        name: "Guardia",
        lastName: "Asig",
        username: `guard_asig_${Date.now()}`,
        password: "hashed",
        roleId: guardRole!.id,
        clientId,
      },
    });
    guardUserId = guard.id;

    const location = await prismaClient.location.create({
      data: { name: `Punto Asig ${Date.now()}`, clientId },
    });
    locationId = location.id;
  });

  afterAll(async () => {
    if (assignmentId) {
      await prismaClient.assignmentTask.deleteMany({ where: { assignmentId } }).catch(() => {});
      await prismaClient.assignment.delete({ where: { id: assignmentId } }).catch(() => {});
    }
    if (locationId) await prismaClient.location.delete({ where: { id: locationId } }).catch(() => {});
    if (guardUserId) await prismaClient.user.delete({ where: { id: guardUserId } }).catch(() => {});
    if (adminUserId) await prismaClient.user.delete({ where: { id: adminUserId } }).catch(() => {});
    if (clientId) await prismaClient.client.delete({ where: { id: clientId } }).catch(() => {});
  });

  describe("POST /api/v1/assignments", () => {
    it("debe crear una asignación con tareas", async () => {
      const res = await request(app)
        .post("/api/v1/assignments")
        .set("user", adminHeader())
        .send({
          guardId: guardUserId,
          locationId,
          notes: "Revisar perímetro",
          tasks: [
            { description: "Verificar puerta principal", reqPhoto: true },
            { description: "Revisar cámara 3", reqPhoto: false },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe("PENDING");
      expect(res.body.data.tasks).toHaveLength(2);
      assignmentId = res.body.data.id;
      taskId = res.body.data.tasks[0].id;
    });

    it("debe rechazar una asignación duplicada activa para el mismo punto", async () => {
      const res = await request(app)
        .post("/api/v1/assignments")
        .set("user", adminHeader())
        .send({ guardId: guardUserId, locationId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("debe rechazar si falta el locationId", async () => {
      const res = await request(app)
        .post("/api/v1/assignments")
        .set("user", adminHeader())
        .send({ guardId: guardUserId });

      expect(res.status).toBe(400);
    });

    it("debe rechazar si el guardia no tiene rol operativo", async () => {
      const res = await request(app)
        .post("/api/v1/assignments")
        .set("user", adminHeader())
        .send({ guardId: adminUserId, locationId });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/assignments/datatable", () => {
    it("debe listar las asignaciones en el datatable", async () => {
      const res = await request(app)
        .post("/api/v1/assignments/datatable")
        .set("user", adminHeader())
        .send({ page: 1, limit: 10, filters: {} });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /api/v1/assignments/me", () => {
    it("debe devolver las asignaciones del guardia autenticado", async () => {
      const res = await request(app)
        .get("/api/v1/assignments/me")
        .set("user", guardHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((a: { id: string }) => a.id === assignmentId);
      expect(found).toBeDefined();
    });
  });

  describe("PATCH /api/v1/assignments/:id/status", () => {
    it("debe actualizar el estado de la asignación", async () => {
      const res = await request(app)
        .patch(`/api/v1/assignments/${assignmentId}/status`)
        .set("user", guardHeader())
        .send({ status: "CHECKING" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("CHECKING");

      const db = await prismaClient.assignment.findUnique({ where: { id: assignmentId } });
      expect(db!.status).toBe("CHECKING");
    });

    it("debe rechazar un estado inválido", async () => {
      const res = await request(app)
        .patch(`/api/v1/assignments/${assignmentId}/status`)
        .set("user", guardHeader())
        .send({ status: "NO_EXISTE" });

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/v1/assignments/tasks/:taskId/toggle", () => {
    it("debe marcar una tarea como completada", async () => {
      const res = await request(app)
        .patch(`/api/v1/assignments/tasks/${taskId}/toggle`)
        .set("user", guardHeader())
        .send({});

      expect(res.status).toBe(200);

      const task = await prismaClient.assignmentTask.findUnique({ where: { id: taskId } });
      expect(task!.completed).toBe(true);
    });
  });

  describe("DELETE /api/v1/assignments/:id", () => {
    it("debe eliminar la asignación", async () => {
      const res = await request(app)
        .delete(`/api/v1/assignments/${assignmentId}`)
        .set("user", adminHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // El borrado es lógico: la fila sigue, con `deletedAt` marcado.
      const db = await prismaClient.assignment.findUnique({ where: { id: assignmentId } });
      expect(db).not.toBeNull();
      expect(db!.deletedAt).not.toBeNull();
      assignmentId = "";
    });
  });

  describe("GET /api/v1/assignments y /api/v1/assignments/all", () => {
    let clienteBId: string;
    let locationBId: string;
    let asignacionAId: string;
    let asignacionBId: string;

    const clienteAHeader = () => JSON.stringify({ id: adminUserId, role: ROLE_CLIENT, clientId });
    const ids = (res: { body: { data: { id: string }[] } }) => res.body.data.map((a) => a.id).sort();

    beforeAll(async () => {
      const clienteB = await prismaClient.client.create({ data: { name: `Cliente B Asig ${Date.now()}` } });
      clienteBId = clienteB.id;

      const locationB = await prismaClient.location.create({
        data: { name: `Punto B Asig ${Date.now()}`, clientId: clienteBId },
      });
      locationBId = locationB.id;

      const asignacionA = await prismaClient.assignment.create({
        data: {
          guardId: guardUserId,
          locationId,
          assignedBy: adminUserId,
          notes: "Asignación del cliente A",
          tasks: { create: [{ description: "Tarea del punto A", reqPhoto: true }] },
        },
      });
      asignacionAId = asignacionA.id;

      const asignacionB = await prismaClient.assignment.create({
        data: {
          guardId: guardUserId,
          locationId: locationBId,
          assignedBy: adminUserId,
          notes: "Asignación del cliente B",
        },
      });
      asignacionBId = asignacionB.id;
    });

    afterAll(async () => {
      const propias = [asignacionAId, asignacionBId];
      await prismaClient.assignmentTask.deleteMany({ where: { assignmentId: { in: propias } } }).catch(() => {});
      await prismaClient.assignment.deleteMany({ where: { id: { in: propias } } }).catch(() => {});
      await prismaClient.location.delete({ where: { id: locationBId } }).catch(() => {});
      await prismaClient.client.delete({ where: { id: clienteBId } }).catch(() => {});
    });

    it("debe listar las asignaciones activas con sus relaciones", async () => {
      const res = await request(app).get("/api/v1/assignments").set("user", adminHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.messages).toEqual(["Success"]);
      expect(Array.isArray(res.body.data)).toBe(true);

      const mia = res.body.data.find((a: { id: string }) => a.id === asignacionAId);
      expect(mia).toBeDefined();
      expect(mia.status).toBe("PENDING");
      expect(mia.guardId).toBe(guardUserId);
      expect(mia.guard.id).toBe(guardUserId);
      expect(mia.location.id).toBe(locationId);
      expect(mia.location.clientId).toBe(clientId);
      expect(mia.assignedBy).toBe(adminUserId);
      expect(mia.notes).toBe("Asignación del cliente A");
      expect(mia.deletedAt).toBeNull();
      expect(mia.tasks).toHaveLength(1);
      expect(mia.tasks[0].description).toBe("Tarea del punto A");
      expect(mia.tasks[0].completed).toBe(false);
      expect(Array.isArray(mia.kardex)).toBe(true);
    });

    it("debe filtrar por guardia, estado e id", async () => {
      const porGuardia = await request(app).get(`/api/v1/assignments?guardId=${guardUserId}`).set("user", adminHeader());
      expect(porGuardia.status).toBe(200);
      expect(porGuardia.body.data.length).toBeGreaterThan(0);
      expect(porGuardia.body.data.every((a: { guardId: string }) => a.guardId === guardUserId)).toBe(true);
      expect(ids(porGuardia)).toEqual(expect.arrayContaining([asignacionAId, asignacionBId]));

      const porEstado = await request(app).get("/api/v1/assignments?status=PENDING").set("user", adminHeader());
      expect(porEstado.status).toBe(200);
      expect(porEstado.body.data.every((a: { status: string }) => a.status === "PENDING")).toBe(true);

      const porId = await request(app).get(`/api/v1/assignments?id=${asignacionAId}`).set("user", adminHeader());
      expect(porId.status).toBe(200);
      expect(porId.body.data).toHaveLength(1);
      expect(porId.body.data[0].id).toBe(asignacionAId);
    });

    it("debe devolver el mismo listado en / y en /all", async () => {
      const raiz = await request(app).get("/api/v1/assignments").set("user", adminHeader());
      const todas = await request(app).get("/api/v1/assignments/all").set("user", adminHeader());

      expect(todas.status).toBe(200);
      expect(todas.body.success).toBe(true);
      expect(todas.body.messages).toEqual(["Success"]);
      expect(ids(todas)).toEqual(ids(raiz));
      expect(ids(todas)).toContain(asignacionAId);
      expect(ids(todas)).toContain(asignacionBId);
    });

    it("debe rechazar un guardId que no es UUID", async () => {
      const res = await request(app).get("/api/v1/assignments?guardId=no-es-uuid").set("user", adminHeader());

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.messages.join(" ")).toContain("query.guardId");
    });

    it("debe rechazar un estado que no existe", async () => {
      const res = await request(app).get("/api/v1/assignments?status=NO_EXISTE").set("user", adminHeader());

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.messages.join(" ")).toContain("query.status");
    });

    it("debe devolver una lista vacía cuando el id no existe (sin 404)", async () => {
      const res = await request(app)
        .get("/api/v1/assignments?id=00000000-0000-0000-0000-000000000000")
        .set("user", adminHeader());

      // La ruta no define 404: un recurso inexistente responde 200 con [].
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it("un usuario cliente sólo ve las asignaciones de sus propias ubicaciones", async () => {
      const admin = await request(app).get("/api/v1/assignments").set("user", adminHeader());
      const res = await request(app).get("/api/v1/assignments").set("user", clienteAHeader());

      // Aislamiento multi-cliente: el alcance se resuelve por la ubicación
      // relacionada (la asignación B pertenece al cliente B).
      expect(res.status).toBe(200);
      expect(ids(res)).not.toContain(asignacionBId);
      expect(res.body.data.length).toBeLessThan(admin.body.data.length);
      // Todas las asignaciones visibles pertenecen al cliente del usuario.
      for (const asignacion of res.body.data as Array<{ location: { clientId: string } }>) {
        expect(asignacion.location.clientId).toBe(clientId);
      }

      const todas = await request(app).get("/api/v1/assignments/all").set("user", clienteAHeader());
      expect(ids(todas)).not.toContain(asignacionBId);
    });
  });
});
