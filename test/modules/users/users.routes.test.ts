import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_ADMIN, ROLE_GUARD } from "@src/core/config/constants";
import { comparePassword, hashPassword } from "@src/core/utils/security";
import { randomUUID } from "crypto";

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

describe("Rutas de Usuarios (Integración Total)", () => {
  let createdUserId: string;
  let adminUserId: string;
  let guardRoleId: string;
  let adminRoleId: string;
  let passwordUserId: string;
  let logoutUserId: string;

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

    // Usuario dedicado a las pruebas de cambio de contraseña (hash real de bcrypt)
    const passwordUser = await prismaClient.user.create({
      data: {
        name: "Password",
        lastName: "User",
        username: `password_user_test_${Date.now()}`,
        password: await hashPassword("passwordVieja123"),
        roleId: adminRoleId,
      },
    });
    passwordUserId = passwordUser.id;

    // Usuario dedicado a la prueba de logout (arranca con sesión iniciada)
    const logoutUser = await prismaClient.user.create({
      data: {
        name: "Logout",
        lastName: "User",
        username: `logout_user_test_${Date.now()}`,
        password: "hashedpassword",
        roleId: adminRoleId,
        isLoggedIn: true,
      },
    });
    logoutUserId = logoutUser.id;
  });

  afterAll(async () => {
    // La FK de AuditLog hacia User es restrictiva: se limpian las auditorías propias primero.
    const ownUserIds = [createdUserId, adminUserId, passwordUserId, logoutUserId].filter(
      (id): id is string => Boolean(id),
    );
    if (ownUserIds.length > 0) {
      await prismaClient.auditLog
        .deleteMany({ where: { userId: { in: ownUserIds } } })
        .catch(() => {});
    }

    if (createdUserId) await prismaClient.user.delete({ where: { id: createdUserId } }).catch(() => {});
    if (adminUserId) await prismaClient.user.delete({ where: { id: adminUserId } }).catch(() => {});
    if (passwordUserId) await prismaClient.user.delete({ where: { id: passwordUserId } }).catch(() => {});
    if (logoutUserId) await prismaClient.user.delete({ where: { id: logoutUserId } }).catch(() => {});
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
                page: 1,
                limit: 10,
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

  describe("Cierre de sesión", () => {
    it("debe cerrar sesión y marcar isLoggedIn=false en la base de datos", async () => {
      const antes = await prismaClient.user.findUnique({ where: { id: logoutUserId } });
      expect(antes?.isLoggedIn).toBe(true);

      const response = await request(app)
        .post("/api/v1/users/logout")
        .set("user", JSON.stringify({ id: logoutUserId, role: ROLE_ADMIN }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(response.body.data).toBe(true);

      const despues = await prismaClient.user.findUnique({ where: { id: logoutUserId } });
      expect(despues?.isLoggedIn).toBe(false);
    });

    it("debe priorizar el usuario autenticado sobre el userId del body", async () => {
      // `logout()` resuelve `res.locals.user?.id || req.body.userId`: si llega el
      // usuario autenticado, el userId del body debe ignorarse por completo.
      await prismaClient.user.update({ where: { id: logoutUserId }, data: { isLoggedIn: true } });
      await prismaClient.user.update({ where: { id: adminUserId }, data: { isLoggedIn: true } });

      const response = await request(app)
        .post("/api/v1/users/logout")
        .set("user", JSON.stringify({ id: logoutUserId, role: ROLE_ADMIN }))
        .send({ userId: adminUserId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(response.body.data).toBe(true);

      const despues = await prismaClient.user.findUnique({ where: { id: logoutUserId } });
      expect(despues?.isLoggedIn).toBe(false);

      // El usuario del body NO debe haberse tocado.
      const ajeno = await prismaClient.user.findUnique({ where: { id: adminUserId } });
      expect(ajeno?.isLoggedIn).toBe(true);
    });
  });

  describe("Registro de token FCM", () => {
    it("debe registrar el token FCM del usuario autenticado", async () => {
      const token = `fcm-token-test-${Date.now()}`;

      const response = await request(app)
        .post("/api/v1/users/fcm-token")
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({ token, platform: "android" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(response.body.data).toEqual({ registered: true });

      const dbUser = await prismaClient.user.findUnique({ where: { id: adminUserId } });
      expect(dbUser?.fcmToken).toBe(token);
    });

    it("debe devolver 400 si falta el token (validación Zod)", async () => {
      const response = await request(app)
        .post("/api/v1/users/fcm-token")
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({ platform: "ios" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toContain("Error de validación");
      expect(
        response.body.messages.some((m: string) => m.startsWith("body.token")),
      ).toBe(true);
    });
  });

  describe("Listado de usuarios", () => {
    it("debe listar usuarios en el arreglo plano excluyendo soft-deleted", async () => {
      const response = await request(app)
        .get("/api/v1/users")
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.some((u: any) => u.id === adminUserId)).toBe(true);
      expect(response.body.data.some((u: any) => u.id === createdUserId)).toBe(false);
    });

    it("debe filtrar el listado con el parámetro q", async () => {
      const dbAdmin = await prismaClient.user.findUnique({ where: { id: adminUserId } });

      const response = await request(app)
        .get(`/api/v1/users?q=${dbAdmin!.username}`)
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.some((u: any) => u.id === adminUserId)).toBe(true);
      expect(response.body.data.some((u: any) => u.id === logoutUserId)).toBe(false);
    });

    it("debe devolver un arreglo vacío si el filtro q no encuentra coincidencias", async () => {
      const response = await request(app)
        .get(`/api/v1/users?q=sin_coincidencias_${Date.now()}`)
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe("Detalle de usuario por id", () => {
    it("debe devolver el usuario solicitado", async () => {
      const response = await request(app)
        .get(`/api/v1/users/${adminUserId}`)
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(response.body.data.id).toBe(adminUserId);
      expect(response.body.data.role.name).toBe(ROLE_ADMIN);
      // BUG detectado (NO corregido): la respuesta incluye `password` con el hash
      // bcrypt, porque `userService.getUserById` lo selecciona. Ver reporte final.
      expect(response.body.data.username).toBeDefined();
    });

    it("debe devolver 404 si el usuario no existe", async () => {
      const response = await request(app)
        .get(`/api/v1/users/${randomUUID()}`)
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toEqual(["Usuario no encontrado"]);
    });

    it("debe devolver 400 si el id no es un uuid válido (validación Zod)", async () => {
      const response = await request(app)
        .get("/api/v1/users/no-es-un-uuid")
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toContain("Error de validación");
      expect(response.body.messages.some((m: string) => m.includes("params.id"))).toBe(true);
    });
  });

  describe("Cambio de contraseña", () => {
    it("debe devolver 400 si la contraseña actual es incorrecta", async () => {
      const response = await request(app)
        .put(`/api/v1/users/${passwordUserId}/password`)
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({ oldPassword: "claveEquivocada123", newPassword: "passwordNueva123" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toEqual(["La contraseña actual es incorrecta"]);

      const dbUser = await prismaClient.user.findUnique({ where: { id: passwordUserId } });
      expect(await comparePassword("passwordVieja123", dbUser!.password)).toBe(true);
    });

    it("debe devolver 400 si la nueva contraseña es muy corta (validación Zod)", async () => {
      const response = await request(app)
        .put(`/api/v1/users/${passwordUserId}/password`)
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({ oldPassword: "passwordVieja123", newPassword: "123" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toContain("Error de validación");
      expect(
        response.body.messages.some((m: string) =>
          m.includes("La nueva contraseña debe tener al menos 6 caracteres"),
        ),
      ).toBe(true);
    });

    it("debe devolver 404 si el usuario no existe", async () => {
      const response = await request(app)
        .put(`/api/v1/users/${randomUUID()}/password`)
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({ oldPassword: "passwordVieja123", newPassword: "passwordNueva123" });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toEqual(["Usuario no encontrado"]);
    });

    it("debe devolver 400 si el id no es un uuid válido (validación Zod)", async () => {
      const response = await request(app)
        .put("/api/v1/users/no-es-un-uuid/password")
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({ oldPassword: "passwordVieja123", newPassword: "passwordNueva123" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.messages).toContain("Error de validación");
      expect(response.body.messages.some((m: string) => m.includes("params.id"))).toBe(true);
    });

    it("debe cambiar la contraseña y persistir el nuevo hash", async () => {
      // Se restablece la clave conocida para que la prueba no dependa del orden anterior.
      await prismaClient.user.update({
        where: { id: passwordUserId },
        data: { password: await hashPassword("passwordVieja123") },
      });

      const response = await request(app)
        .put(`/api/v1/users/${passwordUserId}/password`)
        .set("user", JSON.stringify({ id: adminUserId, role: ROLE_ADMIN }))
        .send({ oldPassword: "passwordVieja123", newPassword: "passwordNueva123" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toEqual(["Success"]);
      expect(response.body.data).toBe(true);

      const dbUser = await prismaClient.user.findUnique({ where: { id: passwordUserId } });
      expect(await comparePassword("passwordNueva123", dbUser!.password)).toBe(true);
      expect(await comparePassword("passwordVieja123", dbUser!.password)).toBe(false);
    });
  });
});
