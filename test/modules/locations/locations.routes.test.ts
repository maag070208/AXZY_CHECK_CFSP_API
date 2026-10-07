import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_GUARD } from "@src/core/config/constants";

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

describe("Rutas de Ubicaciones (Integración)", () => {
  let createdClientId: string;
  let createdZoneId: string;
  let createdLocationId: string;
  const uniqueName = `Ubicación de Prueba ${Date.now()}`;

  // Fixtures de la cobertura ampliada (by-guard / datatable / print-qrs)
  const uniqueSuffix = Date.now();
  let guardWithLocationsId: string;
  let guardWithLocationsClientId: string;
  let guardWithoutLocationsId: string;
  let guardWithoutLocationsClientId: string;
  let guardLocationIds: string[] = [];
  let noiseClientId: string;
  let noiseLocationId: string;
  let datatableClientId: string;
  let datatableLocationIds: string[] = [];

  beforeAll(async () => {
    // Crear dependencias
    const client = await prismaClient.client.create({
      data: { name: `Cliente Temp para Ubic ${Date.now()}` }
    });
    createdClientId = client.id;

    const zone = await prismaClient.zone.create({
      data: { name: `Zona Temp para Ubic ${Date.now()}`, clientId: createdClientId }
    });
    createdZoneId = zone.id;

    // Guardia con ubicaciones propias (cliente dedicado, aislado del resto de la suite)
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });

    const guardClient = await prismaClient.client.create({
      data: { name: `Cliente Guardia ${uniqueSuffix}` }
    });
    guardWithLocationsClientId = guardClient.id;

    const guardLocationA = await prismaClient.location.create({
      data: { name: `Punto Guardia A ${uniqueSuffix}`, clientId: guardWithLocationsClientId }
    });
    const guardLocationB = await prismaClient.location.create({
      data: { name: `Punto Guardia B ${uniqueSuffix}`, clientId: guardWithLocationsClientId }
    });
    guardLocationIds = [guardLocationA.id, guardLocationB.id];

    const guardUser = await prismaClient.user.create({
      data: {
        name: "Guardia",
        lastName: "Con Ubicaciones",
        username: `guardia_con_ubic_${uniqueSuffix}`,
        password: "hashedpassword",
        roleId: guardRole!.id,
        clientId: guardWithLocationsClientId,
      }
    });
    guardWithLocationsId = guardUser.id;

    // Guardia cuyo cliente no tiene ninguna ubicación
    const emptyClient = await prismaClient.client.create({
      data: { name: `Cliente Sin Ubicaciones ${uniqueSuffix}` }
    });
    guardWithoutLocationsClientId = emptyClient.id;

    const emptyGuardUser = await prismaClient.user.create({
      data: {
        name: "Guardia",
        lastName: "Sin Ubicaciones",
        username: `guardia_sin_ubic_${uniqueSuffix}`,
        password: "hashedpassword",
        roleId: guardRole!.id,
        clientId: guardWithoutLocationsClientId,
      }
    });
    guardWithoutLocationsId = emptyGuardUser.id;

    // Cliente con tres ubicaciones para paginar en /datatable
    const datatableClient = await prismaClient.client.create({
      data: { name: `Cliente DataTable Ubicaciones ${uniqueSuffix}` }
    });
    datatableClientId = datatableClient.id;

    const datatableLocation1 = await prismaClient.location.create({
      data: { name: `Punto DataTable 1 ${uniqueSuffix}`, clientId: datatableClientId }
    });
    const datatableLocation2 = await prismaClient.location.create({
      data: { name: `Punto DataTable 2 ${uniqueSuffix}`, clientId: datatableClientId }
    });
    const datatableLocation3 = await prismaClient.location.create({
      data: { name: `Punto DataTable 3 ${uniqueSuffix}`, clientId: datatableClientId }
    });
    datatableLocationIds = [datatableLocation1.id, datatableLocation2.id, datatableLocation3.id];

    // Ubicación "ruido" de otro cliente: no debe aparecer en el by-guard ni en los filtros
    const noiseClient = await prismaClient.client.create({
      data: { name: `Cliente Ruido Ubicaciones ${uniqueSuffix}` }
    });
    noiseClientId = noiseClient.id;

    const noiseLocation = await prismaClient.location.create({
      data: { name: `Punto Ruido ${uniqueSuffix}`, clientId: noiseClientId }
    });
    noiseLocationId = noiseLocation.id;
  });

  afterAll(async () => {
    // Limpieza de la cobertura ampliada (primero las FK, luego los clientes)
    if (guardWithLocationsId) await prismaClient.user.delete({ where: { id: guardWithLocationsId } }).catch(() => {});
    if (guardWithoutLocationsId) await prismaClient.user.delete({ where: { id: guardWithoutLocationsId } }).catch(() => {});

    const createdLocationIds = [...guardLocationIds, ...datatableLocationIds, noiseLocationId].filter((id) => Boolean(id));
    await prismaClient.location.deleteMany({ where: { id: { in: createdLocationIds } } }).catch(() => {});

    if (noiseClientId) await prismaClient.client.delete({ where: { id: noiseClientId } }).catch(() => {});
    if (datatableClientId) await prismaClient.client.delete({ where: { id: datatableClientId } }).catch(() => {});
    if (guardWithLocationsClientId) await prismaClient.client.delete({ where: { id: guardWithLocationsClientId } }).catch(() => {});
    if (guardWithoutLocationsClientId) await prismaClient.client.delete({ where: { id: guardWithoutLocationsClientId } }).catch(() => {});

    // Limpieza original
    if (createdZoneId) await prismaClient.zone.delete({ where: { id: createdZoneId } }).catch(() => {});
    if (createdClientId) await prismaClient.client.delete({ where: { id: createdClientId } }).catch(() => {});
  });

  describe("POST /api/v1/locations", () => {
    it("debe crear una nueva ubicación en la BD", async () => {
      const response = await request(app)
        .post("/api/v1/locations")
        .send({ name: uniqueName, clientId: createdClientId, zoneId: createdZoneId });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(uniqueName);
      expect(response.body.data.clientId).toBe(createdClientId);
      expect(response.body.data.zoneId).toBe(createdZoneId);
      
      createdLocationId = response.body.data.id;
      expect(createdLocationId).toBeDefined();
    });

    it("debe retornar 400 si falta el clientId", async () => {
      const response = await request(app)
        .post("/api/v1/locations")
        .send({ name: "Nueva Ubicación" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/locations", () => {
    it("debe retornar una lista de ubicaciones desde la BD", async () => {
      const response = await request(app).get("/api/v1/locations");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      const found = response.body.data.find((l: any) => l.id === createdLocationId);
      expect(found).toBeDefined();
    });
  });

  describe("PUT /api/v1/locations/:id", () => {
    it("debe actualizar una ubicación existente en la BD", async () => {
      const response = await request(app)
        .put(`/api/v1/locations/${createdLocationId}`)
        .send({ name: `${uniqueName} Actualizada`, active: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(`${uniqueName} Actualizada`);
      expect(response.body.data.active).toBe(false);
    });
  });

  describe("DELETE /api/v1/locations/:id", () => {
    it("debe eliminar una ubicación de la BD", async () => {
      const response = await request(app).delete(`/api/v1/locations/${createdLocationId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.softDelete).toBe(true);
    });
  });

  describe("GET /api/v1/locations/by-guard/:guardId", () => {
    it("debe retornar exactamente las ubicaciones del cliente del guardia", async () => {
      const response = await request(app)
        .get(`/api/v1/locations/by-guard/${guardWithLocationsId}`)
        .set("user", JSON.stringify({ id: guardWithLocationsId, role: ROLE_GUARD }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(guardLocationIds.length);

      const returnedIds = response.body.data.map((l: any) => l.id).sort();
      expect(returnedIds).toEqual([...guardLocationIds].sort());
      expect(response.body.data.every((l: any) => l.clientId === guardWithLocationsClientId)).toBe(true);
      expect(response.body.data.some((l: any) => l.id === noiseLocationId)).toBe(false);
      expect(response.body.data[0].client.name).toBe(`Cliente Guardia ${uniqueSuffix}`);
    });

    it("debe retornar una lista vacía si el guardia no tiene ubicaciones", async () => {
      const response = await request(app)
        .get(`/api/v1/locations/by-guard/${guardWithoutLocationsId}`)
        .set("user", JSON.stringify({ id: guardWithoutLocationsId, role: ROLE_GUARD }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(response.body.data).toEqual([]);
    });

    it("debe retornar 200 con lista vacía cuando el guardia no existe en la BD", async () => {
      // La ruta no valida el parámetro con Zod: el servicio devuelve [] (no hay 404).
      const response = await request(app)
        .get("/api/v1/locations/by-guard/00000000-0000-4000-8000-000000000000")
        .set("user", JSON.stringify({ id: guardWithLocationsId, role: ROLE_GUARD }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe("POST /api/v1/locations/datatable", () => {
    it("debe retornar rows y total paginados para el cliente filtrado", async () => {
      const response = await request(app)
        .post("/api/v1/locations/datatable")
        .send({ page: 1, limit: 2, filters: { clientId: datatableClientId } });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(Array.isArray(response.body.data.rows)).toBe(true);
      expect(response.body.data.rows).toHaveLength(2);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.rows.every((l: any) => l.clientId === datatableClientId)).toBe(true);

      // El include real trae el cliente, la zona y el conteo de tareas
      expect(response.body.data.rows[0].client.name).toBe(`Cliente DataTable Ubicaciones ${uniqueSuffix}`);
      expect(response.body.data.rows[0]._count.tasks).toBe(0);
    });

    it("debe respetar page para devolver la segunda página", async () => {
      const response = await request(app)
        .post("/api/v1/locations/datatable")
        .send({ page: 2, limit: 2, filters: { clientId: datatableClientId } });

      expect(response.status).toBe(200);
      expect(response.body.data.rows).toHaveLength(1);
      expect(response.body.data.total).toBe(3);
    });

    it("debe ordenar por nombre ascendente cuando se envía sort", async () => {
      const response = await request(app)
        .post("/api/v1/locations/datatable")
        .send({
          page: 1,
          limit: 10,
          filters: { clientId: datatableClientId },
          sort: { key: "name", direction: "asc" },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.rows).toHaveLength(3);
      expect(response.body.data.rows[0].name).toBe(`Punto DataTable 1 ${uniqueSuffix}`);
      expect(response.body.data.rows[2].name).toBe(`Punto DataTable 3 ${uniqueSuffix}`);
    });

    it("debe filtrar por nombre con filters.name", async () => {
      const response = await request(app)
        .post("/api/v1/locations/datatable")
        .send({ page: 1, limit: 10, filters: { name: `Punto DataTable 2 ${uniqueSuffix}` } });

      expect(response.status).toBe(200);
      expect(response.body.data.rows).toHaveLength(1);
      expect(response.body.data.rows[0].id).toBe(datatableLocationIds[1]);
      expect(response.body.data.total).toBe(1);
    });

    it("debe retornar rows vacíos cuando el filtro no coincide con ninguna ubicación", async () => {
      const response = await request(app)
        .post("/api/v1/locations/datatable")
        .send({ page: 1, limit: 10, filters: { name: `NoExiste-${uniqueSuffix}` } });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rows).toEqual([]);
      expect(response.body.data.total).toBe(0);
    });

    it("debe retornar 400 si falta page", async () => {
      const response = await request(app)
        .post("/api/v1/locations/datatable")
        .send({ limit: 10 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages[0]).toBe("Error de validación");
      expect(response.body.messages.join(" ")).toContain("page");
    });

    it("debe retornar 400 si page es menor a 1", async () => {
      const response = await request(app)
        .post("/api/v1/locations/datatable")
        .send({ page: 0, limit: 10 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages.join(" ")).toContain("page debe ser mayor o igual a 1");
    });

    it("debe retornar 400 si limit no es numérico", async () => {
      const response = await request(app)
        .post("/api/v1/locations/datatable")
        .send({ page: 1, limit: "10" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("debe retornar 400 si la dirección de ordenamiento es inválida", async () => {
      const response = await request(app)
        .post("/api/v1/locations/datatable")
        .send({ page: 1, limit: 10, sort: { key: "name", direction: "arriba" } });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages.join(" ")).toContain("Dirección de ordenamiento inválida");
    });
  });

  describe("POST /api/v1/locations/print-qrs", () => {
    it("debe generar un PDF binario no vacío para las ubicaciones indicadas", async () => {
      const response = await request(app)
        .post("/api/v1/locations/print-qrs")
        .send({ ids: datatableLocationIds.slice(0, 2) });

      expect(response.status).toBe(200);
      expect(response.header["content-type"]).toContain("application/pdf");
      expect(response.header["content-disposition"]).toContain("attachment");
      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.subarray(0, 4).toString()).toBe("%PDF");
    });

    it("debe generar un PDF vacío (200) cuando los UUID no existen en la BD", async () => {
      // La ruta no responde 404: genera el PDF aunque no exista ninguna ubicación.
      const response = await request(app)
        .post("/api/v1/locations/print-qrs")
        .send({ ids: ["00000000-0000-4000-8000-000000000000"] });

      expect(response.status).toBe(200);
      expect(response.header["content-type"]).toContain("application/pdf");
      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it("debe retornar 400 si ids está vacío", async () => {
      const response = await request(app)
        .post("/api/v1/locations/print-qrs")
        .send({ ids: [] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages[0]).toBe("Error de validación");
      expect(response.body.messages.join(" ")).toContain("Debes proporcionar al menos un ID");
    });

    it("debe retornar 400 si algún id no es UUID", async () => {
      const response = await request(app)
        .post("/api/v1/locations/print-qrs")
        .send({ ids: ["no-es-un-uuid"] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages.join(" ")).toContain("Cada ID debe ser un UUID válido");
    });

    it("debe retornar 400 si falta el arreglo ids", async () => {
      const response = await request(app)
        .post("/api/v1/locations/print-qrs")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages.join(" ")).toContain("ids");
    });
  });
});
