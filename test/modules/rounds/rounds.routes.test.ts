import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_CLIENT, ROLE_GUARD, ROLE_ADMIN } from "@src/core/config/constants";
import { StorageService } from "@src/modules/storage/storage.service";

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

describe("Rutas de Historial de Rondas (Integración Total)", () => {
  const RONDA_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
  let createdClientId: string;
  let createdGuardId: string;
  let createdLocationId: string;
  let createdRoundId: string;
  let rondaEliminableId: string;

  beforeAll(async () => {
    const adminHeader = JSON.stringify({ id: "admin", role: "ADMIN" });

    // 1. Crear Cliente
    const clientRes = await request(app)
      .post("/api/v1/clients")
      .set("user", adminHeader)
      .send({ name: `Cliente Historial ${Date.now()}` });
    createdClientId = clientRes.body.data.id;

    // 2. Crear Ubicación
    const locRes = await request(app)
      .post("/api/v1/locations")
      .set("user", adminHeader)
      .send({ name: "Punto A", clientId: createdClientId });
    createdLocationId = locRes.body.data.id;

    // 3. Obtener Role
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });

    // 4. Crear Guardia
    const guardRes = await request(app)
      .post("/api/v1/users")
      .set("user", adminHeader)
      .send({
        name: "Guardia",
        lastName: "Historial",
        username: `guardia_hist_${Date.now()}`,
        password: "password123",
        roleId: guardRole!.id,
        clientId: createdClientId
      });
    createdGuardId = guardRes.body.data.id;
  });

  afterAll(async () => {
    if (rondaEliminableId) await prismaClient.round.delete({ where: { id: rondaEliminableId } }).catch(() => {});
    if (createdRoundId) await prismaClient.round.delete({ where: { id: createdRoundId } }).catch(() => {});
    if (createdGuardId) await prismaClient.user.delete({ where: { id: createdGuardId } }).catch(() => {});
    if (createdLocationId) await prismaClient.location.delete({ where: { id: createdLocationId } }).catch(() => {});
    if (createdClientId) await prismaClient.client.delete({ where: { id: createdClientId } }).catch(() => {});
  });

  describe("Ciclo de Vida de una Ronda", () => {
    it("debe iniciar una ronda correctamente", async () => {
      const response = await request(app)
        .post("/api/v1/rounds/start")
        .set("user", JSON.stringify({ id: createdGuardId }))
        .send({
          clientId: createdClientId
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("IN_PROGRESS");
      createdRoundId = response.body.data.id;
    });

    it("debe permitir al guardia registrar actividad en la ronda", async () => {
      const response = await request(app)
        .post("/api/v1/kardex")
        .set("user", JSON.stringify({ id: createdGuardId }))
        .send({
          userId: createdGuardId,
          locationId: createdLocationId,
          notes: "Punto verificado durante ronda"
        });

      expect(response.status).toBe(201);
    });

    it("debe finalizar la ronda", async () => {
      const response = await request(app)
        .put(`/api/v1/rounds/${createdRoundId}/end`)
        .set("user", JSON.stringify({ id: createdGuardId, role: "GUARD" }));
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("COMPLETED");
    });

    it("debe aparecer en el datatable con filtros", async () => {
      const response = await request(app)
        .post("/api/v1/rounds/datatable")
        .send({
          page: 1,
          limit: 10,
          filters: { 
            client: createdClientId,
            status: "COMPLETED",
            search: "Historial" // Por el apellido del guardia
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.rows.some((r: any) => r.id === createdRoundId)).toBe(true);
    });

    it("debe mostrar el detalle completo con la línea de tiempo", async () => {
      const response = await request(app)
        .get(`/api/v1/rounds/${createdRoundId}`)
        .set("user", JSON.stringify({ id: createdGuardId, role: "GUARD" }));

      expect(response.status).toBe(200);
      expect(response.body.data.round.id).toBe(createdRoundId);
      expect(response.body.data.timeline.length).toBeGreaterThanOrEqual(1);
    });

    it("debe generar el reporte en PDF de la ronda", async () => {
      const response = await request(app)
        .get(`/api/v1/rounds/${createdRoundId}/report`)
        .set("user", JSON.stringify({ id: createdGuardId, role: "GUARD" }));
      
      expect(response.status).toBe(200);
      expect(response.header["content-type"]).toContain("application/pdf");
    });
  });

  describe("Enlace temporal para compartir el PDF de la ronda", () => {
    let spySubida: jest.SpyInstance;
    let spyFirma: jest.SpyInstance;

    beforeEach(() => {
      // S3 es un almacenamiento externo: se aísla el límite de almacenamiento
      // (Prisma NO se mockea, la ronda se lee de la base real).
      spySubida = jest
        .spyOn(StorageService.prototype, "uploadBuffer")
        .mockResolvedValue({ bucket: "bucket-de-pruebas", key: "reports/ronda.pdf" });
      spyFirma = jest
        .spyOn(StorageService.prototype, "getSignedReadUrl")
        .mockResolvedValue("https://cdn.de-pruebas.test/reports/ronda.pdf?firma=temporal");
    });

    it("debe responder 200 con el enlace firmado de la ronda existente", async () => {
      const response = await request(app)
        .get(`/api/v1/rounds/${createdRoundId}/share`)
        .set("user", JSON.stringify({ id: createdGuardId, role: ROLE_GUARD }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(typeof response.body.data).toBe("string");
      expect(response.body.data).toContain("https://");

      // El PDF se sube como application/pdf y la firma dura 24 horas (86400 s).
      expect(spySubida).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.any(String),
        expect.stringContaining(`round_${createdRoundId}`),
        "application/pdf"
      );
      expect(spyFirma).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(`round_${createdRoundId}`),
        86400
      );
    });

    it("debe responder 400 cuando el id no es un UUID válido", async () => {
      const response = await request(app)
        .get("/api/v1/rounds/no-es-un-uuid/share")
        .set("user", JSON.stringify({ id: createdGuardId, role: ROLE_GUARD }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages[0]).toBe("Error de validación");
      expect(response.body.messages.join(" | ")).toContain("Invalid UUID");
      expect(spySubida).not.toHaveBeenCalled();
    });

    it("debe responder 404 ante una ronda inexistente al pedir el enlace para compartir", async () => {
      const response = await request(app)
        .get(`/api/v1/rounds/${RONDA_INEXISTENTE}/share`)
        .set("user", JSON.stringify({ id: createdGuardId, role: ROLE_GUARD }));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toEqual(["Ronda no encontrada"]);
      // No debe subirse ningún archivo a S3 cuando la ronda no existe.
      expect(spySubida).not.toHaveBeenCalled();
    });
  });

  describe("Eliminación de rondas", () => {
    const headerGuardia = () =>
      JSON.stringify({ id: createdGuardId, role: ROLE_GUARD, clientId: createdClientId });
    const headerAdmin = () => JSON.stringify({ id: "admin-rondas", role: ROLE_ADMIN });

    beforeAll(async () => {
      // Ronda dedicada para el borrado (la ronda del bloque anterior se conserva viva).
      const response = await request(app)
        .post("/api/v1/rounds/start")
        .set("user", headerGuardia())
        .send({ clientId: createdClientId });

      rondaEliminableId = response.body.data.id;
    });

    it("debe responder 400 cuando el id no es un UUID válido", async () => {
      const response = await request(app)
        .delete("/api/v1/rounds/no-es-un-uuid")
        .set("user", headerAdmin());

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages[0]).toBe("Error de validación");
      expect(response.body.messages.join(" | ")).toContain("Invalid UUID");
    });

    it("debe responder 404 cuando la ronda no existe", async () => {
      const response = await request(app)
        .delete(`/api/v1/rounds/${RONDA_INEXISTENTE}`)
        .set("user", headerAdmin());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toEqual(["Ronda no encontrada"]);
    });

    it("debe responder 403 cuando el usuario es de tipo cliente", async () => {
      const response = await request(app)
        .delete(`/api/v1/rounds/${rondaEliminableId}`)
        .set("user", JSON.stringify({ id: "usuario-cliente", role: ROLE_CLIENT, clientId: createdClientId }));

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toEqual(["No tienes permiso para eliminar rondas"]);

      // La ronda sigue vigente en la base de datos.
      const efectoDb = await prismaClient.round.findFirst({ where: { id: rondaEliminableId } });
      expect(efectoDb).not.toBeNull();
      expect(efectoDb!.deletedAt).toBeNull();
    });

    it("debe eliminar la ronda y reflejarlo en la base de datos", async () => {
      const response = await request(app)
        .delete(`/api/v1/rounds/${rondaEliminableId}`)
        .set("user", headerAdmin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(response.body.data).toBe(true);

      // Baja lógica: la fila permanece con deletedAt y deja de ser visible por la API.
      const efectoDb = await prismaClient.round.findFirst({ where: { id: rondaEliminableId } });
      expect(efectoDb).not.toBeNull();
      expect(efectoDb!.deletedAt).not.toBeNull();

      const detalle = await request(app)
        .get(`/api/v1/rounds/${rondaEliminableId}`)
        .set("user", headerAdmin());
      expect(detalle.status).toBe(404);
      expect(detalle.body.success).toBe(false);
      expect(detalle.body.messages).toEqual(["Ronda no encontrada"]);
    });

    it("debe responder 404 al eliminar una ronda ya eliminada", async () => {
      const response = await request(app)
        .delete(`/api/v1/rounds/${rondaEliminableId}`)
        .set("user", headerAdmin());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.messages).toEqual(["Ronda no encontrada"]);
    });
  });
});
