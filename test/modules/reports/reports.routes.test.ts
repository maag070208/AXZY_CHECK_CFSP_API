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

describe("Rutas de Reportes (Integración Total)", () => {
  let createdClientId: string;
  let createdGuardId: string;
  let adminUserId: string;

  beforeAll(async () => {
    // 1. Crear Cliente
    const clientRes = await request(app)
      .post("/api/v1/clients")
      .set("user", JSON.stringify({ id: "admin", role: "ADMIN" }))
      .send({ name: `Cliente Reportes ${Date.now()}` });
    createdClientId = clientRes.body.data.id;

    // 2. Obtener Role
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });

    // 3. Crear Guardia
    const guardRes = await request(app)
      .post("/api/v1/users")
      .set("user", JSON.stringify({ id: "admin", role: "ADMIN" }))
      .send({
        name: "Guardia",
        lastName: "Reporteador",
        username: `guardia_rep_${Date.now()}`,
        password: "password123",
        roleId: guardRole!.id,
        clientId: createdClientId
      });
    createdGuardId = guardRes.body.data.id;
    
    adminUserId = "admin-id";
  });

  afterAll(async () => {
    if (createdGuardId) await prismaClient.user.delete({ where: { id: createdGuardId } }).catch(() => {});
    if (createdClientId) await prismaClient.client.delete({ where: { id: createdClientId } }).catch(() => {});
  });

  describe("Endpoints de Analítica y Reportes", () => {
    const getFilters = () => `startDate=2024-01-01&endDate=2026-12-31&clientId=${createdClientId}`;

    it("debe retornar estadísticas generales de guardias", async () => {
      const response = await request(app)
        .get(`/api/v1/reports/guards/stats?${getFilters()}`)
        .set("user", JSON.stringify({ id: adminUserId, role: "ADMIN", clientId: createdClientId }));

      if (!response.body.success) console.log("DEBUG ERROR:", response.body);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("totalScans");
    });

    it("debe retornar el top de desempeño de guardias", async () => {
      const response = await request(app)
        .get(`/api/v1/reports/guards/top-performance?${getFilters()}`)
        .set("user", JSON.stringify({ id: adminUserId, role: "ADMIN", clientId: createdClientId }));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("debe retornar la distribución de actividad", async () => {
      const response = await request(app)
        .get(`/api/v1/reports/guards/distribution?${getFilters()}`)
        .set("user", JSON.stringify({ id: adminUserId, role: "ADMIN", clientId: createdClientId }));

      expect(response.status).toBe(200);
    });

    it("debe retornar el reporte detallado de guardias", async () => {
      const response = await request(app)
        .get(`/api/v1/reports/guards/detail?${getFilters()}`)
        .set("user", JSON.stringify({ id: adminUserId, role: "ADMIN", clientId: createdClientId }));

      expect(response.status).toBe(200);
    });

    it("debe retornar el desglose por guardia específico", async () => {
      const response = await request(app)
        .get(`/api/v1/reports/guards/detail-breakdown/${createdGuardId}?${getFilters()}`)
        .set("user", JSON.stringify({ id: adminUserId, role: "ADMIN", clientId: createdClientId }));

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty("missedPoints");
    });

    it("debe retornar la comparación de carga de trabajo", async () => {
        const response = await request(app)
          .get(`/api/v1/reports/guards/workload?${getFilters()}`)
          .set("user", JSON.stringify({ id: adminUserId, role: "ADMIN", clientId: createdClientId }));
  
        expect(response.status).toBe(200);
    });

    it("debe generar un reporte administrativo en PDF (Matriz)", async () => {
      const response = await request(app)
        .post(`/api/v1/reports/administrative/matrix/pdf`)
        .set("user", JSON.stringify({ id: adminUserId, role: "ADMIN", clientId: createdClientId }))
        .send({
          recurringConfigurationIds: [],
          startDate: "2024-01-01",
          endDate: "2026-12-31"
        });

      // Incluso si mandamos arreglo vacío, debe generar el PDF vacío correctamente
      expect(response.status).toBe(200);
      expect(response.header['content-type']).toBe('application/pdf');
    });
  });

  describe("Resumen analítico de incidencias", () => {
    const CLIENTE_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
    const headerAdmin = (clientId?: string) =>
      JSON.stringify({ id: adminUserId, role: "ADMIN", clientId: clientId ?? null });

    // Dos incidencias PENDING del mismo día y una ATTENDED del día siguiente.
    // Se fijan a las 18:00 UTC para que el día UTC y el día local (America/Tijuana)
    // coincidan y el rango pedido sea determinista.
    const hoyUtc = new Date();
    const diaA = new Date(Date.UTC(hoyUtc.getUTCFullYear(), hoyUtc.getUTCMonth(), hoyUtc.getUTCDate() - 5, 18, 0, 0));
    const diaB = new Date(diaA.getTime() + 24 * 60 * 60 * 1000);
    const ymdA = diaA.toISOString().slice(0, 10);
    const ymdB = diaB.toISOString().slice(0, 10);
    const rangoDb = {
      gte: new Date(`${ymdA}T00:00:00.000Z`),
      lte: new Date(`${ymdB}T23:59:59.999Z`),
    };

    let categoriaId: string;
    let categoriaNombre: string;
    let incidenciasCreadas: string[] = [];

    beforeAll(async () => {
      const categoria = await prismaClient.incidentCategory.create({
        data: {
          name: `Categoría Reportes ${Date.now()}`,
          value: `CAT_REPORTES_${Date.now()}`,
          type: "INCIDENT",
          color: "#00AAFF",
        },
      });
      categoriaId = categoria.id;
      categoriaNombre = categoria.name;

      const creadas = await Promise.all([
        prismaClient.incident.create({
          data: {
            guardId: createdGuardId,
            clientId: createdClientId,
            categoryId: categoriaId,
            title: "Incidencia de reporte A",
            status: "PENDING",
            createdAt: diaA,
          },
        }),
        prismaClient.incident.create({
          data: {
            guardId: createdGuardId,
            clientId: createdClientId,
            categoryId: categoriaId,
            title: "Incidencia de reporte B",
            status: "PENDING",
            createdAt: diaA,
          },
        }),
        prismaClient.incident.create({
          data: {
            guardId: createdGuardId,
            clientId: createdClientId,
            categoryId: categoriaId,
            title: "Incidencia de reporte C",
            status: "ATTENDED",
            resolvedAt: diaB,
            createdAt: diaB,
          },
        }),
      ]);

      incidenciasCreadas = creadas.map((i) => i.id);
    });

    afterAll(async () => {
      if (incidenciasCreadas.length > 0) {
        await prismaClient.incident
          .deleteMany({ where: { id: { in: incidenciasCreadas } } })
          .catch(() => {});
      }
      if (categoriaId) {
        await prismaClient.incidentCategory.delete({ where: { id: categoriaId } }).catch(() => {});
      }
    });

    it("debe totalizar las incidencias del rango por estado, categoría, guardia y día", async () => {
      const response = await request(app)
        .get(`/api/v1/reports/incidents/summary?startDate=${ymdA}&endDate=${ymdB}&clientId=${createdClientId}`)
        .set("user", headerAdmin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual([]);

      const data = response.body.data;
      expect(data.total).toBe(3);
      expect(data.pending).toBe(2);
      expect(data.attended).toBe(1);
      expect(data.resolutionRate).toBe(33); // Math.round(1 / 3 * 100)
      expect(data.byCategory).toEqual([
        { id: categoriaId, name: categoriaNombre, color: "#00AAFF", count: 3 },
      ]);
      expect(data.byGuard.length).toBe(1);
      expect(data.byGuard[0]).toMatchObject({ id: createdGuardId, count: 3 });
      expect(data.byGuard[0].name).toContain("Reporteador");
      expect(data.byDay).toEqual([
        { date: ymdA, count: 2 },
        { date: ymdB, count: 1 },
      ]);

      // Efecto real en la DB: las incidencias del rango coinciden con el total informado.
      const efectoDb = await prismaClient.incident.count({
        where: { clientId: createdClientId, createdAt: rangoDb },
      });
      expect(efectoDb).toBe(data.total);
    });

    it("debe devolver ceros y arreglos vacíos cuando no hay incidencias en el rango", async () => {
      const response = await request(app)
        .get(`/api/v1/reports/incidents/summary?startDate=2020-01-01&endDate=2020-01-02&clientId=${createdClientId}`)
        .set("user", headerAdmin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual([]);
      expect(response.body.data).toEqual({
        total: 0,
        pending: 0,
        attended: 0,
        resolutionRate: 0,
        byCategory: [],
        byGuard: [],
        byDay: [],
      });
    });

    it("debe devolver ceros cuando el clientId consultado no tiene incidencias", async () => {
      const response = await request(app)
        .get(`/api/v1/reports/incidents/summary?startDate=${ymdA}&endDate=${ymdB}&clientId=${CLIENTE_INEXISTENTE}`)
        .set("user", headerAdmin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(0);
      expect(response.body.data.byCategory).toEqual([]);
    });

    it("debe acotar el resumen al clientId del usuario autenticado cuando el header lo trae", async () => {
      const response = await request(app)
        .get(`/api/v1/reports/incidents/summary?startDate=${ymdA}&endDate=${ymdB}&clientId=${CLIENTE_INEXISTENTE}`)
        .set("user", headerAdmin(createdClientId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // El clientId del usuario tiene prioridad sobre el query.
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.byGuard.length).toBe(1);
      expect(response.body.data.byGuard[0]).toMatchObject({ id: createdGuardId, count: 3 });
    });

    it("debe rechazar con 400 un startDate con formato inválido", async () => {
      const response = await request(app)
        .get(`/api/v1/reports/incidents/summary?startDate=no-es-una-fecha&endDate=no-es-una-fecha&clientId=${createdClientId}`)
        .set("user", headerAdmin());

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toContain("query.startDate: startDate debe tener formato YYYY-MM-DD");
    });
  });
});
