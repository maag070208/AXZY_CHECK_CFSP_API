import { z } from "zod";

const daysOfWeekSchema = z
  .array(z.number().int().min(0, "Día inválido").max(6, "Día inválido"))
  .min(1, "Selecciona al menos un día");

const toleranceSchema = z
  .number({ message: "La tolerancia debe ser un número" })
  .int("La tolerancia debe ser un número entero")
  .min(0, "La tolerancia no puede ser negativa")
  .max(240, "La tolerancia máxima es de 240 minutos");

const shiftDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD");

export const createShiftPlanSchema = z.object({
  body: z
    .object({
      clientId: z.string().uuid("ID de cliente inválido"),
      scheduleId: z.string().uuid("ID de horario inválido"),
      requireHandover: z.boolean().optional(),
      requireUniform: z.boolean().optional(),
      toleranceMinutes: toleranceSchema.optional(),
      daysOfWeek: daysOfWeekSchema.optional(),
      active: z.boolean().optional(),
    })
    .refine((b) => b.requireHandover !== false || b.requireUniform !== false, {
      message: "El plan debe exigir entrega de turno, uniforme o ambos",
    }),
});

export const updateShiftPlanSchema = z.object({
  params: z.object({ id: z.string().uuid("ID de plan inválido") }),
  body: z.object({
    requireHandover: z.boolean().optional(),
    requireUniform: z.boolean().optional(),
    toleranceMinutes: toleranceSchema.optional(),
    daysOfWeek: daysOfWeekSchema.optional(),
    active: z.boolean().optional(),
  }),
});

export const shiftPlanIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("ID de plan inválido") }),
});

export const listShiftPlansSchema = z.object({
  query: z.object({
    clientId: z.string().uuid("ID de cliente inválido").optional(),
  }),
});

export const agendaQuerySchema = z.object({
  query: z.object({
    date: shiftDateSchema.optional(),
    clientId: z.string().uuid("ID de cliente inválido").optional(),
  }),
});
