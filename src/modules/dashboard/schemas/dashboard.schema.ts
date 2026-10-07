import { z } from "zod";

/** Fecha de turno en formato YYYY-MM-DD. */
const SHIFT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const attendanceQuerySchema = z.object({
  query: z.object({
    clientId: z
      .union([z.literal(""), z.string().uuid({ message: "clientId debe ser un UUID válido" })])
      .optional(),
    date: z
      .string()
      .regex(SHIFT_DATE_PATTERN, { message: "date debe tener formato YYYY-MM-DD (ej. 2026-10-04)" })
      .optional(),
  }),
});

export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>["query"];
