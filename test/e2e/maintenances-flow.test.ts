import { ROLE_ADMIN, ROLE_GUARD } from "@src/core/config/constants";
import { prismaClient } from "@src/core/config/database";
import { app } from "@src/index";
import request from "supertest";
import { getRandomEvidence } from "./test.constants";

jest.setTimeout(60000);

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

describe("Flujo Crítico E2E: Gestión de Mantenimientos", () => {
  let adminHeader: string;
  let guardHeader: string;
  let guardId: string;
  let maintenanceId: string;
  let clientId: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({
      where: { name: ROLE_ADMIN },
    });
    const guardRole = await prismaClient.role.findUnique({
      where: { name: ROLE_GUARD },
    });

    // Admin user
    const adminUser = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "E2E Maint",
        username: `a_e2e_maint_${Date.now()}`,
        password: "password123",
        roleId: adminRole!.id,
      },
    });
    adminHeader = JSON.stringify({ id: adminUser.id, role: "ADMIN" });

    // Client
    const client = await prismaClient.client.create({
      data: { name: `Cliente E2E Maint ${Date.now()}` },
    });
    clientId = client.id;

    // Guard user
    const guardUser = await prismaClient.user.create({
      data: {
        name: "Guard",
        lastName: "E2E Maint",
        username: `g_e2e_maint_${Date.now()}`,
        password: "password123",
        roleId: guardRole!.id,
        clientId,
      },
    });
    guardId = guardUser.id;
    guardHeader = JSON.stringify({ id: guardId, role: "GUARD" });
  });

  afterAll(async () => {
    if (clientId) {
      await prismaClient.client
        .delete({ where: { id: clientId } })
        .catch(() => {});
    }
  });

  it("Paso 1: Generar mantenimiento como guardia", async () => {
    const randomMedia = getRandomEvidence(4);
    const response = await request(app)
      .post("/api/v1/maintenance")
      .set("user", guardHeader)
      .send({
        title: "Mantenimiento E2E con Videos",
        description: "Reporte de falla en iluminación",
        media: randomMedia,
        latitude: 19.4326,
        longitude: -99.1332,
        clientId,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
    expect(response.body.data.media).toHaveLength(5); // 4 photos + 1 video
    expect(response.body.data.status).toBe("PENDING");

    maintenanceId = response.body.data.id;
  });

  it("Paso 2: Ver los mantenimientos en el Datatable (Admin)", async () => {
    const response = await request(app)
      .post("/api/v1/maintenance/datatable")
      .set("user", adminHeader)
      .send({
        page: 1,
        limit: 10,
        filters: {},
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const found = response.body.data.rows.find(
      (m: any) => m.id === maintenanceId,
    );
    expect(found).toBeDefined();
    expect(found.title).toBe("Mantenimiento E2E con Videos");
  });

  it("Paso 3: Aprobar (Resolver) el mantenimiento (Admin)", async () => {
    const response = await request(app)
      .put(`/api/v1/maintenance/${maintenanceId}/resolve`)
      .set("user", adminHeader)
      .send({});

    if (response.status !== 200) console.log(response.body);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ATTENDED");
  });

  it("Paso 4: Verificar cambio de estatus en DB", async () => {
    const maintenanceInDb = await prismaClient.maintenance.findUnique({
      where: { id: maintenanceId },
    });

    expect(maintenanceInDb).toBeDefined();
    expect(maintenanceInDb?.status).toBe("ATTENDED");
  });
});
