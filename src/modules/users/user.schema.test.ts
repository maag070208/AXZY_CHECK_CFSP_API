import { loginSchema, createUserSchema } from "./user.schema";

describe("User Schema Validation", () => {
  describe("loginSchema", () => {
    it("should validate a correct login body", () => {
      const data = {
        body: {
          username: "testuser",
          password: "password123",
        },
      };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should fail if username is missing", () => {
      const data = {
        body: {
          password: "password123",
        },
      };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe("createUserSchema", () => {
    it("should validate a correct user creation body", () => {
      const data = {
        body: {
          name: "John",
          username: "john.doe",
          password: "securepassword",
          roleId: "550e8400-e29b-41d4-a716-446655440000",
        },
      };
      const result = createUserSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should fail if password is too short", () => {
      const data = {
        body: {
          name: "John",
          username: "john.doe",
          password: "123",
          roleId: "550e8400-e29b-41d4-a716-446655440000",
        },
      };
      const result = createUserSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});
