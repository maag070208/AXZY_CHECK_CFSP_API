import { z } from "zod";
import { checklistAnswersSchema } from "@src/core/utils/checklist.utils";

const countSchema = z
  .number({ message: "Debe ser un número" })
  .int("Debe ser un número entero")
  .min(0, "No puede ser negativo")
  .optional()
  .nullable();

export const createShiftHandoverSchema = z.object({
  body: z.object({
    clientId: z.string().uuid("ID de cliente inválido"),
    scheduleId: z.string().uuid("ID de horario inválido"),
    shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD"),
    credentialsCount: countSchema,
    tarjetonesCount: countSchema,
    novedades: z.string().max(2000, "Las novedades no deben exceder 2000 caracteres").optional().nullable(),
    checklist: checklistAnswersSchema,
    reportedToAdmin: z.boolean().optional(),
    elements: z
      .array(
        z.object({
          guardId: z.string().uuid("ID de guardia inválido"),
          entryTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora de entrada debe tener formato HH:mm"),
          observations: z.string().max(500, "Las observaciones no deben exceder 500 caracteres").optional().nullable(),
        }),
      )
      .min(1, "Agrega al menos un elemento que recibe el turno"),
  }),
});

export const shiftHandoverIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("ID de entrega inválido") }),
});
