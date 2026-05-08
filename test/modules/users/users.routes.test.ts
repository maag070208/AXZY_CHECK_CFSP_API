import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_ADMIN, ROLE_GUARD } from "@src/core/config/constants";

jest.mock("@src/modules/common/middlewares/auth.middleware", () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers["user"]) {
      req.user = JSON.parse(req.headers["user"]);
    }
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next(),
}));

describe("Rutas de Usuarios (Integración Total)", () => {
  let createdUserId: string;
  let adminUserId: string;
  let guardRoleId: string;
  let adminRoleId: string;

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });
    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD } });
    adminRoleId = adminRole!.id;
    guardRoleId = guardRole!.id;

    // Crear un admin para las pruebas que requieren auth
    const adminRes = await prismaClient.user.create({
        data: {
            name: "Admin",
            lastName: "Test",
            username: `admin_user_test_${Date.now()}`,
            password: "hashedpassword",
            roleId: adminRoleId
        }
    });
    adminUserId = adminRes.id;
  });

  afterAll(async () => {
    if (createdUserId) await prismaClient.user.delete({ where: { id: createdUserId } }).catch(() => {});
    if (adminUserId) await prismaClient.user.delete({ where: { id: adminUserId } }).catch(() => {});
  });

  describe("Operaciones de Gestión de Usuarios", () => {
    it("debe permitir el login de un usuario", async () => {
        // Primero creamos uno para logearnos (con password conocido)
        const user = await request(app)
            .post("/api/v1/users")
            .set("user", JSON.stringify({ id: adminUserId }))
            .send({
                name: "Login",
                lastName: "User",
                username: `login_test_${Date.now()}`,
                password: "password123",
                roleId: adminRoleId
            });
        
        createdUserId = user.body.data.id;

        const response = await request(app)
            .post("/api/v1/users/login")
            .send({
                username: user.body.data.username,
                password: "password123"
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined(); // Token
    });

    it("debe listar usuarios en el datatable con filtros", async () => {
        const response = await request(app)
            .post("/api/v1/users/datatable")
            .set("user", JSON.stringify({ id: adminUserId }))
            .send({
                filters: { name: "Login" }
            });

        expect(response.status).toBe(200);
        expect(response.body.data.rows.some((u: any) => u.id === createdUserId)).toBe(true);
    });

    it("debe permitir actualizar el perfil de un usuario", async () => {
        const response = await request(app)
            .put(`/api/v1/users/${createdUserId}`)
            .set("user", JSON.stringify({ id: adminUserId }))
            .send({
                name: "Updated Name",
                active: false
            });

        expect(response.status).toBe(200);
        expect(response.body.data.name).toBe("Updated Name");
        expect(response.body.data.active).toBe(false);
    });

    it("debe permitir resetear el password (Admin)", async () => {
        const response = await request(app)
            .put(`/api/v1/users/${createdUserId}/reset-password`)
            .set("user", JSON.stringify({ id: adminUserId }))
            .send({ newPassword: "newpassword123" });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    it("debe realizar un soft delete del usuario", async () => {
        const response = await request(app)
            .delete(`/api/v1/users/${createdUserId}`)
            .set("user", JSON.stringify({ id: adminUserId }));

        expect(response.status).toBe(200);
        
        // El utilitario de soft delete filtra por defecto, debemos forzar ver eliminados
        const check = await prismaClient.user.findUnique({ 
            where: { id: createdUserId, softDelete: true } as any 
        });
        expect(check?.softDelete).toBe(true);
        expect(check?.active).toBe(false);
    });
  });
});
