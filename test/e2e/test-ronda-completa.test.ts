import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_GUARD, ROLE_ADMIN, ROUND_STATUS_IN_PROGRESS, ROUND_STATUS_COMPLETED } from "@src/core/config/constants";

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

import { getRandomEvidence } from "./test.constants";

describe("Flujo Crítico E2E: Cliente -> Zonas -> Ubicaciones -> Guardias -> Recurrencia -> Ejecución de Ronda", () => {
  let adminHeader: string;
  let guardHeader: string;
  let adminRole: any;
  let guardRole: any;
  
  let clientId: string;
  let zone1Id: string;
  let zone2Id: string;
  let locations: string[] = []; // Store the 10 location IDs
  let guard1Id: string;
  let guard2Id: string;
  let route1Id: string;
  let route2Id: string;
  let roundId: string;

  beforeAll(async () => {
    adminHeader = JSON.stringify({ id: "admin-e2e", role: "ADMIN" });
    adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });
  });

  afterAll(async () => {
    // Cleanup cascade
    if (clientId) {
      await prismaClient.client.delete({ where: { id: clientId } }).catch(() => {});
    }
  });

  it("Paso 1: Dar de alta un cliente", async () => {
    const res = await request(app)
      .post("/api/v1/clients")
      .set("user", adminHeader)
      .send({ name: `Cliente E2E ${Date.now()}` });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    clientId = res.body.data.id;
  });

  it("Paso 2: Dar de alta 2 zonas", async () => {
    const res1 = await request(app)
      .post("/api/v1/zones")
      .set("user", adminHeader)
      .send({ name: "Zona Norte", clientId });
    expect(res1.status).toBe(201);
    zone1Id = res1.body.data.id;

    const res2 = await request(app)
      .post("/api/v1/zones")
      .set("user", adminHeader)
      .send({ name: "Zona Sur", clientId });
    expect(res2.status).toBe(201);
    zone2Id = res2.body.data.id;
  });

  it("Paso 3: Dar de alta 10 ubicaciones", async () => {
    // 5 in Zona Norte, 5 in Zona Sur
    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post("/api/v1/locations")
        .set("user", adminHeader)
        .send({ name: `Punto Norte ${i}`, clientId, zoneId: zone1Id });
      expect(res.status).toBe(201);
      locations.push(res.body.data.id);
    }
    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post("/api/v1/locations")
        .set("user", adminHeader)
        .send({ name: `Punto Sur ${i}`, clientId, zoneId: zone2Id });
      expect(res.status).toBe(201);
      locations.push(res.body.data.id);
    }
    
    expect(locations.length).toBe(10);
  });

  it("Paso 4: Dar de alta 2 guardias a ese cliente", async () => {
    const res1 = await request(app)
      .post("/api/v1/users")
      .set("user", adminHeader)
      .send({
        name: "Guardia",
        lastName: "Alpha",
        username: `g_alpha_${Date.now()}`,
        password: "password123",
        roleId: guardRole!.id,
        clientId
      });
    expect(res1.status).toBe(201);
    guard1Id = res1.body.data.id;

    const res2 = await request(app)
      .post("/api/v1/users")
      .set("user", adminHeader)
      .send({
        name: "Guardia",
        lastName: "Beta",
        username: `g_beta_${Date.now()}`,
        password: "password123",
        roleId: guardRole!.id,
        clientId
      });
    expect(res2.status).toBe(201);
    guard2Id = res2.body.data.id;

    guardHeader = JSON.stringify({ id: guard1Id, role: "GUARD" });
  });

  it("Paso 5: Generar 2 rutas con 5 ubicaciones cada una", async () => {
    // Route 1 -> points 0 to 4 (Zona Norte)
    const route1Payload = {
      title: "Ruta Norte Completa",
      clientId,
      guardIds: [guard1Id, guard2Id],
      locations: locations.slice(0, 5).map((locId, index) => ({
        locationId: locId,
        order: index + 1,
        tasks: [
          { description: "Verificar perímetro", reqPhoto: true },
          { description: "Checar luces", reqPhoto: false }
        ]
      }))
    };
    const res1 = await request(app)
      .post("/api/v1/recurring")
      .set("user", adminHeader)
      .send(route1Payload);
    expect(res1.status).toBe(201);
    route1Id = res1.body.data.id;

    // Route 2 -> points 5 to 9 (Zona Sur)
    const route2Payload = {
      title: "Ruta Sur Completa",
      clientId,
      guardIds: [guard1Id, guard2Id],
      locations: locations.slice(5, 10).map((locId, index) => ({
        locationId: locId,
        order: index + 1,
        tasks: [
          { description: "Revisar candados", reqPhoto: true }
        ]
      }))
    };
    const res2 = await request(app)
      .post("/api/v1/recurring")
      .set("user", adminHeader)
      .send(route2Payload);
    expect(res2.status).toBe(201);
    route2Id = res2.body.data.id;
  });

  it("Paso 6: Iniciar sesión como guardia e iniciar ruta 1", async () => {
    // 1. Iniciar la ruta 1
    const res = await request(app)
      .post("/api/v1/rounds/start")
      .set("user", guardHeader)
      .send({ clientId, recurringConfigurationId: route1Id });
    
    if (res.status !== 200) console.log(res.body);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    roundId = res.body.data.id;
    
    // Verificar que esté en curso
    const checkRes = await request(app)
      .get("/api/v1/rounds/current")
      .set("user", guardHeader);
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.id).toBe(roundId);
    expect(checkRes.body.data.status).toBe(ROUND_STATUS_IN_PROGRESS);
  });

  it("Paso 7: Escanear todos los QRs y subir evidencias", async () => {
    const route1Locations = locations.slice(0, 5);
    
    for (let i = 0; i < route1Locations.length; i++) {
      const locId = route1Locations[i];
      const mediaUrls = getRandomEvidence(5); // 5 photos + 1 video = 6
      
      const res = await request(app)
        .post("/api/v1/kardex")
        .set("user", guardHeader)
        .send({
          userId: guard1Id,
          locationId: locId,
          notes: `Escaneo de punto ${i + 1} de la ruta Norte`,
          media: mediaUrls,
          latitude: 19.4326 + (i * 0.001),
          longitude: -99.1332 + (i * 0.001)
        });
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Pausa de 5 segundos entre escaneos como solicitó el usuario
      if (i < route1Locations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  });

  it("Paso 8: Ver que la ronda se actualice y finalizarla", async () => {
    // Finalizar ronda
    const res = await request(app)
      .put(`/api/v1/rounds/${roundId}/end`)
      .set("user", guardHeader);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(ROUND_STATUS_COMPLETED);
  });

  it("Paso 9: Ver la ronda finalizada y su línea de tiempo", async () => {
    const res = await request(app)
      .get(`/api/v1/rounds/${roundId}`)
      .set("user", adminHeader);
      
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.round.status).toBe(ROUND_STATUS_COMPLETED);
    
    // Debe tener el START, 5 SCANS y el END = 7 eventos en timeline
    expect(res.body.data.timeline.length).toBeGreaterThanOrEqual(7);
    
    // Verify photos are in the timeline
    const scanEvents = res.body.data.timeline.filter((e: any) => e.type === "SCAN");
    expect(scanEvents.length).toBe(5);
    expect(scanEvents[0].data.media.length).toBe(6); // 5 photos + 1 video
  });
});
