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

describe("Rutas de Reportes (Integración Total)", () => {
  let createdClientId: string;
  let createdGuardId: string;
  let adminUserId: string;

  beforeAll(async () => {
    // 1. Crear Cliente
    const clientRes = await request(app)
      .post("/api/v1/clients")
      .set("user", JSON.stringify({ id: "admin" }))
      .send({ name: `Cliente Reportes ${Date.now()}` });
    createdClientId = clientRes.body.data.id;

    // 2. Obtener Role
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });

    // 3. Crear Guardia
    const guardRes = await request(app)
      .post("/api/v1/users")
      .set("user", JSON.stringify({ id: "admin" }))
      .send({
        name: "Guardia",
        lastName: "Reporteador",
        username: `guardia_rep_${Date.now()}`,
        password: "password123",
        roleId: guardRole!.id,
        clientId: createdClientId
      });
    createdGuardId = guardRes.body.data.id;
    
    adminUserId = "admin-id"; // Dummy for mock
  });

  afterAll(async () => {
    if (createdGuardId) await prismaClient.user.delete({ where: { id: createdGuardId } }).catch(() => {});
    if (createdClientId) await prismaClient.client.delete({ where: { id: createdClientId } }).catch(() => {});
  });

  describe("Endpoints de Analítica y Reportes", () => {
    const filters = `startDate=2024-01-01&endDate=2026-12-31&clientId=${createdClientId}`;

    it("debe retornar estadísticas generales de guardias", async () => {
      const response = await request(app)
        .get(`/api/v1/reports/guards/stats?${filters}`)
        .set("user", JSON.stringify({ id: adminUserId }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("totalScans");
    });

    it("debe retornar el top de desempeño de guardias", async () => {
      const response = await request(app)
        .get(`/api/v1/reports/guards/top-performance?${filters}`)
        .set("user", JSON.stringify({ id: adminUserId }));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("debe retornar la distribución de actividad", async () => {
      const response = await request(app)
        .get(`/api/v1/reports/guards/distribution?${filters}`)
        .set("user", JSON.stringify({ id: adminUserId }));

      expect(response.status).toBe(200);
    });

    it("debe retornar el reporte detallado de guardias", async () => {
      const response = await request(app)
        .get(`/api/v1/reports/guards/detail?${filters}`)
        .set("user", JSON.stringify({ id: adminUserId }));

      expect(response.status).toBe(200);
    });

    it("debe retornar el desglose por guardia específico", async () => {
      const response = await request(app)
        .get(`/api/v1/reports/guards/detail-breakdown/${createdGuardId}?${filters}`)
        .set("user", JSON.stringify({ id: adminUserId }));

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty("missedPoints");
    });

    it("debe retornar la comparación de carga de trabajo", async () => {
        const response = await request(app)
          .get(`/api/v1/reports/guards/workload?${filters}`)
          .set("user", JSON.stringify({ id: adminUserId }));
  
        expect(response.status).toBe(200);
      });
  });
});
