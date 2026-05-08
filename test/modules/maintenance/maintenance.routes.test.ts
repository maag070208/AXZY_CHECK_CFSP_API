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
  sendMaintenanceEmail: jest.fn(),
  sendMaintenanceWhatsApp: jest.fn(),
}));

describe("Rutas de Mantenimiento (Integración Total)", () => {
  let createdClientId: string;
  let createdGuardId: string;
  let createdAdminId: string;
  let createdCategoryId: string;
  let createdTypeId: string;
  let createdMaintenanceId: string;

  beforeAll(async () => {
    const adminHeader = JSON.stringify({ id: "admin", role: "ADMIN" });

    // 1. Crear Cliente
    const clientRes = await request(app)
      .post("/api/v1/clients")
      .set("user", adminHeader)
      .send({ name: `Cliente para Mantenimiento ${Date.now()}` });
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
        lastName: "Mantenimiento",
        username: `guardia_maint_${Date.now()}`,
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
        lastName: "Mantenimiento",
        username: `admin_maint_${Date.now()}`,
        password: "password123",
        roleId: adminRole!.id
      });
    createdAdminId = adminRes.body.data.id;

    // 5. Configurar Categoría de Mantenimiento (vía Settings)
    const catRes = await request(app)
      .post("/api/v1/settings/categories")
      .set("user", adminHeader)
      .send({
        name: `Mantenimiento Eléctrico ${Date.now()}`,
        value: "ELECTRIC",
        type: "MAINTENANCE",
        color: "#ffa500",
        icon: "flash"
      });
    createdCategoryId = catRes.body.data.id;

    // 6. Configurar Tipo de Mantenimiento
    const typeRes = await request(app)
      .post("/api/v1/settings/types")
      .set("user", adminHeader)
      .send({
        categoryId: createdCategoryId,
        name: `Cambio de Foco ${Date.now()}`,
        value: "CAMBIO_FOCO"
      });
    createdTypeId = typeRes.body.data.id;
  });

  afterAll(async () => {
    // Limpieza
    if (createdMaintenanceId) await prismaClient.maintenance.delete({ where: { id: createdMaintenanceId } }).catch(() => {});
    if (createdTypeId) await prismaClient.incidentType.delete({ where: { id: createdTypeId } }).catch(() => {});
    if (createdCategoryId) await prismaClient.incidentCategory.delete({ where: { id: createdCategoryId } }).catch(() => {});
    if (createdGuardId) await prismaClient.user.delete({ where: { id: createdGuardId } }).catch(() => {});
    if (createdAdminId) await prismaClient.user.delete({ where: { id: createdAdminId } }).catch(() => {});
    if (createdClientId) await prismaClient.client.delete({ where: { id: createdClientId } }).catch(() => {});
  });

  describe("Flujo Operativo de Mantenimiento", () => {
    it("debe permitir a un guardia reportar una solicitud de mantenimiento", async () => {
      const response = await request(app)
        .post("/api/v1/maintenance")
        .set("user", JSON.stringify({ id: createdGuardId }))
        .send({
          title: "Falla en luminaria pasillo 3",
          categoryId: createdCategoryId,
          typeId: createdTypeId,
          description: "El foco parpadea constantemente",
          latitude: 19.4326,
          longitude: -99.1332,
          clientId: createdClientId
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("PENDING");
      createdMaintenanceId = response.body.data.id;
    });

    it("debe permitir al admin ver el mantenimiento en el datatable", async () => {
      const response = await request(app)
        .post("/api/v1/maintenance/datatable")
        .send({
          filters: { search: "luminaria" }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.rows.some((r: any) => r.id === createdMaintenanceId)).toBe(true);
      expect(response.body.data.rows[0].categoryRel.id).toBe(createdCategoryId);
    });

    it("debe permitir al admin resolver el mantenimiento", async () => {
      const response = await request(app)
        .put(`/api/v1/maintenance/${createdMaintenanceId}/resolve`)
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("ATTENDED");
      expect(response.body.data.resolvedById).toBe(createdAdminId);
    });

    it("debe reflejar el cambio de estado en la consulta general", async () => {
        const response = await request(app).get("/api/v1/maintenance");
        
        expect(response.status).toBe(200);
        const maint = response.body.data.find((m: any) => m.id === createdMaintenanceId);
        expect(maint.status).toBe("ATTENDED");
    });
  });
});
