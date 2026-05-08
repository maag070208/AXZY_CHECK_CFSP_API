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

describe("Flujo Crítico E2E: Gestión de Incidencias", () => {
  let adminHeader: string;
  let guardHeader: string;
  let guardId: string;
  let incidentId: string;
  let clientId: string;

  const evidence = [
    "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro__rea_Com_n_6_20260506182750.jpg",
    "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro__rea_Com_n_7_20260506182829.jpg",
    "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro__rea_Com_n_8_20260506182842.jpg",
    "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro__rea_Com_n_9_20260506182907.jpg",
    "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro_Acceso_Principal_20260506181836.jpg",
    "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro_Acceso_Principal_20260506181841.jpg",
    "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/Martin_Amaro_luisp_Vespertino_Martin_Amaro_BAJA_TELCEL_6fe7b481_dbd9_4b5a_8e73_4027c52ab802_20260505035251.mp4",
    "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/Martin_Amaro_luisp_Vespertino_Martin_Amaro_BAJA_TELCEL_8a0f039b_ffc6_48be_aae6_0eefd300bd93_20260505035736.mp4",
  ];

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
        lastName: "E2E Inc",
        username: `a_e2e_inc_${Date.now()}`,
        password: "password123",
        roleId: adminRole!.id,
      },
    });
    adminHeader = JSON.stringify({ id: adminUser.id, role: "ADMIN" });

    // Client
    const client = await prismaClient.client.create({
      data: { name: `Cliente E2E Inc ${Date.now()}` },
    });
    clientId = client.id;

    // Guard user
    const guardUser = await prismaClient.user.create({
      data: {
        name: "Guard",
        lastName: "E2E Inc",
        username: `g_e2e_inc_${Date.now()}`,
        password: "password123",
        roleId: guardRole!.id,
        clientId,
      },
    });
    guardId = guardUser.id;
    guardHeader = JSON.stringify({ id: guardId, role: "GUARD" });
  });

  afterAll(async () => {
    // Delete test items
    if (clientId) {
      await prismaClient.client
        .delete({ where: { id: clientId } })
        .catch(() => {});
    }
  });

  it("Paso 1: Generar incidencia como guardia", async () => {
    const randomMedia = getRandomEvidence(4);
    const response = await request(app)
      .post("/api/v1/incidents")
      .set("user", guardHeader)
      .send({
        title: "Incidencia E2E con Videos",
        description: "Reporte de persona sospechosa",
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

    incidentId = response.body.data.id;
  });

  it("Paso 2: Ver las incidencias en el Datatable (Admin)", async () => {
    const response = await request(app)
      .post("/api/v1/incidents/datatable")
      .set("user", adminHeader)
      .send({
        page: 1,
        limit: 10,
        filters: {},
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const found = response.body.data.rows.find(
      (inc: any) => inc.id === incidentId,
    );
    expect(found).toBeDefined();
    expect(found.title).toBe("Incidencia E2E con Videos");
  });

  it("Paso 3: Aprobar (Resolver) la incidencia (Admin)", async () => {
    const response = await request(app)
      .put(`/api/v1/incidents/${incidentId}/resolve`)
      .set("user", adminHeader)
      .send({});

    if (response.status !== 200) console.log(response.body);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ATTENDED");
  });

  it("Paso 4: Verificar cambio de estatus en DB", async () => {
    const incidentInDb = await prismaClient.incident.findUnique({
      where: { id: incidentId },
    });

    expect(incidentInDb).toBeDefined();
    expect(incidentInDb?.status).toBe("ATTENDED");
  });
});
