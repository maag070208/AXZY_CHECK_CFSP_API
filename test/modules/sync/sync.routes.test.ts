import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";

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

jest.setTimeout(30000);

describe("Rutas de Sincronización (Offline - Sync)", () => {
  let createdClientId: string;

  beforeAll(async () => {
    // 1. Crear Cliente para tener algo que pullear
    const clientRes = await request(app)
      .post("/api/v1/clients")
      .set("user", JSON.stringify({ id: "admin" }))
      .send({ name: `Sync Client ${Date.now()}` });
    createdClientId = clientRes.body.data.id;
  });

  afterAll(async () => {
    if (createdClientId) await prismaClient.client.delete({ where: { id: createdClientId } }).catch(() => {});
    // Limpiar zona creada por push
    await prismaClient.zone.deleteMany({ where: { name: "Push Zone" } }).catch(() => {});
  });

  describe("Operaciones de Pull y Push", () => {
    it("debe fallar si la versión de la aplicación no está provista o es incompatible", async () => {
      const response = await request(app)
        .get("/api/v1/sync")
        .set("user", JSON.stringify({ id: "admin" }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages[0]).toContain("Aplicación desactualizada");

      const response2 = await request(app)
        .get("/api/v1/sync")
        .set("user", JSON.stringify({ id: "admin" }))
        .set("x-app-version", "0.9.0");

      expect(response2.status).toBe(400);
      expect(response2.body.success).toBe(false);
      expect(response2.body.messages[0]).toContain("Aplicación desactualizada");
    });

    it("debe realizar un pull de cambios desde el inicio de los tiempos", async () => {
      const response = await request(app)
        .get("/api/v1/sync")
        .set("user", JSON.stringify({ id: "admin" }))
        .set("x-bypass-version-check", "true");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.changes).toBeDefined();
      expect(response.body.data.changes.client.created.length).toBeGreaterThan(0);
      expect(response.body.data.timestamp).toBeDefined();
    });

    it("debe realizar un pull incremental usando last_pulled_at", async () => {
      const future = Date.now() + 100000; // 100s in the future
      const response = await request(app)
        .get(`/api/v1/sync?last_pulled_at=${future}`)
        .set("user", JSON.stringify({ id: "admin" }))
        .set("x-bypass-version-check", "true");

      expect(response.status).toBe(200);
      // No debería haber cambios nuevos después de una fecha futura
      expect(response.body.data.changes.client.created.length).toBe(0);
    });

    it("debe reportar (y no aplicar) las tablas que el dispositivo no puede modificar", async () => {
      const uniquePushId = crypto.randomUUID();
      const response = await request(app)
        .post("/api/v1/sync")
        .set("user", JSON.stringify({ id: "admin" }))
        .set("x-bypass-version-check", "true")
        .send({
          changes: {
            zone: { created: [{ id: uniquePushId, name: "Push Zone", clientId: createdClientId }], updated: [], deleted: [] },
          },
        });

      // Antes se descartaba en silencio (200). Ahora se informa para que el
      // cambio no se pierda sin que nadie se entere.
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data.ignoredTables).toContain("zone");
      const zone = await prismaClient.zone.findUnique({ where: { id: uniquePushId } as any });
      expect(zone).toBeNull();
    });

    it("debe fallar si el formato del push es inválido", async () => {
      const pushData = {
        changes: "formato-invalido"
      };

      const response = await request(app)
        .post("/api/v1/sync")
        .set("user", JSON.stringify({ id: "admin" }))
        .set("x-bypass-version-check", "true")
        .send(pushData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages).toBeDefined();
    });

    it("debe fallar si last_pulled_at no es un formato numérico", async () => {
      const response = await request(app)
        .get("/api/v1/sync?last_pulled_at=invalido")
        .set("user", JSON.stringify({ id: "admin" }))
        .set("x-bypass-version-check", "true");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages).toBeDefined();
    });
  });

  describe("Verificación de cambios pendientes (check)", () => {
    let zonaDePruebaId: string;

    const headerConCliente = () =>
      JSON.stringify({ id: "admin", clientId: createdClientId });

    afterAll(async () => {
      if (zonaDePruebaId) {
        await prismaClient.zone.delete({ where: { id: zonaDePruebaId } }).catch(() => {});
      }
    });

    it("debe responder 400 cuando la versión de la aplicación no está informada", async () => {
      const response = await request(app)
        .get("/api/v1/sync/check")
        .set("user", headerConCliente());

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data).not.toBeNull();
      expect(response.body.data.versionMismatch).toBe(true);
      expect(response.body.messages[0]).toContain("Aplicación desactualizada");
    });

    it("debe responder 400 cuando last_pulled_at no es un timestamp numérico", async () => {
      const response = await request(app)
        .get("/api/v1/sync/check?last_pulled_at=invalido")
        .set("user", headerConCliente())
        .set("x-bypass-version-check", "true");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages[0]).toBe("Error de validación");
      expect(response.body.messages.join(" | ")).toContain("timestamp numérico");
    });

    it("debe reportar hasChanges=true desde el inicio de los tiempos", async () => {
      const response = await request(app)
        .get("/api/v1/sync/check?last_pulled_at=0")
        .set("user", headerConCliente())
        .set("x-bypass-version-check", "true");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(response.body.data.hasChanges).toBe(true);
    });

    it("debe reportar hasChanges=true cuando existe un cambio posterior a la marca", async () => {
      const marca = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 25));

      const zona = await prismaClient.zone.create({
        data: { name: `Zona Check ${Date.now()}`, clientId: createdClientId },
      });
      zonaDePruebaId = zona.id;

      const response = await request(app)
        .get(`/api/v1/sync/check?last_pulled_at=${marca}`)
        .set("user", headerConCliente())
        .set("x-bypass-version-check", "true");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasChanges).toBe(true);

      // Efecto real en la DB: la zona existe y fue creada después de la marca.
      const efectoDb = await prismaClient.zone.findUnique({ where: { id: zona.id } });
      expect(efectoDb).not.toBeNull();
      expect(efectoDb!.createdAt.getTime()).toBeGreaterThan(marca);
      expect(efectoDb!.clientId).toBe(createdClientId);
    });

    it("debe reportar hasChanges=false cuando no hay cambios posteriores a la marca", async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      const marca = Date.now();

      const response = await request(app)
        .get(`/api/v1/sync/check?last_pulled_at=${marca}`)
        .set("user", headerConCliente())
        .set("x-bypass-version-check", "true");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasChanges).toBe(false);
    });

    it("debe reportar hasChanges=false cuando la marca está en el futuro", async () => {
      const response = await request(app)
        .get(`/api/v1/sync/check?last_pulled_at=${Date.now() + 100000}`)
        .set("user", headerConCliente())
        .set("x-bypass-version-check", "true");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasChanges).toBe(false);
    });
  });
});
