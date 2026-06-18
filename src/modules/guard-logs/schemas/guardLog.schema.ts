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
