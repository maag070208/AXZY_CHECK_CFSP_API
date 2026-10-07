import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";

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

describe("Rutas de Zonas (Integración)", () => {
  let createdClientId: string;
  let createdZoneId: string;
  const uniqueName = `Zona de Prueba ${Date.now()}`;

  // Fixtures de la cobertura ampliada (datatable de zonas)
  const zoneSuffix = Date.now();
  let zonesDatatableClientId: string;
  let zonesDatatableZoneIds: string[] = [];
  let zonesDatatableLocationId: string;
  let zonesNoiseClientId: string;
  let zonesNoiseZoneId: string;

  beforeAll(async () => {
    // Crear un cliente directamente en la BD para usar su ID en los tests de zonas
    const client = await prismaClient.client.create({
      data: { name: `Cliente Temp para Zonas ${Date.now()}` }
    });
    createdClientId = client.id;

    // Cliente con dos zonas activas y una ubicación, para el datatable
    const datatableClient = await prismaClient.client.create({
      data: { name: `Cliente DataTable Zonas ${zoneSuffix}` }
    });
    zonesDatatableClientId = datatableClient.id;

    const zoneA = await prismaClient.zone.create({
      data: { name: `Zona DataTable A ${zoneSuffix}`, clientId: zonesDatatableClientId }
    });
    const zoneB = await prismaClient.zone.create({
      data: { name: `Zona DataTable B ${zoneSuffix}`, clientId: zonesDatatableClientId }
    });
    zonesDatatableZoneIds = [zoneA.id, zoneB.id];

    const locationInZoneA = await prismaClient.location.create({
      data: { name: `Punto Zona A ${zoneSuffix}`, clientId: zonesDatatableClientId, zoneId: zoneA.id }
    });
    zonesDatatableLocationId = locationInZoneA.id;

    // Cliente con una zona inactiva: no debe aparecer en el datatable
    const noiseClient = await prismaClient.client.create({
      data: { name: `Cliente Ruido Zonas ${zoneSuffix}` }
    });
    zonesNoiseClientId = noiseClient.id;

    const noiseZone = await prismaClient.zone.create({
      data: { name: `Zona Ruido Inactiva ${zoneSuffix}`, clientId: zonesNoiseClientId, active: false }
    });
    zonesNoiseZoneId = noiseZone.id;
  });

  afterAll(async () => {
    // Limpieza de la cobertura ampliada (primero las FK, luego los clientes)
    if (zonesDatatableLocationId) {
      await prismaClient.location.delete({ where: { id: zonesDatatableLocationId } }).catch(() => {});
    }
    const zonesToDelete = [...zonesDatatableZoneIds, zonesNoiseZoneId].filter((id) => Boolean(id));
    await prismaClient.zone.deleteMany({ where: { id: { in: zonesToDelete } } }).catch(() => {});
    if (zonesNoiseClientId) await prismaClient.client.delete({ where: { id: zonesNoiseClientId } }).catch(() => {});
    if (zonesDatatableClientId) await prismaClient.client.delete({ where: { id: zonesDatatableClientId } }).catch(() => {});

    // Limpieza del cliente
    if (createdClientId) {
      await prismaClient.client.delete({ where: { id: createdClientId } }).catch(() => {});
    }
  });

  describe("POST /api/v1/zones", () => {
    it("debe crear una nueva zona en la BD", async () => {
      const response = await request(app)
        .post("/api/v1/zones")
        .send({ name: uniqueName, clientId: createdClientId });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(uniqueName);
      expect(response.body.data.clientId).toBe(createdClientId);
      
      createdZoneId = response.body.data.id;
    });

    it("debe retornar 400 si falta el clientId", async () => {
      const response = await request(app)
        .post("/api/v1/zones")
        .send({ name: "Nueva Zona" });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/v1/zones/client/:clientId", () => {
    it("debe retornar una lista de zonas para un cliente desde la BD", async () => {
      const response = await request(app).get(`/api/v1/zones/client/${createdClientId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].id).toBe(createdZoneId);
    });

    it("debe retornar 400 por UUID inválido", async () => {
      const response = await request(app).get("/api/v1/zones/client/invalid-id");
      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/v1/zones/:id", () => {
    it("debe actualizar una zona existente en la BD", async () => {
      const response = await request(app)
        .put(`/api/v1/zones/${createdZoneId}`)
        .send({ name: `${uniqueName} Actualizada`, active: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(`${uniqueName} Actualizada`);
      expect(response.body.data.active).toBe(false);
    });
  });

  describe("DELETE /api/v1/zones/:id", () => {
    it("debe eliminar una zona de la BD", async () => {
      const response = await request(app).delete(`/api/v1/zones/${createdZoneId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.softDelete).toBe(true);
    });
  });

  describe("POST /api/v1/zones/datatable", () => {
    it("debe retornar las zonas del cliente con su conteo real de ubicaciones", async () => {
      const response = await request(app)
        .post("/api/v1/zones/datatable")
        .send({ page: 1, limit: 10, filters: { clientId: zonesDatatableClientId } });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(Array.isArray(response.body.data.rows)).toBe(true);
      expect(response.body.data.rows).toHaveLength(2);
      expect(response.body.data.total).toBe(2);

      const returnedIds = response.body.data.rows.map((z: any) => z.id).sort();
      expect(returnedIds).toEqual([...zonesDatatableZoneIds].sort());
      expect(response.body.data.rows.every((z: any) => z.clientId === zonesDatatableClientId)).toBe(true);

      const zoneA = response.body.data.rows.find((z: any) => z.id === zonesDatatableZoneIds[0]);
      expect(zoneA.client.name).toBe(`Cliente DataTable Zonas ${zoneSuffix}`);
      expect(zoneA._count.locations).toBe(1);

      const zoneB = response.body.data.rows.find((z: any) => z.id === zonesDatatableZoneIds[1]);
      expect(zoneB._count.locations).toBe(0);
    });

    it("no debe listar zonas inactivas ni de otros clientes", async () => {
      const response = await request(app)
        .post("/api/v1/zones/datatable")
        .send({ page: 1, limit: 10, filters: { clientId: zonesNoiseClientId } });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rows).toEqual([]);
      expect(response.body.data.total).toBe(0);

      const allZones = await request(app)
        .post("/api/v1/zones/datatable")
        .send({ page: 1, limit: 10, filters: { clientId: zonesDatatableClientId } });
      expect(allZones.body.data.rows.some((z: any) => z.id === zonesNoiseZoneId)).toBe(false);
    });

    it("debe filtrar por nombre con filters.search", async () => {
      const response = await request(app)
        .post("/api/v1/zones/datatable")
        .send({
          page: 1,
          limit: 10,
          filters: { clientId: zonesDatatableClientId, search: `Zona DataTable A ${zoneSuffix}` },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.rows).toHaveLength(1);
      expect(response.body.data.rows[0].id).toBe(zonesDatatableZoneIds[0]);
      expect(response.body.data.total).toBe(1);
    });

    it("debe devolver todas las filas del filtro aunque se envíe limit 1 (la ruta no pagina)", async () => {
      // Comportamiento real del servicio: ignora page/limit y total = filas devueltas.
      const response = await request(app)
        .post("/api/v1/zones/datatable")
        .send({ page: 1, limit: 1, filters: { clientId: zonesDatatableClientId } });

      expect(response.status).toBe(200);
      expect(response.body.data.rows).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.total).toBe(response.body.data.rows.length);
    });

    it("debe retornar 400 si falta page", async () => {
      const response = await request(app)
        .post("/api/v1/zones/datatable")
        .send({ limit: 10 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages[0]).toBe("Error de validación");
      expect(response.body.messages.join(" ")).toContain("page");
    });

    it("debe retornar 400 si limit no es numérico", async () => {
      const response = await request(app)
        .post("/api/v1/zones/datatable")
        .send({ page: 1, limit: "5" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("debe retornar 400 si la dirección de ordenamiento es inválida", async () => {
      const response = await request(app)
        .post("/api/v1/zones/datatable")
        .send({ page: 1, limit: 10, sort: { key: "name", direction: "descendente" } });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages.join(" ")).toContain("Dirección de ordenamiento inválida");
    });
  });
});
