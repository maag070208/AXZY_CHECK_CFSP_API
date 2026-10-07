import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import {
  ROLE_GUARD,
  ROLE_ADMIN,
  MAINTENANCE_STATUS_PENDING,
} from "@src/core/config/constants";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

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
  // Mantenimientos creados por las suites de conteo/eliminación (se borran en afterAll).
  const idsMantenimientosCreados: string[] = [];

  /** Crea un mantenimiento vía API (opcionalmente con media) y registra su id para la limpieza. */
  const crearMantenimiento = async (media?: Prisma.InputJsonValue): Promise<string> => {
    const response = await request(app)
      .post("/api/v1/maintenance")
      .set("user", JSON.stringify({ id: createdGuardId }))
      .send({
        title: `Mantenimiento de prueba ${Date.now()}`,
        categoryId: createdCategoryId,
        typeId: createdTypeId,
        clientId: createdClientId,
      });

    expect(response.status).toBe(201);
    const id = response.body.data.id as string;
    idsMantenimientosCreados.push(id);

    if (media !== undefined) {
      await prismaClient.maintenance.update({ where: { id }, data: { media } });
    }

    return id;
  };

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
    for (const id of idsMantenimientosCreados) {
      await prismaClient.maintenance.delete({ where: { id } }).catch(() => {});
    }
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
          page: 1,
          limit: 10,
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

  describe("GET /api/v1/maintenance/pending-count", () => {
    it("debe retornar el conteo de mantenimientos pendientes coincidiendo con la BD", async () => {
      const antes = await request(app)
        .get("/api/v1/maintenance/pending-count")
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(antes.status).toBe(200);
      expect(typeof antes.body.data.count).toBe("number");

      // Al crear un mantenimiento nuevo (PENDING por defecto) el conteo debe subir en 1.
      await crearMantenimiento();

      const response = await request(app)
        .get("/api/v1/maintenance/pending-count")
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(response.body.data.count).toBe(antes.body.data.count + 1);

      const enBaseDeDatos = await prismaClient.maintenance.count({
        where: { status: MAINTENANCE_STATUS_PENDING },
      });
      expect(enBaseDeDatos).toBe(response.body.data.count);
      expect(enBaseDeDatos).toBeGreaterThan(0);
    });
  });

  describe("DELETE /api/v1/maintenance/:id", () => {
    it("debe eliminar el mantenimiento de la base de datos", async () => {
      const id = await crearMantenimiento();

      const existente = await prismaClient.maintenance.findUnique({ where: { id } });
      expect(existente).not.toBeNull();

      const response = await request(app)
        .delete(`/api/v1/maintenance/${id}`)
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(response.body.data).toBe(true);

      // Baja LÓGICA: deja de listarse pero conserva la "lápida" para propagarse.
      const trasBorrar = await prismaClient.maintenance.findUnique({ where: { id } });
      expect(trasBorrar?.deletedAt).not.toBeNull();
      const listado = await request(app)
        .get("/api/v1/maintenance")
        .set("user", JSON.stringify({ id: createdAdminId }));
      expect((listado.body.data as Array<{ id: string }>).map((m) => m.id)).not.toContain(id);

    });

    it("debe retornar 404 cuando el mantenimiento no existe", async () => {
      const idInexistente = randomUUID();

      const response = await request(app)
        .delete(`/api/v1/maintenance/${idInexistente}`)
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toContain("Mantenimiento no encontrado");

      const enBaseDeDatos = await prismaClient.maintenance.findUnique({ where: { id: idInexistente } });
      expect(enBaseDeDatos).toBeNull();
    });

    it("debe retornar 400 cuando el id no es un UUID válido", async () => {
      const response = await request(app)
        .delete("/api/v1/maintenance/no-es-un-uuid")
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages).toContain("Error de validación");
    });
  });

  describe("DELETE /api/v1/maintenance/:id/media", () => {
    it("debe eliminar el medio indicado por key y conservar los demás", async () => {
      const keyPrincipal = `foto-principal-${Date.now()}.jpg`;
      const keySecundaria = `foto-secundaria-${Date.now()}.jpg`;

      const id = await crearMantenimiento([
        { key: keyPrincipal, url: `https://bucket.s3.us-east-2.amazonaws.com/${keyPrincipal}` },
        { key: keySecundaria, url: `https://bucket.s3.us-east-2.amazonaws.com/${keySecundaria}` },
      ]);

      const response = await request(app)
        .delete(`/api/v1/maintenance/${id}/media`)
        .query({ key: keyPrincipal })
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(response.body.data).toBe(true);

      const mantenimiento = await prismaClient.maintenance.findUnique({ where: { id } });
      const media = (mantenimiento?.media ?? []) as Array<{ key: string; url: string }>;
      expect(media).toHaveLength(1);
      expect(media[0].key).toBe(keySecundaria);
    });

    it("debe eliminar el medio por el nombre de archivo derivado de la url", async () => {
      const url = `https://bucket.s3.us-east-2.amazonaws.com/adjunto-${Date.now()}.mp4`;
      const nombreArchivo = url.split("/").pop() as string;
      const keyConservada = `conservada-${Date.now()}.jpg`;

      const id = await crearMantenimiento([
        { url },
        { key: keyConservada, url: `https://bucket.s3.us-east-2.amazonaws.com/${keyConservada}` },
      ]);

      const response = await request(app)
        .delete(`/api/v1/maintenance/${id}/media`)
        .query({ key: nombreArchivo })
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBe(true);

      const mantenimiento = await prismaClient.maintenance.findUnique({ where: { id } });
      const media = (mantenimiento?.media ?? []) as Array<{ key?: string; url?: string }>;
      expect(media).toHaveLength(1);
      expect(media[0].key).toBe(keyConservada);
    });

    it("debe retornar 400 cuando falta el query key y no modificar el media", async () => {
      const keyPrincipal = `sin-query-${Date.now()}.jpg`;
      const id = await crearMantenimiento([{ key: keyPrincipal }]);

      const response = await request(app)
        .delete(`/api/v1/maintenance/${id}/media`)
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages).toContain("Error de validación");

      const mantenimiento = await prismaClient.maintenance.findUnique({ where: { id } });
      expect(mantenimiento?.media).toHaveLength(1);
    });

    it("debe retornar 400 cuando el id no es un UUID válido", async () => {
      const response = await request(app)
        .delete("/api/v1/maintenance/no-es-un-uuid/media")
        .query({ key: "cualquiera.jpg" })
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages).toContain("Error de validación");
    });

    it("debe retornar 404 cuando el mantenimiento no existe", async () => {
      const response = await request(app)
        .delete(`/api/v1/maintenance/${randomUUID()}/media`)
        .query({ key: "cualquiera.jpg" })
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toContain("Mantenimiento o media no encontrada");
    });

    it("debe retornar 404 cuando el mantenimiento existe pero no tiene media", async () => {
      const id = await crearMantenimiento();

      const response = await request(app)
        .delete(`/api/v1/maintenance/${id}/media`)
        .query({ key: "cualquiera.jpg" })
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.messages).toContain("Mantenimiento o media no encontrada");

      const mantenimiento = await prismaClient.maintenance.findUnique({ where: { id } });
      expect(mantenimiento).not.toBeNull();
      expect(mantenimiento?.media).toBeNull();
    });
  });
});
