import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_GUARD } from "@src/core/config/constants";

jest.mock("@src/modules/common/middlewares/auth.middleware", () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers["user"]) {
      req.user = JSON.parse(req.headers["user"]);
    }
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next(),
}));

jest.mock("@src/core/middlewares/token-validator.middleware", () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    if (req.headers["user"]) {
      req.user = JSON.parse(req.headers["user"]);
    }
    next();
  },
}));

describe("Rutas de Kardex (Integración Total)", () => {
  let createdClientId: string;
  let createdZoneId: string;
  let createdLocationId: string;
  let createdGuardId: string;
  let createdKardexId: string;

  beforeAll(async () => {
    // 1. Crear Cliente
    const clientRes = await request(app)
      .post("/api/v1/clients")
      .send({ name: `Cliente Kardex ${Date.now()}` });
    createdClientId = clientRes.body.data.id;

    // 2. Crear Zona
    const zoneRes = await request(app)
      .post("/api/v1/zones")
      .send({ name: "Zona A", clientId: createdClientId });
    createdZoneId = zoneRes.body.data.id;

    // 3. Crear Ubicación
    const locRes = await request(app)
      .post("/api/v1/locations")
      .send({ name: "Punto 1", clientId: createdClientId, zoneId: createdZoneId });
    createdLocationId = locRes.body.data.id;

    // 4. Obtener Role
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });

    // 5. Crear Guardia
    const guardRes = await request(app)
      .post("/api/v1/users")
      .send({
        name: "Guardia",
        lastName: "Kardex",
        username: `guardia_kardex_${Date.now()}`,
        password: "password123",
        roleId: guardRole!.id,
        clientId: createdClientId
      });
    createdGuardId = guardRes.body.data.id;
  });

  afterAll(async () => {
    if (createdKardexId) await prismaClient.kardex.delete({ where: { id: createdKardexId } }).catch(() => {});
    if (createdGuardId) await prismaClient.user.delete({ where: { id: createdGuardId } }).catch(() => {});
    if (createdLocationId) await prismaClient.location.delete({ where: { id: createdLocationId } }).catch(() => {});
    if (createdZoneId) await prismaClient.zone.delete({ where: { id: createdZoneId } }).catch(() => {});
    if (createdClientId) await prismaClient.client.delete({ where: { id: createdClientId } }).catch(() => {});
  });

  describe("Operaciones de Bitácora (Kardex)", () => {
    it("debe registrar una nueva entrada (Check-in)", async () => {
      const response = await request(app)
        .post("/api/v1/kardex")
        .send({
          userId: createdGuardId,
          locationId: createdLocationId,
          notes: "Escaneo de prueba",
          latitude: 19.4326,
          longitude: -99.1332
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.scanType).toBe("FREE"); // Sin ronda activa es FREE
      createdKardexId = response.body.data.id;
    });

    it("debe permitir consultar el detalle de la entrada", async () => {
      const response = await request(app).get(`/api/v1/kardex/${createdKardexId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.notes).toBe("Escaneo de prueba");
      expect(response.body.data.user.id).toBe(createdGuardId);
      expect(response.body.data.location.id).toBe(createdLocationId);
    });

    it("debe permitir actualizar las notas de una entrada", async () => {
      const response = await request(app)
        .patch(`/api/v1/kardex/${createdKardexId}`)
        .send({ notes: "Notas actualizadas" });

      expect(response.status).toBe(200);
      expect(response.body.data.notes).toBe("Notas actualizadas");
    });

    it("debe filtrar entradas en el datatable por cliente", async () => {
      const response = await request(app)
        .post("/api/v1/kardex/datatable")
        .send({
          filters: { clientId: createdClientId }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.data.some((e: any) => e.id === createdKardexId)).toBe(true);
    });

    it("debe filtrar entradas en el datatable por búsqueda (usuario)", async () => {
      const response = await request(app)
        .post("/api/v1/kardex/datatable")
        .send({
          filters: { search: "Kardex" } // Por el apellido "Incidencias" (lastName)
        });

      expect(response.status).toBe(200);
      expect(response.body.data.data.length).toBeGreaterThan(0);
      expect(response.body.data.data[0].user.lastName).toContain("Kardex");
    });

    it("debe eliminar una entrada correctamente", async () => {
        const response = await request(app).delete(`/api/v1/kardex/${createdKardexId}`);
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        const check = await prismaClient.kardex.findUnique({ where: { id: createdKardexId } });
        expect(check).toBeNull();
        createdKardexId = ""; // Ya se borró
    });
  });
});
