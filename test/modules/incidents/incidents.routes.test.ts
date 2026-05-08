import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_GUARD, ROLE_ADMIN } from "@src/core/config/constants";

jest.setTimeout(30000);

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

jest.mock("@src/core/utils/emailSender", () => ({
  sendIncidentEmail: jest.fn(),
  sendIncidentWhatsApp: jest.fn(),
}));

describe("Rutas de Incidencias (Integración Total)", () => {
  let createdClientId: string;
  let createdGuardId: string;
  let createdAdminId: string;
  let createdCategoryId: string;
  let createdTypeId: string;
  let createdIncidentId: string;

  beforeAll(async () => {
    const adminHeader = JSON.stringify({ id: "admin", role: "ADMIN" });

    // 1. Crear Cliente
    const clientRes = await request(app)
      .post("/api/v1/clients")
      .set("user", adminHeader)
      .send({ name: `Cliente para Incidencias ${Date.now()}` });
    createdClientId = clientRes.body.data.id;

    // 2. Obtener Roles
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });

    // 3. Crear Guardia
    const guardRes = await request(app)
      .post("/api/v1/users")
      .set("user", adminHeader)
      .send({
        name: "Guardia",
        lastName: "Incidencias",
        username: `guardia_inc_${Date.now()}`,
        password: "password123",
        roleId: guardRole!.id,
        clientId: createdClientId
      });
    createdGuardId = guardRes.body.data.id;

    // 4. Crear Admin
    const adminRes = await request(app)
      .post("/api/v1/users")
      .set("user", adminHeader)
      .send({
        name: "Admin",
        lastName: "Incidencias",
        username: `admin_inc_${Date.now()}`,
        password: "password123",
        roleId: adminRole!.id
      });
    createdAdminId = adminRes.body.data.id;

    // 5. Configurar Categoría de Incidencia (vía Settings)
    const catRes = await request(app)
      .post("/api/v1/settings/categories")
      .set("user", adminHeader)
      .send({
        name: `Robo ${Date.now()}`,
        value: "ROBO",
        type: "INCIDENT",
        color: "#ff0000",
        icon: "alert"
      });
    createdCategoryId = catRes.body.data.id;

    // 6. Configurar Tipo de Incidencia
    const typeRes = await request(app)
      .post("/api/v1/settings/types")
      .set("user", adminHeader)
      .send({
        categoryId: createdCategoryId,
        name: `Robo a Vehículo ${Date.now()}`,
        value: "ROBO_VEHICULO"
      });
    createdTypeId = typeRes.body.data.id;
  });

  afterAll(async () => {
    // Limpieza
    if (createdIncidentId) await prismaClient.incident.delete({ where: { id: createdIncidentId } }).catch(() => {});
    if (createdTypeId) await prismaClient.incidentType.delete({ where: { id: createdTypeId } }).catch(() => {});
    if (createdCategoryId) await prismaClient.incidentCategory.delete({ where: { id: createdCategoryId } }).catch(() => {});
    if (createdGuardId) await prismaClient.user.delete({ where: { id: createdGuardId } }).catch(() => {});
    if (createdAdminId) await prismaClient.user.delete({ where: { id: createdAdminId } }).catch(() => {});
    if (createdClientId) await prismaClient.client.delete({ where: { id: createdClientId } }).catch(() => {});
  });

  describe("Flujo Operativo de Incidencias", () => {
    it("debe permitir a un guardia reportar una incidencia", async () => {
      const response = await request(app)
        .post("/api/v1/incidents")
        .set("user", JSON.stringify({ id: createdGuardId }))
        .send({
          title: "Intento de robo detectado",
          categoryId: createdCategoryId,
          typeId: createdTypeId,
          description: "Se observó a un sujeto merodeando el estacionamiento",
          latitude: 19.4326,
          longitude: -99.1332,
          clientId: createdClientId
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("PENDING");
      createdIncidentId = response.body.data.id;
    });

    it("debe permitir al admin ver la incidencia en el datatable", async () => {
      const response = await request(app)
        .post("/api/v1/incidents/datatable")
        .send({
          filters: { search: "Intento" }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.rows.some((r: any) => r.id === createdIncidentId)).toBe(true);
      expect(response.body.data.rows[0].category.id).toBe(createdCategoryId);
    });

    it("debe permitir al admin atender/resolver la incidencia", async () => {
      const response = await request(app)
        .put(`/api/v1/incidents/${createdIncidentId}/resolve`)
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("ATTENDED");
      expect(response.body.data.resolvedById).toBe(createdAdminId);
    });

    it("debe reflejar el cambio de estado en la consulta general", async () => {
        const response = await request(app).get("/api/v1/incidents");
        
        expect(response.status).toBe(200);
        const incident = response.body.data.find((i: any) => i.id === createdIncidentId);
        expect(incident.status).toBe("ATTENDED");
    });
  });
});
