import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_GUARD } from "@src/core/config/constants";
import { StorageService } from "@src/modules/storage/storage.service";

jest.mock("@src/modules/common/middlewares/auth.middleware", () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers["user"]) {
      req.user = JSON.parse(req.headers["user"]);
    }
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next(),
}));

describe("Rutas de Kardex (Integración Total)", () => {
  let createdClientId: string;
  let createdZoneId: string;
  let createdLocationId: string;
  let createdGuardId: string;
  let createdKardexId: string;

  // Registros propios de la cobertura agregada (listado y borrado de adjuntos).
  let kardexListadoId: string;
  let kardexListadoTimestamp: Date;
  let kardexConMediaId: string;
  let kardexConMediaAjenaId: string;
  let kardexSinMediaId: string;

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
    if (kardexListadoId) await prismaClient.kardex.delete({ where: { id: kardexListadoId } }).catch(() => {});
    if (kardexConMediaId) await prismaClient.kardex.delete({ where: { id: kardexConMediaId } }).catch(() => {});
    if (kardexConMediaAjenaId) await prismaClient.kardex.delete({ where: { id: kardexConMediaAjenaId } }).catch(() => {});
    if (kardexSinMediaId) await prismaClient.kardex.delete({ where: { id: kardexSinMediaId } }).catch(() => {});
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
          page: 1,
          limit: 10,
          filters: { clientId: createdClientId }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.data.some((e: any) => e.id === createdKardexId)).toBe(true);
    });

    it("debe filtrar entradas en el datatable por búsqueda (usuario)", async () => {
      const response = await request(app)
        .post("/api/v1/kardex/datatable")
        .send({
          page: 1,
          limit: 10,
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
        
        // Baja LÓGICA: conserva la "lápida" (`deletedAt`) para propagar el
        // borrado a los dispositivos, pero ya no aparece en el listado.
        const check = await prismaClient.kardex.findUnique({ where: { id: createdKardexId } });
        expect(check?.deletedAt).not.toBeNull();
        const listado = await request(app).get("/api/v1/kardex");
        expect((listado.body.data as Array<{ id: string }>).map((k) => k.id)).not.toContain(createdKardexId);
        createdKardexId = ""; // Ya se borró
    });
  });

  describe("Listado de Bitácora (Kardex) con filtros", () => {
    beforeAll(async () => {
      // Se crea una entrada dedicada (el registro del bloque anterior ya fue eliminado).
      kardexListadoTimestamp = new Date(Date.now() - 300000); // 5 minutos atrás
      const entrada = await prismaClient.kardex.create({
        data: {
          userId: createdGuardId,
          locationId: createdLocationId,
          notes: "Entrada de cobertura para el listado",
          timestamp: kardexListadoTimestamp
        }
      });
      kardexListadoId = entrada.id;
    });

    it("debe listar las entradas con el sobre TResult y orden descendente por fecha", async () => {
      const response = await request(app)
        .get("/api/v1/kardex")
        .set("user", JSON.stringify({ id: createdGuardId, role: ROLE_GUARD }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.some((e: any) => e.id === kardexListadoId)).toBe(true);

      const timestamps = response.body.data.map((e: any) => new Date(e.timestamp).getTime());
      expect([...timestamps].sort((a: number, b: number) => b - a)).toEqual(timestamps);
    });

    it("debe filtrar el listado por usuario", async () => {
      const response = await request(app)
        .get(`/api/v1/kardex?userId=${createdGuardId}`)
        .set("user", JSON.stringify({ id: createdGuardId, role: ROLE_GUARD }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.every((e: any) => e.userId === createdGuardId)).toBe(true);
      expect(response.body.data.some((e: any) => e.id === kardexListadoId)).toBe(true);
    });

    it("debe filtrar el listado por ubicación", async () => {
      const response = await request(app)
        .get(`/api/v1/kardex?locationId=${createdLocationId}`)
        .set("user", JSON.stringify({ id: createdGuardId, role: ROLE_GUARD }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.every((e: any) => e.locationId === createdLocationId)).toBe(true);
    });

    it("debe filtrar el listado por rango de fechas cuando se envían startDate y endDate", async () => {
      const start = new Date(kardexListadoTimestamp.getTime() - 30000).toISOString();
      const end = new Date(kardexListadoTimestamp.getTime() + 30000).toISOString();

      const response = await request(app)
        .get(`/api/v1/kardex?userId=${createdGuardId}&startDate=${start}&endDate=${end}`)
        .set("user", JSON.stringify({ id: createdGuardId, role: ROLE_GUARD }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Solo la entrada creada dentro de la ventana y para ese guardia.
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].id).toBe(kardexListadoId);

      const efectoDb = await prismaClient.kardex.findUnique({ where: { id: kardexListadoId } });
      expect(efectoDb).not.toBeNull();
      expect(efectoDb!.timestamp.getTime()).toBe(kardexListadoTimestamp.getTime());
    });

    it("debe responder 400 cuando el userId no es un UUID válido", async () => {
      const response = await request(app)
        .get("/api/v1/kardex?userId=no-es-un-uuid")
        .set("user", JSON.stringify({ id: createdGuardId, role: ROLE_GUARD }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages[0]).toBe("Error de validación");
      expect(response.body.messages.join(" | ")).toContain("ID de usuario inválido");
    });

    it("debe responder 400 cuando el locationId no es un UUID válido", async () => {
      const response = await request(app)
        .get("/api/v1/kardex?locationId=no-es-un-uuid")
        .set("user", JSON.stringify({ id: createdGuardId, role: ROLE_GUARD }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages[0]).toBe("Error de validación");
      expect(response.body.messages.join(" | ")).toContain("ID de ubicación inválido");
    });
  });

  describe("Borrado del adjunto (media) de una entrada de Kardex", () => {
    const claveMedia = "kardex/adjunto-cobertura.jpg";
    const claveAjena = "kardex/adjunto-de-otra-entrada.jpg";
    let deleteFileSpy: jest.SpyInstance;

    beforeAll(async () => {
      // El borrado en el bucket solo se intenta si hay bucket configurado:
      // se garantiza uno de pruebas para que la rama sea determinista.
      process.env.AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME || "bucket-de-pruebas";

      const conMedia = await prismaClient.kardex.create({
        data: {
          userId: createdGuardId,
          locationId: createdLocationId,
          notes: "Entrada con adjunto a limpiar",
          media: [{ key: claveMedia, url: `https://cdn.de-pruebas.test/${claveMedia}` }]
        }
      });
      kardexConMediaId = conMedia.id;

      const conMediaAjena = await prismaClient.kardex.create({
        data: {
          userId: createdGuardId,
          locationId: createdLocationId,
          notes: "Entrada con un adjunto distinto",
          media: [{ key: claveAjena, url: `https://cdn.de-pruebas.test/${claveAjena}` }]
        }
      });
      kardexConMediaAjenaId = conMediaAjena.id;

      const sinMedia = await prismaClient.kardex.create({
        data: {
          userId: createdGuardId,
          locationId: createdLocationId,
          notes: "Entrada sin adjunto"
        }
      });
      kardexSinMediaId = sinMedia.id;
    });

    beforeEach(() => {
      // S3 es un almacenamiento externo: se aísla el límite de almacenamiento
      // (Prisma NO se mockea, la verificación de la DB es real).
      deleteFileSpy = jest
        .spyOn(StorageService.prototype, "deleteFile")
        .mockResolvedValue(undefined);
    });

    it("debe limpiar el adjunto indicado por key y persistirlo en la base de datos", async () => {
      const response = await request(app)
        .delete(`/api/v1/kardex/${kardexConMediaId}/media?key=${encodeURIComponent(claveMedia)}`)
        .set("user", JSON.stringify({ id: createdGuardId, role: ROLE_GUARD }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(response.body.data).toBe(true);

      const efectoDb = await prismaClient.kardex.findUnique({ where: { id: kardexConMediaId } });
      expect(efectoDb).not.toBeNull();
      expect(efectoDb!.media).toEqual([]);
      expect(deleteFileSpy).toHaveBeenCalledWith(expect.any(String), claveMedia);
    });

    it("debe responder 404 cuando el key no pertenece al media del registro", async () => {
      const response = await request(app)
        .delete(`/api/v1/kardex/${kardexConMediaAjenaId}/media?key=${encodeURIComponent(claveMedia)}`)
        .set("user", JSON.stringify({ id: createdGuardId, role: ROLE_GUARD }));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages.length).toBe(1);
      // No se borra nada del registro ni del bucket cuando el key es ajeno.
      expect(deleteFileSpy).not.toHaveBeenCalled();

      const efectoDb = await prismaClient.kardex.findUnique({ where: { id: kardexConMediaAjenaId } });
      expect(efectoDb!.media).toEqual([{ key: claveAjena, url: `https://cdn.de-pruebas.test/${claveAjena}` }]);
    });

    it("debe responder 400 cuando falta el query key", async () => {
      const response = await request(app)
        .delete(`/api/v1/kardex/${kardexConMediaId}/media`)
        .set("user", JSON.stringify({ id: createdGuardId, role: ROLE_GUARD }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages[0]).toBe("Error de validación");
      expect(response.body.messages.join(" | ")).toContain("query.key");
    });

    it("debe responder 400 cuando el id no es un UUID válido", async () => {
      const response = await request(app)
        .delete(`/api/v1/kardex/no-es-un-uuid/media?key=${encodeURIComponent(claveMedia)}`)
        .set("user", JSON.stringify({ id: createdGuardId, role: ROLE_GUARD }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages[0]).toBe("Error de validación");
      expect(response.body.messages.join(" | ")).toContain("ID de registro inválido");
    });

    it("debe responder 404 cuando la entrada de kardex no existe", async () => {
      const response = await request(app)
        .delete(`/api/v1/kardex/00000000-0000-4000-8000-000000000000/media?key=${encodeURIComponent(claveMedia)}`)
        .set("user", JSON.stringify({ id: createdGuardId, role: ROLE_GUARD }));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toEqual(["Registro o media no encontrada"]);
    });

    it("debe responder 404 cuando la entrada no tiene adjunto", async () => {
      const response = await request(app)
        .delete(`/api/v1/kardex/${kardexSinMediaId}/media?key=${encodeURIComponent(claveMedia)}`)
        .set("user", JSON.stringify({ id: createdGuardId, role: ROLE_GUARD }));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toEqual(["Registro o media no encontrada"]);

      const efectoDb = await prismaClient.kardex.findUnique({ where: { id: kardexSinMediaId } });
      expect(efectoDb!.media).toBeNull();
    });
  });
});
