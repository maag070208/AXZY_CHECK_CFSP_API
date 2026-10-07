import { z } from "zod";

export const clockInSchema = z.object({
  body: z.object({
    guardId: z
      .string({ message: "El ID del guardia es requerido" })
      .uuid({ message: "El ID del guardia debe ser un UUID" }),
  }),
});

export type ClockInDTO = z.infer<typeof clockInSchema>["body"];

export const clockOutSchema = z.object({
  body: z.object({
    guardId: z
      .string({ message: "El ID del guardia es requerido" })
      .uuid({ message: "El ID del guardia debe ser un UUID" }),
  }),
});

export type ClockOutDTO = z.infer<typeof clockOutSchema>["body"];

/** Validación del parámetro `:id` en el borrado de un registro de prenómina. */
export const guardLogIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: "El ID del registro debe ser un UUID" }),
  }),
});

