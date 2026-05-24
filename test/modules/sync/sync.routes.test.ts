import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";

jest.mock("@src/modules/common/middlewares/auth.middleware", () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers["user"]) {
      req.user = JSON.parse(req.headers["user"]);
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
        .set("x-app-version", "1.0.0");

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
        .set("x-app-version", "1.0.0");

      expect(response.status).toBe(200);
      // No debería haber cambios nuevos después de una fecha futura
      expect(response.body.data.changes.client.created.length).toBe(0);
    });

    it("debe procesar un push de cambios (creación)", async () => {
      const uniquePushId = crypto.randomUUID();
      const pushData = {
        changes: {
          zone: {
            created: [
              {
                id: uniquePushId,
                name: "Push Zone",
                clientId: createdClientId
              }
            ],
            updated: [],
            deleted: []
          }
        }
      };

      const response = await request(app)
        .post("/api/v1/sync")
        .set("user", JSON.stringify({ id: "admin" }))
        .set("x-app-version", "1.0.0")
        .send(pushData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verificar persistencia en BD
      const zone = await prismaClient.zone.findUnique({
        where: { id: uniquePushId } as any
      });
      expect(zone).toBeDefined();
      expect(zone?.name).toBe("Push Zone");
    });

    it("debe fallar si el formato del push es inválido", async () => {
      const pushData = {
        changes: "formato-invalido"
      };

      const response = await request(app)
        .post("/api/v1/sync")
        .set("user", JSON.stringify({ id: "admin" }))
        .set("x-app-version", "1.0.0")
        .send(pushData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages).toBeDefined();
    });

    it("debe fallar si last_pulled_at no es un formato numérico", async () => {
      const response = await request(app)
        .get("/api/v1/sync?last_pulled_at=invalido")
        .set("user", JSON.stringify({ id: "admin" }))
        .set("x-app-version", "1.0.0");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.messages).toBeDefined();
    });
  });
});
