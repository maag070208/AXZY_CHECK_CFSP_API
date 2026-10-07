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

describe("Flujo Crítico E2E: Asignaciones", () => {
  let adminHeader: string;
  let guardHeader: string;
  let guardId: string;
  let clientId: string;
  let locationId: string;
  let assignmentId: string;
  let taskId: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });

    const admin = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "E2E Asig",
        username: `a_e2e_asig_${Date.now()}`,
        password: "password123",
        roleId: adminRole!.id,
      },
    });
    adminHeader = JSON.stringify({ id: admin.id, role: ROLE_ADMIN });

    const client = await prismaClient.client.create({
      data: { name: `Cliente E2E Asig ${Date.now()}` },
    });
    clientId = client.id;

    const guard = await prismaClient.user.create({
      data: {
        name: "Guardia",
        lastName: "E2E Asig",
        username: `g_e2e_asig_${Date.now()}`,
        password: "password123",
        roleId: guardRole!.id,
        clientId,
      },
    });
    guardId = guard.id;
    guardHeader = JSON.stringify({ id: guard.id, role: ROLE_GUARD });

    const location = await prismaClient.location.create({
      data: { name: `Punto E2E Asig ${Date.now()}`, clientId },
    });
    locationId = location.id;
  });

  afterAll(async () => {
    if (assignmentId) {
      await prismaClient.assignmentTask.deleteMany({ where: { assignmentId } }).catch(() => {});
      await prismaClient.assignment.delete({ where: { id: assignmentId } }).catch(() => {});
    }
    if (locationId) await prismaClient.location.delete({ where: { id: locationId } }).catch(() => {});
    if (guardId) await prismaClient.user.delete({ where: { id: guardId } }).catch(() => {});
    if (clientId) await prismaClient.client.delete({ where: { id: clientId } }).catch(() => {});
  });

  it("Paso 1: Admin asigna una ronda de tareas al guardia", async () => {
    const res = await request(app)
      .post("/api/v1/assignments")
      .set("user", adminHeader)
      .send({
        guardId,
        locationId,
        notes: "Turno nocturno",
        tasks: [{ description: "Cerrar accesos", reqPhoto: true }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING");
    assignmentId = res.body.data.id;
    taskId = res.body.data.tasks[0].id;
  });

  it("Paso 2: El guardia ve la asignación en su bandeja", async () => {
    const res = await request(app)
      .get("/api/v1/assignments/me")
      .set("user", guardHeader);

    expect(res.status).toBe(200);
    const found = res.body.data.find((a: { id: string }) => a.id === assignmentId);
    expect(found).toBeDefined();
  });

  it("Paso 3: El guardia inicia la asignación (CHECKING)", async () => {
    const res = await request(app)
      .patch(`/api/v1/assignments/${assignmentId}/status`)
      .set("user", guardHeader)
      .send({ status: "CHECKING" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("CHECKING");
  });

  it("Paso 4: El guardia completa la tarea", async () => {
    const res = await request(app)
      .patch(`/api/v1/assignments/tasks/${taskId}/toggle`)
      .set("user", guardHeader)
      .send({});

    expect(res.status).toBe(200);

    const task = await prismaClient.assignmentTask.findUnique({ where: { id: taskId } });
    expect(task!.completed).toBe(true);
  });

  it("Paso 5: El guardia envía la asignación a revisión", async () => {
    const res = await request(app)
      .patch(`/api/v1/assignments/${assignmentId}/status`)
      .set("user", guardHeader)
      .send({ status: "UNDER_REVIEW" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("UNDER_REVIEW");
  });

  it("Paso 6: El admin la marca como revisada", async () => {
    const res = await request(app)
      .patch(`/api/v1/assignments/${assignmentId}/status`)
      .set("user", adminHeader)
      .send({ status: "REVIEWED" });

    expect(res.status).toBe(200);

    const db = await prismaClient.assignment.findUnique({ where: { id: assignmentId } });
    expect(db!.status).toBe("REVIEWED");
  });
});
