import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import {
  ROLE_GUARD,
  ROLE_ADMIN,
  INCIDENT_STATUS_PENDING,
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
  sendIncidentEmail: jest.fn(),
  sendIncidentWhatsApp: jest.fn(),
}));

// Se mockea el almacenamiento para NO borrar objetos en el bucket S3 real:
// el controlador invoca StorageService.deleteFile al eliminar un medio.
jest.mock("@src/modules/storage/storage.service", () => ({
  StorageService: jest.fn().mockImplementation(() => ({
    deleteFile: jest.fn().mockResolvedValue(undefined),
    uploadFile: jest.fn(),
    uploadBuffer: jest.fn(),
    getSignedReadUrl: jest.fn(),
  })),
}));

describe("Rutas de Incidencias (Integración Total)", () => {
  let createdClientId: string;
  let createdGuardId: string;
  let createdAdminId: string;
  let createdCategoryId: string;
  let createdTypeId: string;
  let createdIncidentId: string;
  // Incidencias creadas por las suites de conteo/eliminación (se borran en afterAll).
  const idsIncidenciasCreadas: string[] = [];

  /** Crea una incidencia vía API (opcionalmente con media) y registra su id para la limpieza. */
  const crearIncidencia = async (media?: Prisma.InputJsonValue): Promise<string> => {
    const response = await request(app)
      .post("/api/v1/incidents")
      .set("user", JSON.stringify({ id: createdGuardId }))
      .send({
        title: `Incidencia de prueba ${Date.now()}`,
        categoryId: createdCategoryId,
        typeId: createdTypeId,
        clientId: createdClientId,
      });

    expect(response.status).toBe(201);
    const id = response.body.data.id as string;
    idsIncidenciasCreadas.push(id);

    if (media !== undefined) {
      await prismaClient.incident.update({ where: { id }, data: { media } });
    }

    return id;
  };

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
    for (const id of idsIncidenciasCreadas) {
      await prismaClient.incident.delete({ where: { id } }).catch(() => {});
    }
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
          page: 1,
          limit: 10,
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

  describe("GET /api/v1/incidents/pending-count", () => {
    it("debe retornar el conteo de incidencias pendientes coincidiendo con la BD", async () => {
      const antes = await request(app)
        .get("/api/v1/incidents/pending-count")
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(antes.status).toBe(200);
      expect(typeof antes.body.data.count).toBe("number");

      // Al crear una incidencia nueva (PENDING por defecto) el conteo debe subir en 1.
      await crearIncidencia();

      const response = await request(app)
        .get("/api/v1/incidents/pending-count")
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(response.body.data.count).toBe(antes.body.data.count + 1);

      const enBaseDeDatos = await prismaClient.incident.count({
        where: { status: INCIDENT_STATUS_PENDING },
      });
      expect(enBaseDeDatos).toBe(response.body.data.count);
      expect(enBaseDeDatos).toBeGreaterThan(0);
    });
  });

  describe("DELETE /api/v1/incidents/:id", () => {
    it("debe eliminar la incidencia de la base de datos", async () => {
      const id = await crearIncidencia();

      const existente = await prismaClient.incident.findUnique({ where: { id } });
      expect(existente).not.toBeNull();

      const response = await request(app)
        .delete(`/api/v1/incidents/${id}`)
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(response.body.data).toBe(true);

      // Baja LÓGICA: deja de listarse pero conserva la "lápida" (`deletedAt`)
      // para que el borrado se propague a los dispositivos en el pull.
      const trasBorrar = await prismaClient.incident.findUnique({ where: { id } });
      expect(trasBorrar?.deletedAt).not.toBeNull();
      const listado = await request(app)
        .get("/api/v1/incidents")
        .set("user", JSON.stringify({ id: createdAdminId }));
      expect((listado.body.data as Array<{ id: string }>).map((i) => i.id)).not.toContain(id);

    });

    it("debe retornar 404 cuando la incidencia no existe", async () => {
      const idInexistente = randomUUID();

      const response = await request(app)
        .delete(`/api/v1/incidents/${idInexistente}`)
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toContain("Incidencia no encontrada");

      const enBaseDeDatos = await prismaClient.incident.findUnique({ where: { id: idInexistente } });
      expect(enBaseDeDatos).toBeNull();
    });

    it("debe retornar 400 cuando el id no es un UUID válido", async () => {
      const response = await request(app)
        .delete("/api/v1/incidents/no-es-un-uuid")
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages).toContain("Error de validación");
    });
  });

  describe("DELETE /api/v1/incidents/:id/media", () => {
    it("debe eliminar el medio indicado por key y conservar los demás", async () => {
      const keyPrincipal = `foto-principal-${Date.now()}.jpg`;
      const keySecundaria = `foto-secundaria-${Date.now()}.jpg`;

      const id = await crearIncidencia([
        { key: keyPrincipal, url: `https://bucket.s3.us-east-2.amazonaws.com/${keyPrincipal}` },
        { key: keySecundaria, url: `https://bucket.s3.us-east-2.amazonaws.com/${keySecundaria}` },
      ]);

      const response = await request(app)
        .delete(`/api/v1/incidents/${id}/media`)
        .query({ key: keyPrincipal })
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(response.body.data).toBe(true);

      const incidente = await prismaClient.incident.findUnique({ where: { id } });
      const media = (incidente?.media ?? []) as Array<{ key: string; url: string }>;
      expect(media).toHaveLength(1);
      expect(media[0].key).toBe(keySecundaria);
    });

    it("debe eliminar el medio por el nombre de archivo derivado de la url", async () => {
      const url = `https://bucket.s3.us-east-2.amazonaws.com/adjunto-${Date.now()}.mp4`;
      const nombreArchivo = url.split("/").pop() as string;
      const keyConservada = `conservada-${Date.now()}.jpg`;

      const id = await crearIncidencia([
        { url },
        { key: keyConservada, url: `https://bucket.s3.us-east-2.amazonaws.com/${keyConservada}` },
      ]);

      const response = await request(app)
        .delete(`/api/v1/incidents/${id}/media`)
        .query({ key: nombreArchivo })
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBe(true);

      const incidente = await prismaClient.incident.findUnique({ where: { id } });
      const media = (incidente?.media ?? []) as Array<{ key?: string; url?: string }>;
      expect(media).toHaveLength(1);
      expect(media[0].key).toBe(keyConservada);
    });

    it("debe retornar 400 cuando falta el query key y no modificar el media", async () => {
      const keyPrincipal = `sin-query-${Date.now()}.jpg`;
      const id = await crearIncidencia([{ key: keyPrincipal }]);

      const response = await request(app)
        .delete(`/api/v1/incidents/${id}/media`)
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages).toContain("Error de validación");

      const incidente = await prismaClient.incident.findUnique({ where: { id } });
      expect(incidente?.media).toHaveLength(1);
    });

    it("debe retornar 400 cuando el id no es un UUID válido", async () => {
      const response = await request(app)
        .delete("/api/v1/incidents/no-es-un-uuid/media")
        .query({ key: "cualquiera.jpg" })
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages).toContain("Error de validación");
    });

    it("debe retornar 404 cuando la incidencia no existe", async () => {
      const response = await request(app)
        .delete(`/api/v1/incidents/${randomUUID()}/media`)
        .query({ key: "cualquiera.jpg" })
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toContain("Incidencia o media no encontrada");
    });

    it("debe retornar 404 cuando la incidencia existe pero no tiene media", async () => {
      const id = await crearIncidencia();

      const response = await request(app)
        .delete(`/api/v1/incidents/${id}/media`)
        .query({ key: "cualquiera.jpg" })
        .set("user", JSON.stringify({ id: createdAdminId }));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.messages).toContain("Incidencia o media no encontrada");

      const incidente = await prismaClient.incident.findUnique({ where: { id } });
      expect(incidente).not.toBeNull();
      expect(incidente?.media).toBeNull();
    });
  });
});
