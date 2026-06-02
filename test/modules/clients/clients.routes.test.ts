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

describe("Rutas de Clientes (Integración)", () => {
  let createdClientId: string;
  const createdClientIds: string[] = [];
  const uniqueName = `Cliente de Prueba ${Date.now()}`;
  let adminUserId: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: "ADMIN" } });
    if (adminRole) {
      const adminRes = await prismaClient.user.create({
        data: {
          name: "Admin",
          lastName: "Test",
          username: `admin_client_test_${Date.now()}`,
          password: "hashedpassword",
          roleId: adminRole.id,
        },
      });
      adminUserId = adminRes.id;
    }
  });

  afterAll(async () => {
    for (const id of createdClientIds) {
      await prismaClient.client.delete({ where: { id } }).catch(() => {});
    }
    if (createdClientId) {
      await prismaClient.client.delete({ where: { id: createdClientId } }).catch(() => {});
    }
    if (adminUserId) {
      await prismaClient.user.delete({ where: { id: adminUserId } }).catch(() => {});
    }
  });

  describe("POST /api/v1/clients", () => {
    it("debe crear un nuevo cliente en la BD", async () => {
      const response = await request(app)
        .post("/api/v1/clients")
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({ name: uniqueName, address: "123 Main St", active: true });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data).toBe("object");
      expect(response.body.data.name).toBe(uniqueName);
      
      createdClientId = response.body.data.id;
      expect(createdClientId).toBeDefined();
    });

    it("debe retornar 400 si falta el nombre", async () => {
      const response = await request(app)
        .post("/api/v1/clients")
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({ address: "Sin nombre" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/clients", () => {
    it("debe retornar una lista de clientes desde la BD", async () => {
      const response = await request(app)
        .get("/api/v1/clients")
        .set("user", JSON.stringify({ id: adminUserId }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      const found = response.body.data.find((c: any) => c.id === createdClientId);
      expect(found).toBeDefined();
    });
  });

  describe("GET /api/v1/clients/:id", () => {
    it("debe retornar un solo cliente por ID", async () => {
      const response = await request(app)
        .get(`/api/v1/clients/${createdClientId}`)
        .set("user", JSON.stringify({ id: adminUserId }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(createdClientId);
    });

    it("debe retornar 400 por UUID inválido", async () => {
      const response = await request(app)
        .get("/api/v1/clients/invalid-uuid")
        .set("user", JSON.stringify({ id: adminUserId }));
      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/v1/clients/:id", () => {
    it("debe actualizar un cliente existente en la BD", async () => {
      const response = await request(app)
        .put(`/api/v1/clients/${createdClientId}`)
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({ name: `${uniqueName} Actualizado`, active: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(`${uniqueName} Actualizado`);
      expect(response.body.data.active).toBe(false);
    });

    it("debe retornar 400 por UUID inválido", async () => {
      const response = await request(app)
        .put("/api/v1/clients/invalid-uuid")
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({ name: "Actualizado" });
      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/v1/clients/:id", () => {
    it("debe eliminar un cliente de la BD", async () => {
      const response = await request(app)
        .delete(`/api/v1/clients/${createdClientId}`)
        .set("user", JSON.stringify({ id: adminUserId }));
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.softDelete).toBe(true);
    });

    it("debe retornar 400 por UUID inválido", async () => {
      const response = await request(app)
        .delete("/api/v1/clients/invalid-uuid")
        .set("user", JSON.stringify({ id: adminUserId }));
      expect(response.status).toBe(400);
    });
  });

  describe("Pruebas de Borrado en Cascada y Restricciones Únicas", () => {
    it("debe eliminar el usuario de aplicación asociado al eliminar un cliente", async () => {
      const name = `Cliente Cascada ${Date.now()}`;
      const username = `user_casc_${Date.now()}`;
      
      // 1. Crear cliente con usuario asociado
      const resCreate = await request(app)
        .post("/api/v1/clients")
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({
          name,
          address: "Dir Cascada",
          active: true,
          appUsername: username,
          appPassword: "password123",
        });

      expect(resCreate.status).toBe(201);
      const clientId = resCreate.body.data.id;
      createdClientIds.push(clientId);

      // Buscar usuario en base de datos
      const user = await prismaClient.user.findFirst({
        where: { clientId, username },
      });
      expect(user).toBeDefined();
      expect(user?.username).toBe(username);

      // 2. Eliminar el cliente
      const resDelete = await request(app)
        .delete(`/api/v1/clients/${clientId}`)
        .set("user", JSON.stringify({ id: adminUserId }));

      expect(resDelete.status).toBe(200);

      // 3. Verificar que el usuario asociado también fue eliminado (softDelete: true)
      const userDeleted = await prismaClient.user.findUnique({
        where: { id: user!.id, softDelete: true } as any,
      });
      expect(userDeleted).toBeDefined();
      expect(userDeleted?.softDelete).toBe(true);
      expect(userDeleted?.username).toContain("_deleted_");
    });

    it("debe eliminar el cliente asociado al eliminar un usuario con rol cliente", async () => {
      const name = `Cliente Cascada Reversa ${Date.now()}`;
      const username = `user_casc_rev_${Date.now()}`;
      
      // 1. Crear cliente con usuario asociado
      const resCreate = await request(app)
        .post("/api/v1/clients")
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({
          name,
          address: "Dir Cascada",
          active: true,
          appUsername: username,
          appPassword: "password123",
        });

      expect(resCreate.status).toBe(201);
      const clientId = resCreate.body.data.id;
      createdClientIds.push(clientId);

      const user = await prismaClient.user.findFirst({
        where: { clientId, username },
      });
      expect(user).toBeDefined();

      // 2. Eliminar el usuario directamente
      const resDeleteUser = await request(app)
        .delete(`/api/v1/users/${user!.id}`)
        .set("user", JSON.stringify({ id: adminUserId }));

      expect(resDeleteUser.status).toBe(200);

      // 3. Verificar que el cliente también fue eliminado en cascada (softDelete: true)
      const clientDeleted = await prismaClient.client.findUnique({
        where: { id: clientId, softDelete: true } as any,
      });
      expect(clientDeleted).toBeDefined();
      expect(clientDeleted?.softDelete).toBe(true);
      expect(clientDeleted?.name).toContain("_deleted_");
    });

    it("debe permitir registrar un nuevo cliente con el mismo nombre y usuario después de eliminar el anterior", async () => {
      const name = `Cliente Duplicado ${Date.now()}`;
      const username = `user_dup_${Date.now()}`;

      // 1. Crear primer cliente con usuario
      const resCreate1 = await request(app)
        .post("/api/v1/clients")
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({
          name,
          appUsername: username,
          appPassword: "password123",
        });
      expect(resCreate1.status).toBe(201);
      const clientId1 = resCreate1.body.data.id;
      createdClientIds.push(clientId1);

      // 2. Eliminar el primer cliente
      const resDelete = await request(app)
        .delete(`/api/v1/clients/${clientId1}`)
        .set("user", JSON.stringify({ id: adminUserId }));
      expect(resDelete.status).toBe(200);

      // 3. Intentar crear un segundo cliente con exactamente el mismo nombre y appUsername
      const resCreate2 = await request(app)
        .post("/api/v1/clients")
        .set("user", JSON.stringify({ id: adminUserId }))
        .send({
          name,
          appUsername: username,
          appPassword: "password123",
        });

      // Debe ser exitoso porque el anterior liberó los campos únicos con el sufijo _deleted_
      expect(resCreate2.status).toBe(201);
      const clientId2 = resCreate2.body.data.id;
      createdClientIds.push(clientId2);
      expect(clientId2).not.toBe(clientId1);
    });
  });
});
