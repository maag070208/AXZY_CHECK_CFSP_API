import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1, "El nombre de usuario es requerido"),
    password: z.string().min(1, "La contraseña es requerida"),
  }),
});

export const createUserSchema = z.object({
  body: z.object({
    name: z
      .string("El nombre es requerido")
      .min(2, "El nombre debe tener al menos 2 caracteres"),
    lastName: z
      .string("El apellido es requerido")
      .min(2, "El apellido debe tener al menos 2 caracteres")
      .optional(),
    username: z
      .string("El usuario es requerido")
      .min(2, "El usuario debe tener al menos 2 caracteres"),
    password: z
      .string("La contraseña es requerida")
      .min(6, "La contraseña debe tener al menos 6 caracteres"),
    roleId: z.string("El rol es requerido").uuid("El rol debe ser valido"),
    clientId: z.string().uuid().optional().nullable(),
    scheduleId: z.string().uuid().optional().nullable(),
    shiftStart: z.string().optional(),
    shiftEnd: z.string().optional(),
  }),
});
