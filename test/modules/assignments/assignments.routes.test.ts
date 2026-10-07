import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_ADMIN, ROLE_GUARD } from "@src/core/config/constants";

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
});
